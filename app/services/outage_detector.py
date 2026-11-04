from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.outage import OutageReport, OutageStatus
from app.models.ticket import SupportTicket, TicketCategory
from app.models.area_package import ServiceArea
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationChannel


def check_and_flag_outage(
    db: Session,
    service_area_id: int,
    category_id: int
) -> Optional[OutageReport]:
    """
    Evaluates rolling temporal window of complaints in a service area.
    If threshold is exceeded for critical internet failure categories,
    flags a SUSPECTED area outage for Admin verification.
    """
    category = db.query(TicketCategory).filter(TicketCategory.id == category_id).first()
    if not category:
        return None

    # Only correlate network disruption categories
    monitored_categories = ["Internet Not Working", "Network Outage", "Frequent Disconnection"]
    if category.name not in monitored_categories:
        return None

    window_start = datetime.now(timezone.utc) - timedelta(minutes=settings.OUTAGE_WINDOW_MINUTES)

    # Count recent tickets in this area
    recent_tickets_count = db.query(SupportTicket).join(
        TicketCategory, SupportTicket.category_id == TicketCategory.id
    ).filter(
        SupportTicket.service_area_id == service_area_id,
        TicketCategory.name.in_(monitored_categories),
        SupportTicket.created_at >= window_start
    ).count()

    if recent_tickets_count < settings.OUTAGE_TICKET_THRESHOLD:
        return None

    # Check for active existing outage report
    existing_outage = db.query(OutageReport).filter(
        OutageReport.service_area_id == service_area_id,
        OutageReport.status.in_([
            OutageStatus.SUSPECTED.value,
            OutageStatus.CONFIRMED.value,
            OutageStatus.INVESTIGATING.value
        ])
    ).first()

    if existing_outage:
        existing_outage.correlated_ticket_count = recent_tickets_count
        db.commit()
        db.refresh(existing_outage)
        return existing_outage

    # Create new Suspected Outage Report
    current_year = datetime.now(timezone.utc).year
    total_outages = db.query(OutageReport).count()
    outage_code = f"OUT-{current_year}-{total_outages + 1:04d}"

    area = db.query(ServiceArea).filter(ServiceArea.id == service_area_id).first()
    area_name = area.name if area else f"Area #{service_area_id}"

    new_outage = OutageReport(
        outage_code=outage_code,
        service_area_id=service_area_id,
        status=OutageStatus.SUSPECTED.value,
        suspected_cause=f"High density of connection failures ({recent_tickets_count} tickets within {settings.OUTAGE_WINDOW_MINUTES}m). Possible distribution fiber break or switch failure.",
        correlated_ticket_count=recent_tickets_count,
        detected_at=datetime.now(timezone.utc)
    )
    db.add(new_outage)
    db.flush()

    # Alert all Admins and Agents
    staff_users = db.query(User).filter(
        User.role.in_([UserRole.ADMIN.value, UserRole.AGENT.value]),
        User.is_active == True
    ).all()

    for staff in staff_users:
        db.add(Notification(
            user_id=staff.id,
            title=f"🚨 Suspected Network Outage: {area_name}",
            message=f"{recent_tickets_count} complaints detected in {area_name} ({outage_code}). Review and verify line health.",
            channel=NotificationChannel.IN_APP.value
        ))

    db.commit()
    db.refresh(new_outage)
    print(f"!!! Area Outage Flagged: {outage_code} for {area_name} ({recent_tickets_count} tickets) !!!")
    return new_outage

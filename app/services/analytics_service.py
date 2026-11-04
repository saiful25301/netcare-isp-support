from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.customer import Customer, CustomerStatus
from app.models.ticket import SupportTicket, TicketStatus, TicketPriority, TicketCategory
from app.models.area_package import ServiceArea
from app.models.technician import Technician
from app.models.feedback import CustomerFeedback


def calculate_operations_analytics(db: Session) -> Dict[str, Any]:
    """Calculate comprehensive ISP support operations metrics and charts data."""
    # 1. Customer Counters
    total_customers = db.query(Customer).count()
    active_customers = db.query(Customer).filter(Customer.status == CustomerStatus.ACTIVE.value).count()

    # 2. Ticket Counters
    total_complaints = db.query(SupportTicket).count()
    new_complaints = db.query(SupportTicket).filter(SupportTicket.status == TicketStatus.NEW.value).count()
    in_progress_complaints = db.query(SupportTicket).filter(SupportTicket.status == TicketStatus.IN_PROGRESS.value).count()
    pending_complaints = db.query(SupportTicket).filter(
        SupportTicket.status.in_([
            TicketStatus.NEW.value,
            TicketStatus.ASSIGNED.value,
            TicketStatus.IN_PROGRESS.value,
            TicketStatus.WAITING.value,
            TicketStatus.REOPENED.value
        ])
    ).count()
    resolved_complaints = db.query(SupportTicket).filter(
        SupportTicket.status.in_([TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value])
    ).count()
    critical_tickets = db.query(SupportTicket).filter(
        SupportTicket.priority == TicketPriority.CRITICAL.value,
        SupportTicket.status.notin_([TicketStatus.CLOSED.value, TicketStatus.RESOLVED.value])
    ).count()

    # 3. Average Resolution Time (Hours)
    resolved_tickets = db.query(SupportTicket).filter(
        SupportTicket.resolved_at.isnot(None),
        SupportTicket.created_at.isnot(None)
    ).all()

    avg_resolution_hours = 0.0
    if resolved_tickets:
        durations = [
            (t.resolved_at - t.created_at).total_seconds() / 3600.0
            for t in resolved_tickets
            if t.resolved_at > t.created_at
        ]
        if durations:
            avg_resolution_hours = round(sum(durations) / len(durations), 1)

    # 4. Customer Satisfaction Score (CSAT)
    csat_avg = db.query(func.avg(CustomerFeedback.rating)).scalar()
    csat_score = round(float(csat_avg), 1) if csat_avg is not None else 4.8

    # 5. Area-wise Complaints Breakdown
    area_counts = db.query(
        ServiceArea.name,
        func.count(SupportTicket.id)
    ).join(
        SupportTicket, ServiceArea.id == SupportTicket.service_area_id, isouter=True
    ).group_by(ServiceArea.name).all()

    area_breakdown = [{"area": name, "count": count} for name, count in area_counts]

    # 6. Category Breakdown
    cat_counts = db.query(
        TicketCategory.name,
        func.count(SupportTicket.id)
    ).join(
        SupportTicket, TicketCategory.id == SupportTicket.category_id, isouter=True
    ).group_by(TicketCategory.name).all()

    category_breakdown = [{"category": name, "count": count} for name, count in cat_counts]

    # 7. Daily Complaints Trend (Last 7 Days)
    today = datetime.now(timezone.utc).date()
    daily_trends = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=timezone.utc)
        day_end = datetime(day.year, day.month, day.day, 23, 59, 59, tzinfo=timezone.utc)
        cnt = db.query(SupportTicket).filter(
            SupportTicket.created_at >= day_start,
            SupportTicket.created_at <= day_end
        ).count()
        daily_trends.append({"date": day.strftime("%b %d"), "count": cnt})

    # 8. Technician Performance Leaderboard
    technicians = db.query(Technician).all()
    tech_leaderboard = []
    for tech in technicians:
        resolved = db.query(SupportTicket).filter(
            SupportTicket.assigned_technician_id == tech.id,
            SupportTicket.status.in_([TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value])
        ).count()
        tech_leaderboard.append({
            "employee_code": tech.employee_code,
            "name": tech.user.full_name if tech.user else "Tech",
            "rating": tech.rating_cache,
            "resolved_tickets": resolved,
            "status": tech.current_status
        })

    return {
        "kpi": {
            "total_customers": total_customers,
            "active_customers": active_customers,
            "total_complaints": total_complaints,
            "new_complaints": new_complaints,
            "in_progress_complaints": in_progress_complaints,
            "pending_complaints": pending_complaints,
            "resolved_complaints": resolved_complaints,
            "critical_tickets": critical_tickets,
            "avg_resolution_hours": avg_resolution_hours,
            "csat_score": csat_score
        },
        "area_breakdown": area_breakdown,
        "category_breakdown": category_breakdown,
        "daily_trends": daily_trends,
        "tech_leaderboard": tech_leaderboard
    }

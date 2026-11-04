import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.outage import OutageReport, OutageStatus
from app.models.area_package import ServiceArea
from app.models.user import User, UserRole
from app.schemas.outage import OutageResponse, OutageUpdate

router = APIRouter()


def _format_outage(o: OutageReport) -> OutageResponse:
    return OutageResponse(
        id=o.id,
        outage_code=o.outage_code,
        service_area_id=o.service_area_id,
        service_area_name=o.service_area.name if o.service_area else None,
        service_area_code=o.service_area.code if o.service_area else None,
        status=o.status,
        suspected_cause=o.suspected_cause,
        correlated_ticket_count=o.correlated_ticket_count,
        verified_by_user_id=o.verified_by_user_id,
        verified_by_name=o.verified_by_user.full_name if o.verified_by_user else None,
        detected_at=o.detected_at,
        resolved_at=o.resolved_at
    )


@router.get("", response_model=List[OutageResponse])
def list_outages(
    status_filter: Optional[str] = Query(None, alias="status"),
    service_area_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List network outage reports with status and area filters."""
    query = db.query(OutageReport)
    if status_filter:
        query = query.filter(OutageReport.status == status_filter.upper())
    if service_area_id:
        query = query.filter(OutageReport.service_area_id == service_area_id)
    outages = query.order_by(OutageReport.detected_at.desc()).all()
    return [_format_outage(o) for o in outages]


@router.get("/active/banner", response_model=List[OutageResponse])
def get_active_outage_banners(db: Session = Depends(get_db)):
    """Retrieve all ongoing outages (SUSPECTED, CONFIRMED, INVESTIGATING) for user alerts."""
    active_statuses = [
        OutageStatus.SUSPECTED.value,
        OutageStatus.CONFIRMED.value,
        OutageStatus.INVESTIGATING.value
    ]
    outages = db.query(OutageReport).filter(
        OutageReport.status.in_(active_statuses)
    ).order_by(OutageReport.detected_at.desc()).all()
    return [_format_outage(o) for o in outages]


@router.put("/{outage_id}", response_model=OutageResponse)
def update_outage_report(
    outage_id: uuid.UUID,
    payload: OutageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """Admin/Agent verifies, updates status (CONFIRMED/INVESTIGATING/RESOLVED), and adds causes."""
    outage = db.query(OutageReport).filter(OutageReport.id == outage_id).first()
    if not outage:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outage report not found.")

    if payload.status is not None:
        new_status = payload.status.upper()
        outage.status = new_status
        if new_status in [OutageStatus.CONFIRMED.value, OutageStatus.INVESTIGATING.value]:
            outage.verified_by_user_id = current_user.id
        elif new_status == OutageStatus.RESOLVED.value:
            outage.resolved_at = datetime.now(timezone.utc)

    if payload.suspected_cause is not None:
        outage.suspected_cause = payload.suspected_cause.strip()

    db.commit()
    db.refresh(outage)
    return _format_outage(outage)

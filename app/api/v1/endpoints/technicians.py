import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.dependencies import require_roles, get_current_user
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.technician import Technician, TechnicianStatus
from app.models.area_package import ServiceArea
from app.models.ticket import SupportTicket, TicketStatus
from app.schemas.technician import TechnicianCreate, TechnicianResponse, TechnicianUpdate

router = APIRouter()


def _format_technician_response(tech: Technician) -> TechnicianResponse:
    return TechnicianResponse(
        id=tech.id,
        user_id=tech.user_id,
        employee_code=tech.employee_code,
        email=tech.user.email,
        phone_number=tech.user.phone_number,
        full_name=tech.user.full_name,
        primary_area_id=tech.primary_area_id,
        primary_area_name=tech.primary_area.name if tech.primary_area else None,
        primary_area_code=tech.primary_area.code if tech.primary_area else None,
        specialization=tech.specialization,
        current_status=tech.current_status,
        rating_cache=tech.rating_cache,
        is_active=tech.user.is_active
    )


@router.get("", response_model=List[dict])
def list_technicians(
    primary_area_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    _staff=Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """List all technicians with live ticket workload metrics (Admin/Agent)."""
    query = db.query(Technician).join(User, Technician.user_id == User.id)

    if primary_area_id:
        query = query.filter(Technician.primary_area_id == primary_area_id)

    if status_filter:
        query = query.filter(Technician.current_status == status_filter.upper())

    techs = query.order_by(Technician.employee_code.asc()).all()
    results = []

    for t in techs:
        # Calculate active assigned tickets
        active_tickets_count = db.query(SupportTicket).filter(
            SupportTicket.assigned_technician_id == t.id,
            SupportTicket.status.in_([TicketStatus.ASSIGNED.value, TicketStatus.IN_PROGRESS.value])
        ).count()

        resolved_count = db.query(SupportTicket).filter(
            SupportTicket.assigned_technician_id == t.id,
            SupportTicket.status.in_([TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value])
        ).count()

        t_dict = _format_technician_response(t).model_dump()
        t_dict["active_assigned_tickets"] = active_tickets_count
        t_dict["completed_tickets"] = resolved_count
        results.append(t_dict)

    return results


@router.post("", response_model=TechnicianResponse, status_code=status.HTTP_201_CREATED)
def create_technician(
    payload: TechnicianCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles(UserRole.ADMIN.value))
):
    """Add a new field technician (Admin only)."""
    existing_user = db.query(User).filter(
        or_(
            User.email == payload.email.strip().lower(),
            User.phone_number == payload.phone_number.strip()
        )
    ).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email or phone already in use.")

    area = db.query(ServiceArea).filter(ServiceArea.id == payload.primary_area_id).first()
    if not area:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service area not found.")

    count = db.query(Technician).count()
    employee_code = f"NC-TECH-{count + 1:02d}"

    new_user = User(
        email=payload.email.strip().lower(),
        phone_number=payload.phone_number.strip(),
        full_name=payload.full_name.strip(),
        role=UserRole.TECHNICIAN.value,
        hashed_password=get_password_hash(payload.password),
        is_active=True
    )
    db.add(new_user)
    db.flush()

    new_tech = Technician(
        user_id=new_user.id,
        employee_code=employee_code,
        primary_area_id=area.id,
        specialization=payload.specialization or "Fiber Line & Network Configuration",
        current_status=TechnicianStatus.AVAILABLE.value,
        rating_cache=5.0
    )
    db.add(new_tech)
    db.commit()
    db.refresh(new_tech)

    return _format_technician_response(new_tech)


@router.get("/{tech_id}")
def get_technician_detail(
    tech_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve technician details and assigned ticket history."""
    tech = db.query(Technician).filter(Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found.")

    if current_user.role == UserRole.TECHNICIAN.value and tech.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    tickets = db.query(SupportTicket).filter(
        SupportTicket.assigned_technician_id == tech.id
    ).order_by(SupportTicket.updated_at.desc()).all()

    assigned_list = [
        {
            "id": str(t.id),
            "ticket_id": t.ticket_id,
            "category": t.category.name if t.category else None,
            "priority": t.priority,
            "status": t.status,
            "problem_title": t.problem_title,
            "customer_name": t.customer.user.full_name if t.customer and t.customer.user else None,
            "customer_address": t.customer.installation_address if t.customer else None,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat()
        }
        for t in tickets
    ]

    result = _format_technician_response(tech).model_dump()
    result["assigned_tickets"] = assigned_list
    return result


@router.put("/{tech_id}", response_model=TechnicianResponse)
def update_technician(
    tech_id: uuid.UUID,
    payload: TechnicianUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update technician details or availability status."""
    tech = db.query(Technician).filter(Technician.id == tech_id).first()
    if not tech:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found.")

    # Technician can only update their own current_status
    if current_user.role == UserRole.TECHNICIAN.value:
        if tech.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
        if payload.current_status is not None:
            tech.current_status = payload.current_status.upper()
        db.commit()
        db.refresh(tech)
        return _format_technician_response(tech)

    # Admin/Agent can update everything
    if current_user.role not in [UserRole.ADMIN.value, UserRole.AGENT.value]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if payload.full_name is not None:
        tech.user.full_name = payload.full_name.strip()
    if payload.phone_number is not None:
        tech.user.phone_number = payload.phone_number.strip()
    if payload.primary_area_id is not None:
        tech.primary_area_id = payload.primary_area_id
    if payload.specialization is not None:
        tech.specialization = payload.specialization.strip()
    if payload.current_status is not None:
        tech.current_status = payload.current_status.upper()
    if payload.is_active is not None:
        tech.user.is_active = payload.is_active

    db.commit()
    db.refresh(tech)
    return _format_technician_response(tech)

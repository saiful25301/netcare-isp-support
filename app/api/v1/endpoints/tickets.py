import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.customer import Customer
from app.models.technician import Technician
from app.models.ticket import SupportTicket, TicketCategory, TicketPriority, TicketStatus
from app.models.ticket_workflow import TicketComment, TicketStatusHistory
from app.schemas.ticket import (
    TicketCreate,
    TicketCreateOnBehalf,
    TicketAssignRequest,
    TicketStatusUpdateRequest,
    TicketPriorityUpdateRequest,
    TicketCommentCreate,
    TicketCommentResponse,
    TicketListItemResponse,
    TicketDetailResponse,
    TicketStatusHistoryResponse
)
from app.services.ticket_service import (
    create_ticket,
    assign_technician,
    update_ticket_status
)
from app.services.outage_detector import check_and_flag_outage

router = APIRouter()


def _format_ticket_list_item(t: SupportTicket) -> TicketListItemResponse:
    return TicketListItemResponse(
        id=t.id,
        ticket_id=t.ticket_id,
        customer_id=t.customer_id,
        customer_code=t.customer.customer_code if t.customer else "N/A",
        customer_name=t.customer.user.full_name if t.customer and t.customer.user else "Unknown",
        customer_phone=t.customer.user.phone_number if t.customer and t.customer.user else "N/A",
        service_area_id=t.service_area_id,
        service_area_name=t.service_area.name if t.service_area else "N/A",
        category_id=t.category_id,
        category_name=t.category.name if t.category else "General",
        priority=t.priority,
        status=t.status,
        problem_title=t.problem_title,
        assigned_technician_id=t.assigned_technician_id,
        assigned_technician_name=t.assigned_technician.user.full_name if t.assigned_technician and t.assigned_technician.user else None,
        assigned_technician_code=t.assigned_technician.employee_code if t.assigned_technician else None,
        created_at=t.created_at,
        updated_at=t.updated_at
    )


@router.get("", response_model=List[TicketListItemResponse])
def list_tickets(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    service_area_id: Optional[int] = None,
    category_id: Optional[int] = None,
    technician_id: Optional[uuid.UUID] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve support tickets with role-based scoping and multi-criteria filters."""
    query = db.query(SupportTicket).join(Customer, SupportTicket.customer_id == Customer.id).join(User, Customer.user_id == User.id)

    # 1. Role-based scoping
    if current_user.role == UserRole.CUSTOMER.value:
        cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
        if not cust:
            return []
        query = query.filter(SupportTicket.customer_id == cust.id)

    elif current_user.role == UserRole.TECHNICIAN.value:
        tech = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not tech:
            return []
        query = query.filter(SupportTicket.assigned_technician_id == tech.id)

    # 2. Query Filters
    if search:
        search_token = f"%{search.strip()}%"
        query = query.filter(
            or_(
                SupportTicket.ticket_id.ilike(search_token),
                SupportTicket.problem_title.ilike(search_token),
                User.full_name.ilike(search_token),
                User.phone_number.ilike(search_token),
                Customer.customer_code.ilike(search_token)
            )
        )

    if status_filter:
        query = query.filter(SupportTicket.status == status_filter.upper())

    if priority_filter:
        query = query.filter(SupportTicket.priority == priority_filter.upper())

    if service_area_id:
        query = query.filter(SupportTicket.service_area_id == service_area_id)

    if category_id:
        query = query.filter(SupportTicket.category_id == category_id)

    if technician_id and current_user.role in [UserRole.ADMIN.value, UserRole.AGENT.value]:
        query = query.filter(SupportTicket.assigned_technician_id == technician_id)

    tickets = query.order_by(SupportTicket.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_ticket_list_item(t) for t in tickets]


@router.post("", response_model=TicketListItemResponse, status_code=status.HTTP_201_CREATED)
def submit_complaint(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Customer self-service complaint submission."""
    cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not cust:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user has no associated customer profile."
        )

    ticket = create_ticket(
        db=db,
        customer_id=cust.id,
        category_id=payload.category_id,
        problem_title=payload.problem_title,
        problem_description=payload.problem_description,
        priority=payload.priority,
        created_by_user_id=current_user.id
    )

    # Trigger automatic Area-Based Outage Correlation analysis
    try:
        check_and_flag_outage(db, service_area_id=ticket.service_area_id, category_id=ticket.category_id)
    except Exception as e:
        print(f"Outage detector hook warning: {e}")

    return _format_ticket_list_item(ticket)


@router.post("/on-behalf", response_model=TicketListItemResponse, status_code=status.HTTP_201_CREATED)
def create_complaint_on_behalf(
    payload: TicketCreateOnBehalf,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """Support Agent or Admin creates ticket on customer's behalf (e.g., via phone hotline)."""
    ticket = create_ticket(
        db=db,
        customer_id=payload.customer_id,
        category_id=payload.category_id,
        problem_title=payload.problem_title,
        problem_description=payload.problem_description,
        priority=payload.priority,
        created_by_user_id=current_user.id
    )

    try:
        check_and_flag_outage(db, service_area_id=ticket.service_area_id, category_id=ticket.category_id)
    except Exception as e:
        print(f"Outage detector hook warning: {e}")

    return _format_ticket_list_item(ticket)


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket_detail(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full ticket dossier, timeline audit history, and customer comments."""
    # Find by UUID or Ticket Code (NC-YYYY-XXXXX)
    try:
        uuid_obj = uuid.UUID(ticket_id)
        ticket = db.query(SupportTicket).filter(SupportTicket.id == uuid_obj).first()
    except ValueError:
        ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id.strip()).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found.")

    # Role Access Check
    if current_user.role == UserRole.CUSTOMER.value:
        if ticket.customer.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    elif current_user.role == UserRole.TECHNICIAN.value:
        tech = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not tech or ticket.assigned_technician_id != tech.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to unassigned ticket.")

    # Format Status History
    status_history_list = [
        TicketStatusHistoryResponse(
            id=h.id,
            old_status=h.old_status,
            new_status=h.new_status,
            changed_by_name=h.changed_by_user.full_name if h.changed_by_user else "System",
            changed_by_role=h.changed_by_user.role if h.changed_by_user else "SYSTEM",
            reason=h.reason,
            changed_at=h.changed_at
        )
        for h in ticket.status_history
    ]

    # Format Comments (filter out internal notes if Customer)
    comments_query = ticket.comments
    if current_user.role == UserRole.CUSTOMER.value:
        comments_query = [c for c in comments_query if not c.is_internal_note]

    comments_list = [
        TicketCommentResponse(
            id=c.id,
            user_id=c.user_id,
            user_name=c.user.full_name if c.user else "User",
            user_role=c.user.role if c.user else "USER",
            comment_text=c.comment_text,
            is_internal_note=c.is_internal_note,
            created_at=c.created_at
        )
        for c in comments_query
    ]

    feedback_data = None
    if ticket.feedback:
        feedback_data = {
            "rating": ticket.feedback.rating,
            "is_issue_resolved": ticket.feedback.is_issue_resolved,
            "customer_comments": ticket.feedback.customer_comments,
            "submitted_at": ticket.feedback.submitted_at.isoformat()
        }

    return TicketDetailResponse(
        id=ticket.id,
        ticket_id=ticket.ticket_id,
        customer_id=ticket.customer_id,
        customer_code=ticket.customer.customer_code,
        customer_name=ticket.customer.user.full_name,
        customer_phone=ticket.customer.user.phone_number,
        customer_email=ticket.customer.user.email,
        installation_address=ticket.customer.installation_address,
        ip_address=ticket.customer.ip_address,
        onu_mac_address=ticket.customer.onu_mac_address,
        package_name=ticket.customer.package.name if ticket.customer.package else None,
        speed_mbps=ticket.customer.package.speed_mbps if ticket.customer.package else None,
        service_area_id=ticket.service_area_id,
        service_area_name=ticket.service_area.name if ticket.service_area else "N/A",
        category_id=ticket.category_id,
        category_name=ticket.category.name if ticket.category else "General",
        sla_target_hours=ticket.category.sla_target_hours if ticket.category else 8,
        priority=ticket.priority,
        status=ticket.status,
        problem_title=ticket.problem_title,
        problem_description=ticket.problem_description,
        assigned_technician_id=ticket.assigned_technician_id,
        assigned_technician_name=ticket.assigned_technician.user.full_name if ticket.assigned_technician and ticket.assigned_technician.user else None,
        assigned_technician_code=ticket.assigned_technician.employee_code if ticket.assigned_technician else None,
        assigned_technician_phone=ticket.assigned_technician.user.phone_number if ticket.assigned_technician and ticket.assigned_technician.user else None,
        resolution_notes=ticket.resolution_notes,
        resolved_at=ticket.resolved_at,
        closed_at=ticket.closed_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        status_history=status_history_list,
        comments=comments_list,
        feedback=feedback_data
    )


@router.post("/{ticket_id}/assign", response_model=TicketDetailResponse)
def assign_ticket_technician(
    ticket_id: str,
    payload: TicketAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """Assign or reassign field technician to support ticket (Admin/Agent)."""
    try:
        uuid_obj = uuid.UUID(ticket_id)
        ticket = db.query(SupportTicket).filter(SupportTicket.id == uuid_obj).first()
    except ValueError:
        ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id.strip()).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    updated_ticket = assign_technician(
        db=db,
        ticket=ticket,
        technician_id=payload.technician_id,
        assigned_by_user=current_user,
        assignment_notes=payload.notes
    )

    return get_ticket_detail(str(updated_ticket.id), db, current_user)


@router.post("/{ticket_id}/status", response_model=TicketDetailResponse)
def change_ticket_status(
    ticket_id: str,
    payload: TicketStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute status change guarded by ticket state-machine workflow."""
    try:
        uuid_obj = uuid.UUID(ticket_id)
        ticket = db.query(SupportTicket).filter(SupportTicket.id == uuid_obj).first()
    except ValueError:
        ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id.strip()).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    updated_ticket = update_ticket_status(
        db=db,
        ticket=ticket,
        new_status=payload.new_status,
        changed_by_user=current_user,
        reason=payload.reason,
        resolution_notes=payload.resolution_notes
    )

    return get_ticket_detail(str(updated_ticket.id), db, current_user)


@router.put("/{ticket_id}/priority", response_model=TicketDetailResponse)
def change_ticket_priority(
    ticket_id: str,
    payload: TicketPriorityUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """Update ticket priority level (Admin/Agent only)."""
    try:
        uuid_obj = uuid.UUID(ticket_id)
        ticket = db.query(SupportTicket).filter(SupportTicket.id == uuid_obj).first()
    except ValueError:
        ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id.strip()).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    old_priority = ticket.priority
    ticket.priority = payload.priority.upper()

    history = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=ticket.status,
        new_status=ticket.status,
        changed_by_user_id=current_user.id,
        reason=f"Priority adjusted from {old_priority} to {ticket.priority}"
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)

    return get_ticket_detail(str(ticket.id), db, current_user)


@router.post("/{ticket_id}/comments", response_model=TicketCommentResponse)
def add_ticket_comment(
    ticket_id: str,
    payload: TicketCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a customer or technician comment or internal staff note."""
    try:
        uuid_obj = uuid.UUID(ticket_id)
        ticket = db.query(SupportTicket).filter(SupportTicket.id == uuid_obj).first()
    except ValueError:
        ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id.strip()).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    # Guard: Customers cannot post internal notes
    is_internal = payload.is_internal_note
    if current_user.role == UserRole.CUSTOMER.value:
        is_internal = False
        if ticket.customer.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    comment = TicketComment(
        ticket_id=ticket.id,
        user_id=current_user.id,
        comment_text=payload.comment_text.strip(),
        is_internal_note=is_internal
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return TicketCommentResponse(
        id=comment.id,
        user_id=comment.user_id,
        user_name=current_user.full_name,
        user_role=current_user.role,
        comment_text=comment.comment_text,
        is_internal_note=comment.is_internal_note,
        created_at=comment.created_at
    )

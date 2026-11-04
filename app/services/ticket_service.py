import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.ticket import SupportTicket, TicketStatus, TicketPriority, TicketCategory
from app.models.ticket_workflow import TicketStatusHistory, TicketAssignment, TicketComment
from app.models.technician import Technician, TechnicianStatus
from app.models.customer import Customer
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationChannel


class TicketLifecycleException(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


ALLOWED_TRANSITIONS = {
    TicketStatus.NEW.value: [
        TicketStatus.ASSIGNED.value,
        TicketStatus.IN_PROGRESS.value,
        TicketStatus.RESOLVED.value,
        TicketStatus.CLOSED.value
    ],
    TicketStatus.ASSIGNED.value: [
        TicketStatus.IN_PROGRESS.value,
        TicketStatus.WAITING.value,
        TicketStatus.RESOLVED.value,
        TicketStatus.CLOSED.value
    ],
    TicketStatus.IN_PROGRESS.value: [
        TicketStatus.WAITING.value,
        TicketStatus.RESOLVED.value,
        TicketStatus.CLOSED.value
    ],
    TicketStatus.WAITING.value: [
        TicketStatus.IN_PROGRESS.value,
        TicketStatus.RESOLVED.value,
        TicketStatus.CLOSED.value
    ],
    TicketStatus.RESOLVED.value: [
        TicketStatus.CLOSED.value,
        TicketStatus.REOPENED.value
    ],
    TicketStatus.CLOSED.value: [
        TicketStatus.REOPENED.value
    ],
    TicketStatus.REOPENED.value: [
        TicketStatus.ASSIGNED.value,
        TicketStatus.IN_PROGRESS.value,
        TicketStatus.RESOLVED.value
    ]
}


def generate_ticket_code(db: Session) -> str:
    """Generate unique sequential ticket code: NC-YYYY-XXXXX."""
    current_year = datetime.now(timezone.utc).year
    # Count tickets created this year
    total_this_year = db.query(SupportTicket).filter(
        SupportTicket.ticket_id.like(f"NC-{current_year}-%")
    ).count()

    return f"NC-{current_year}-{total_this_year + 1:05d}"


def create_ticket(
    db: Session,
    customer_id: uuid.UUID,
    category_id: int,
    problem_title: str,
    problem_description: str,
    priority: Optional[str] = None,
    created_by_user_id: Optional[uuid.UUID] = None
) -> SupportTicket:
    """Create a new ticket with audit log and notification."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer record not found.")

    category = db.query(TicketCategory).filter(TicketCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket category not found.")

    ticket_code = generate_ticket_code(db)
    final_priority = priority.upper() if priority else category.default_priority

    ticket = SupportTicket(
        ticket_id=ticket_code,
        customer_id=customer.id,
        category_id=category.id,
        service_area_id=customer.service_area_id,
        priority=final_priority,
        status=TicketStatus.NEW.value,
        problem_title=problem_title.strip(),
        problem_description=problem_description.strip()
    )
    db.add(ticket)
    db.flush()

    # Initial status history entry
    actor_id = created_by_user_id or customer.user_id
    history = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status="NONE",
        new_status=TicketStatus.NEW.value,
        changed_by_user_id=actor_id,
        reason="Ticket opened by customer" if actor_id == customer.user_id else "Ticket created by support desk"
    )
    db.add(history)

    # In-app notification to customer
    notif = Notification(
        user_id=customer.user_id,
        ticket_id=ticket.id,
        title=f"Ticket {ticket.ticket_id} Created",
        message=f"Your complaint regarding '{ticket.problem_title}' has been registered. An ISP technician will be assigned shortly.",
        channel=NotificationChannel.IN_APP.value
    )
    db.add(notif)
    db.commit()
    db.refresh(ticket)
    return ticket


def assign_technician(
    db: Session,
    ticket: SupportTicket,
    technician_id: uuid.UUID,
    assigned_by_user: User,
    assignment_notes: Optional[str] = None
) -> SupportTicket:
    """Assign technician to ticket, update status to ASSIGNED, and notify customer and technician."""
    tech = db.query(Technician).filter(Technician.id == technician_id).first()
    if not tech:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found.")

    old_status = ticket.status
    ticket.assigned_technician_id = tech.id
    ticket.status = TicketStatus.ASSIGNED.value

    # Update technician status to ON_JOB
    tech.current_status = TechnicianStatus.ON_JOB.value

    # Record assignment
    assignment = TicketAssignment(
        ticket_id=ticket.id,
        technician_id=tech.id,
        assigned_by_user_id=assigned_by_user.id,
        assignment_notes=assignment_notes
    )
    db.add(assignment)

    # Record status history
    history = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=TicketStatus.ASSIGNED.value,
        changed_by_user_id=assigned_by_user.id,
        reason=f"Assigned to technician {tech.user.full_name} ({tech.employee_code}). {assignment_notes or ''}".strip()
    )
    db.add(history)

    # Notifications
    # 1. Notify Customer
    db.add(Notification(
        user_id=ticket.customer.user_id,
        ticket_id=ticket.id,
        title=f"Technician Assigned: {ticket.ticket_id}",
        message=f"Technician {tech.user.full_name} ({tech.user.phone_number}) has been assigned to your ticket.",
        channel=NotificationChannel.IN_APP.value
    ))

    # 2. Notify Technician
    db.add(Notification(
        user_id=tech.user_id,
        ticket_id=ticket.id,
        title=f"New Job Assignment: {ticket.ticket_id}",
        message=f"You have been assigned to ticket {ticket.ticket_id} at {ticket.customer.installation_address}.",
        channel=NotificationChannel.IN_APP.value
    ))

    db.commit()
    db.refresh(ticket)
    return ticket


def update_ticket_status(
    db: Session,
    ticket: SupportTicket,
    new_status: str,
    changed_by_user: User,
    reason: Optional[str] = None,
    resolution_notes: Optional[str] = None
) -> SupportTicket:
    """Strict state machine transition with role permission enforcement."""
    new_status = new_status.upper()
    old_status = ticket.status

    if old_status == new_status:
        return ticket

    # 1. Validate State Transition Validity
    allowed = ALLOWED_TRANSITIONS.get(old_status, [])
    if new_status not in allowed:
        raise TicketLifecycleException(
            f"Illegal status transition: Cannot change ticket from '{old_status}' to '{new_status}'."
        )

    # 2. Role-specific Authorization Guards
    if changed_by_user.role == UserRole.CUSTOMER.value:
        if ticket.customer.user_id != changed_by_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this ticket.")
        if new_status not in [TicketStatus.CLOSED.value, TicketStatus.REOPENED.value]:
            raise TicketLifecycleException("Customers can only close or reopen tickets.")
        if new_status == TicketStatus.CLOSED.value and old_status != TicketStatus.RESOLVED.value:
            raise TicketLifecycleException("Customers can only confirm and close tickets once they have been resolved.")
        if new_status == TicketStatus.REOPENED.value:
            if old_status not in [TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value]:
                raise TicketLifecycleException("Only resolved or closed complaints can be reopened.")
            if not reason:
                raise TicketLifecycleException("A reason is mandatory when reopening a ticket.")

    elif changed_by_user.role == UserRole.TECHNICIAN.value:
        # Technician must be assigned to this ticket
        tech = db.query(Technician).filter(Technician.user_id == changed_by_user.id).first()
        if not tech or ticket.assigned_technician_id != tech.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this ticket.")
        if new_status not in [TicketStatus.IN_PROGRESS.value, TicketStatus.WAITING.value, TicketStatus.RESOLVED.value]:
            raise TicketLifecycleException("Technicians can only set status to In Progress, Waiting, or Resolved.")
        if new_status == TicketStatus.RESOLVED.value and not resolution_notes:
            raise TicketLifecycleException("Resolution notes are required when marking a ticket as Resolved.")

    # 3. Apply Status Change
    ticket.status = new_status

    if new_status == TicketStatus.RESOLVED.value:
        ticket.resolved_at = datetime.now(timezone.utc)
        if resolution_notes:
            ticket.resolution_notes = resolution_notes.strip()
        # Mark technician assignment as completed
        if ticket.assigned_technician:
            ticket.assigned_technician.current_status = TechnicianStatus.AVAILABLE.value

    elif new_status == TicketStatus.CLOSED.value:
        ticket.closed_at = datetime.now(timezone.utc)

    elif new_status == TicketStatus.REOPENED.value:
        ticket.resolved_at = None
        ticket.closed_at = None

    # 4. Record Immutable Status History
    history = TicketStatusHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=new_status,
        changed_by_user_id=changed_by_user.id,
        reason=reason or resolution_notes or f"Status changed to {new_status}"
    )
    db.add(history)

    # 5. Dispatch In-App Notification to Customer
    status_messages = {
        TicketStatus.IN_PROGRESS.value: f"Technician is actively working on resolving your complaint ({ticket.ticket_id}).",
        TicketStatus.WAITING.value: f"Your ticket ({ticket.ticket_id}) is on hold awaiting customer response or verification.",
        TicketStatus.RESOLVED.value: f"Your ticket ({ticket.ticket_id}) has been marked as Resolved. Please review and provide feedback.",
        TicketStatus.CLOSED.value: f"Your ticket ({ticket.ticket_id}) has been closed. Thank you for using NetCare.",
        TicketStatus.REOPENED.value: f"Ticket ({ticket.ticket_id}) has been reopened for further investigation."
    }

    if new_status in status_messages and ticket.customer:
        db.add(Notification(
            user_id=ticket.customer.user_id,
            ticket_id=ticket.id,
            title=f"Ticket {ticket.ticket_id} {new_status}",
            message=status_messages[new_status],
            channel=NotificationChannel.IN_APP.value
        ))

    db.commit()
    db.refresh(ticket)
    return ticket

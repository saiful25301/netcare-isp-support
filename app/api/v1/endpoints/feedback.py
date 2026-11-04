import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.dependencies import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.customer import Customer
from app.models.technician import Technician
from app.models.ticket import SupportTicket, TicketStatus
from app.models.feedback import CustomerFeedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter()


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Customer submits 1-5 star review and issue verification after ticket resolution."""
    cust = db.query(Customer).filter(Customer.user_id == current_user.id).first()
    if not cust:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only customers can submit feedback.")

    ticket = db.query(SupportTicket).filter(SupportTicket.id == payload.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    if ticket.customer_id != cust.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this ticket.")

    if ticket.status not in [TicketStatus.RESOLVED.value, TicketStatus.CLOSED.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback can only be submitted once the ticket has been resolved."
        )

    # Check for existing feedback
    existing = db.query(CustomerFeedback).filter(CustomerFeedback.ticket_id == ticket.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Feedback has already been submitted for this ticket.")

    feedback = CustomerFeedback(
        ticket_id=ticket.id,
        customer_id=cust.id,
        rating=payload.rating,
        is_issue_resolved=payload.is_issue_resolved,
        customer_comments=payload.customer_comments.strip() if payload.customer_comments else None
    )
    db.add(feedback)
    db.flush()

    # Recalculate assigned technician rating cache
    if ticket.assigned_technician_id:
        tech = db.query(Technician).filter(Technician.id == ticket.assigned_technician_id).first()
        if tech:
            avg_rating = db.query(func.avg(CustomerFeedback.rating)).join(
                SupportTicket, CustomerFeedback.ticket_id == SupportTicket.id
            ).filter(
                SupportTicket.assigned_technician_id == tech.id
            ).scalar()

            if avg_rating is not None:
                tech.rating_cache = round(float(avg_rating), 1)

    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/ticket/{ticket_id}", response_model=FeedbackResponse)
def get_ticket_feedback(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve feedback recorded for a ticket."""
    fb = db.query(CustomerFeedback).filter(CustomerFeedback.ticket_id == ticket_id).first()
    if not fb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No feedback found.")
    return fb

import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class TicketAssignment(Base):
    __tablename__ = "ticket_assignments"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    ticket_id = Column(Uuid, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    technician_id = Column(Uuid, ForeignKey("technicians.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_by_user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    assignment_notes = Column(Text, nullable=True)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="assignments")
    technician = relationship("Technician", back_populates="assignments")


class TicketStatusHistory(Base):
    __tablename__ = "ticket_status_history"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    ticket_id = Column(Uuid, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = Column(String(32), nullable=False)
    new_status = Column(String(32), nullable=False)
    changed_by_user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="status_history")
    changed_by_user = relationship("User", back_populates="status_changes")


class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    ticket_id = Column(Uuid, ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    comment_text = Column(Text, nullable=False)
    is_internal_note = Column(Boolean, default=False, nullable=False)  # True = hidden from customer
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="comments")
    user = relationship("User", back_populates="comments")

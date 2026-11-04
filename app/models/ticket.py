import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class TicketPriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class TicketStatus(str, Enum):
    NEW = "NEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING = "WAITING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"


class TicketCategory(Base):
    __tablename__ = "ticket_categories"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    default_priority = Column(String(32), default=TicketPriority.MEDIUM.value, nullable=False)
    sla_target_hours = Column(Integer, default=8, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    tickets = relationship("SupportTicket", back_populates="category")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    ticket_id = Column(String(32), unique=True, nullable=False, index=True)  # NC-2026-00001
    customer_id = Column(Uuid, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("ticket_categories.id"), nullable=False, index=True)
    service_area_id = Column(Integer, ForeignKey("service_areas.id"), nullable=False, index=True)
    priority = Column(String(32), default=TicketPriority.MEDIUM.value, nullable=False, index=True)
    status = Column(String(32), default=TicketStatus.NEW.value, nullable=False, index=True)

    problem_title = Column(String(255), nullable=False)
    problem_description = Column(Text, nullable=False)

    assigned_technician_id = Column(Uuid, ForeignKey("technicians.id", ondelete="SET NULL"), nullable=True, index=True)
    resolution_notes = Column(Text, nullable=True)

    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    customer = relationship("Customer", back_populates="tickets")
    category = relationship("TicketCategory", back_populates="tickets")
    service_area = relationship("ServiceArea", back_populates="tickets")
    assigned_technician = relationship("Technician", back_populates="assigned_tickets")

    assignments = relationship("TicketAssignment", back_populates="ticket", cascade="all, delete-orphan")
    status_history = relationship("TicketStatusHistory", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketStatusHistory.changed_at.desc()")
    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketComment.created_at.asc()")
    feedback = relationship("CustomerFeedback", back_populates="ticket", uselist=False, cascade="all, delete-orphan")

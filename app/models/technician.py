import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class TechnicianStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ON_JOB = "ON_JOB"
    OFF_DUTY = "OFF_DUTY"


class Technician(Base):
    __tablename__ = "technicians"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    employee_code = Column(String(32), unique=True, nullable=False, index=True)  # e.g., NC-TECH-01
    primary_area_id = Column(Integer, ForeignKey("service_areas.id"), nullable=False, index=True)
    specialization = Column(String(128), default="Fiber Line & Network Configuration", nullable=False)
    current_status = Column(String(32), default=TechnicianStatus.AVAILABLE.value, nullable=False, index=True)
    rating_cache = Column(Float, default=5.0, nullable=False)

    # Relationships
    user = relationship("User", back_populates="technician_profile")
    primary_area = relationship("ServiceArea", back_populates="technicians")
    assigned_tickets = relationship("SupportTicket", back_populates="assigned_technician")
    assignments = relationship("TicketAssignment", back_populates="technician")

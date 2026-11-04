import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Boolean, Column, DateTime, String, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    AGENT = "AGENT"
    TECHNICIAN = "TECHNICIAN"
    CUSTOMER = "CUSTOMER"


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(32), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(32), default=UserRole.CUSTOMER.value, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # 1-to-1 relationships for specialized profiles
    customer_profile = relationship("Customer", back_populates="user", uselist=False, cascade="all, delete-orphan")
    technician_profile = relationship("Technician", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # Activity relationships
    status_changes = relationship("TicketStatusHistory", back_populates="changed_by_user")
    comments = relationship("TicketComment", back_populates="user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class CustomerStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    TERMINATED = "TERMINATED"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    customer_code = Column(String(32), unique=True, nullable=False, index=True)  # e.g., NC-CUST-1001
    service_area_id = Column(Integer, ForeignKey("service_areas.id"), nullable=False, index=True)
    package_id = Column(Integer, ForeignKey("internet_packages.id"), nullable=False, index=True)
    installation_address = Column(Text, nullable=False)
    ip_address = Column(String(64), nullable=True)
    onu_mac_address = Column(String(64), nullable=True)
    status = Column(String(32), default=CustomerStatus.ACTIVE.value, nullable=False, index=True)
    connection_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="customer_profile")
    service_area = relationship("ServiceArea", back_populates="customers")
    package = relationship("InternetPackage", back_populates="customers")
    tickets = relationship("SupportTicket", back_populates="customer", cascade="all, delete-orphan")
    feedbacks = relationship("CustomerFeedback", back_populates="customer")

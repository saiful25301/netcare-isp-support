from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class ServiceArea(Base):
    __tablename__ = "service_areas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    code = Column(String(32), unique=True, nullable=False, index=True)  # e.g. DHA-01
    city = Column(String(64), default="Dhaka", nullable=False)
    coverage_details = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    customers = relationship("Customer", back_populates="service_area")
    technicians = relationship("Technician", back_populates="primary_area")
    tickets = relationship("SupportTicket", back_populates="service_area")
    outages = relationship("OutageReport", back_populates="service_area")


class InternetPackage(Base):
    __tablename__ = "internet_packages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(128), unique=True, nullable=False)
    speed_mbps = Column(Integer, nullable=False)
    monthly_fee = Column(Float, nullable=False)
    connection_type = Column(String(32), default="Fiber", nullable=False)  # Fiber, Broadband
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    customers = relationship("Customer", back_populates="package")

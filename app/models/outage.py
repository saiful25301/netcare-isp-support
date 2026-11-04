import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class OutageStatus(str, Enum):
    SUSPECTED = "SUSPECTED"
    CONFIRMED = "CONFIRMED"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"


class OutageReport(Base):
    __tablename__ = "outage_reports"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    outage_code = Column(String(32), unique=True, nullable=False, index=True)  # OUT-2026-0001
    service_area_id = Column(Integer, ForeignKey("service_areas.id"), nullable=False, index=True)
    status = Column(String(32), default=OutageStatus.SUSPECTED.value, nullable=False, index=True)
    suspected_cause = Column(Text, nullable=True)
    correlated_ticket_count = Column(Integer, default=1, nullable=False)
    verified_by_user_id = Column(Uuid, ForeignKey("users.id"), nullable=True)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    service_area = relationship("ServiceArea", back_populates="outages")
    verified_by_user = relationship("User")

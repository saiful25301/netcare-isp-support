import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class NotificationChannel(str, Enum):
    IN_APP = "IN_APP"
    SMS = "SMS"
    EMAIL = "EMAIL"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticket_id = Column(Uuid, ForeignKey("support_tickets.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(String(32), default=NotificationChannel.IN_APP.value, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
    ticket = relationship("SupportTicket")

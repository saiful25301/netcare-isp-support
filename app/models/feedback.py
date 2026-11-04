import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text, Uuid
from sqlalchemy.orm import relationship

from app.db.session import Base


class CustomerFeedback(Base):
    __tablename__ = "customer_feedback"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    ticket_id = Column(Uuid, ForeignKey("support_tickets.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    customer_id = Column(Uuid, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1 to 5
    is_issue_resolved = Column(Boolean, default=True, nullable=False)
    customer_comments = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    ticket = relationship("SupportTicket", back_populates="feedback")
    customer = relationship("Customer", back_populates="feedbacks")

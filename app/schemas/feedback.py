import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class FeedbackCreate(BaseModel):
    ticket_id: uuid.UUID
    rating: int = Field(..., ge=1, le=5, description="1 to 5 star rating")
    is_issue_resolved: bool = True
    customer_comments: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: uuid.UUID
    ticket_id: uuid.UUID
    customer_id: uuid.UUID
    rating: int
    is_issue_resolved: bool
    customer_comments: Optional[str] = None
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)

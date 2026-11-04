import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class OutageUpdate(BaseModel):
    status: Optional[str] = None
    suspected_cause: Optional[str] = None


class OutageResponse(BaseModel):
    id: uuid.UUID
    outage_code: str
    service_area_id: int
    service_area_name: Optional[str] = None
    service_area_code: Optional[str] = None
    status: str
    suspected_cause: Optional[str] = None
    correlated_ticket_count: int
    verified_by_user_id: Optional[uuid.UUID] = None
    verified_by_name: Optional[str] = None
    detected_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

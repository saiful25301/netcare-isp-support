import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class TicketCreate(BaseModel):
    category_id: int
    problem_title: str
    problem_description: str
    priority: Optional[str] = None


class TicketCreateOnBehalf(BaseModel):
    customer_id: uuid.UUID
    category_id: int
    problem_title: str
    problem_description: str
    priority: Optional[str] = None


class TicketAssignRequest(BaseModel):
    technician_id: uuid.UUID
    notes: Optional[str] = None


class TicketStatusUpdateRequest(BaseModel):
    new_status: str
    reason: Optional[str] = None
    resolution_notes: Optional[str] = None


class TicketPriorityUpdateRequest(BaseModel):
    priority: str


class TicketCommentCreate(BaseModel):
    comment_text: str
    is_internal_note: bool = False


class TicketCommentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    user_role: str
    comment_text: str
    is_internal_note: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketStatusHistoryResponse(BaseModel):
    id: uuid.UUID
    old_status: str
    new_status: str
    changed_by_name: str
    changed_by_role: str
    reason: Optional[str] = None
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketListItemResponse(BaseModel):
    id: uuid.UUID
    ticket_id: str
    customer_id: uuid.UUID
    customer_code: str
    customer_name: str
    customer_phone: str
    service_area_id: int
    service_area_name: str
    category_id: int
    category_name: str
    priority: str
    status: str
    problem_title: str
    assigned_technician_id: Optional[uuid.UUID] = None
    assigned_technician_name: Optional[str] = None
    assigned_technician_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketDetailResponse(BaseModel):
    id: uuid.UUID
    ticket_id: str
    customer_id: uuid.UUID
    customer_code: str
    customer_name: str
    customer_phone: str
    customer_email: str
    installation_address: str
    ip_address: Optional[str] = None
    onu_mac_address: Optional[str] = None
    package_name: Optional[str] = None
    speed_mbps: Optional[int] = None
    service_area_id: int
    service_area_name: str
    category_id: int
    category_name: str
    sla_target_hours: int
    priority: str
    status: str
    problem_title: str
    problem_description: str
    assigned_technician_id: Optional[uuid.UUID] = None
    assigned_technician_name: Optional[str] = None
    assigned_technician_code: Optional[str] = None
    assigned_technician_phone: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    status_history: List[TicketStatusHistoryResponse] = []
    comments: List[TicketCommentResponse] = []
    feedback: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)

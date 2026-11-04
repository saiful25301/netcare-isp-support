from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_roles
from app.db.session import get_db
from app.models.user import UserRole
from app.services.analytics_service import calculate_operations_analytics

router = APIRouter()


@router.get("/dashboard")
def get_dashboard_analytics(
    db: Session = Depends(get_db),
    _staff=Depends(require_roles(UserRole.ADMIN.value, UserRole.AGENT.value))
):
    """Retrieve operational KPIs, area trends, category distributions, and technician ratings."""
    return calculate_operations_analytics(db)

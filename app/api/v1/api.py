from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    areas,
    customers,
    technicians,
    tickets,
    outages,
    feedback,
    analytics,
    notifications
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Identity"])
api_router.include_router(areas.router, prefix="", tags=["ISP Master Data (Areas & Packages)"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customer Management"])
api_router.include_router(technicians.router, prefix="/technicians", tags=["Technician Management"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["Complaint & Ticket Management"])
api_router.include_router(outages.router, prefix="/outages", tags=["Network Outage Detection"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["Customer Feedback & Rating"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Admin Analytics Dashboard"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["In-App Notifications"])

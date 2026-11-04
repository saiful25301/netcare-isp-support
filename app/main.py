import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings, BASE_DIR
from app.api.v1.api import api_router
from app.db.session import SessionLocal, engine, Base
from app.db.base import *  # Load all models for metadata
from app.db.init_db import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup & shutdown events."""
    # Ensure all tables exist
    Base.metadata.create_all(bind=engine)
    # Ensure database is seeded with initial ISP master data
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception as e:
        print(f"Database seed check: {e}")
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Professional ISP Customer Support & Complaint Management System designed for Bangladesh ISP operations.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System Health"])
def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }


# Frontend static files mounting
frontend_path = os.path.join(BASE_DIR, "frontend")
if os.path.isdir(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        index_file = os.path.join(frontend_path, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return {"message": "NetCare API is running. Visit /docs for Swagger documentation."}

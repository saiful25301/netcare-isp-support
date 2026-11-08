# NetCare ISP Complaint & Customer Support System
# Production-ready Dockerfile for Render deployment

FROM python:3.11-slim

# Prevent Python from writing .pyc files & buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required for psycopg2 and cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first, then install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source and frontend
COPY alembic.ini .
COPY alembic alembic
COPY app app
COPY frontend frontend

# Expose Render's default port
EXPOSE 10000

# Use shell form so ${PORT} variable is expanded at runtime by sh
# python3 -m uvicorn avoids PATH issues (no bare 'uvicorn' command needed)
CMD ["sh", "-c", "python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]

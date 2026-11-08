# Build NetCare ISP Complaint & Customer Support System
FROM python:3.11-slim

# Prevent Python from writing .pyc files & buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source and frontend
COPY alembic.ini .
COPY alembic alembic
COPY app app
COPY frontend frontend

EXPOSE 10000

# Start FastAPI server using python3 -m uvicorn with Render dynamic port support
CMD ["sh", "-c", "python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
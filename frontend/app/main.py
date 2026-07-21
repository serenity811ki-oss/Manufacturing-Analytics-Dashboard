"""
Manufacturing Analytics Platform — FastAPI entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Interactive API docs: http://localhost:8000/docs
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import (
    auth_router, users_router, machines_router, lines_router,
    production_router, downtime_router, maintenance_router, quality_router,
    dashboard_router, reports_router,
)

# Create tables if they don't exist (use Alembic migrations in a real prod rollout)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Manufacturing Analytics Platform API",
    description="Enterprise-grade REST API for production, OEE, maintenance, and quality analytics.",
    version="1.0.0",
)

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(machines_router)
app.include_router(lines_router)
app.include_router(production_router)
app.include_router(downtime_router)
app.include_router(maintenance_router)
app.include_router(quality_router)
app.include_router(dashboard_router)
app.include_router(reports_router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "manufacturing-analytics-platform"}


# Optionally serve the built frontend from the same origin (single-container deploys).
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

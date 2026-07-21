"""
Database configuration.

Production target: PostgreSQL (set DATABASE_URL in .env, e.g.
postgresql+psycopg2://user:pass@host:5432/manufacturing_db)

Local/dev fallback: SQLite file, zero setup required, so the project
runs out of the box with `uvicorn app.main:app`.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./manufacturing.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_size=10 if not DATABASE_URL.startswith("sqlite") else None,
    max_overflow=20 if not DATABASE_URL.startswith("sqlite") else None,
) if not DATABASE_URL.startswith("sqlite") else create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a request-scoped DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

"""
Normalized relational schema for the Manufacturing Analytics Platform.

Design notes:
- Every FK is indexed (SQLAlchemy indexes FKs used in joins explicitly below).
- Enum-like fields use SQLAlchemy Enum for referential integrity at the DB level.
- Timestamps are stored UTC; aggregation happens in query layer / SQL views.
- created_at/updated_at on every table for auditability.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer,
    String, Text, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    TECHNICIAN = "technician"


class MachineStatus(str, enum.Enum):
    RUNNING = "running"
    IDLE = "idle"
    DOWN = "down"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"


class ShiftName(str, enum.Enum):
    DAY = "day"
    EVENING = "evening"
    NIGHT = "night"


class DowntimeCategory(str, enum.Enum):
    UNPLANNED_MECHANICAL = "unplanned_mechanical"
    UNPLANNED_ELECTRICAL = "unplanned_electrical"
    PLANNED_MAINTENANCE = "planned_maintenance"
    CHANGEOVER = "changeover"
    MATERIAL_SHORTAGE = "material_shortage"
    OPERATOR_BREAK = "operator_break"
    QUALITY_HOLD = "quality_hold"
    OTHER = "other"


class MaintenanceType(str, enum.Enum):
    PREVENTIVE = "preventive"
    CORRECTIVE = "corrective"
    PREDICTIVE = "predictive"
    EMERGENCY = "emergency"


class MaintenanceStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class DefectSeverity(str, enum.Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Users & Auth
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, default=gen_uuid, nullable=False)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.TECHNICIAN)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    maintenance_records = relationship("MaintenanceRecord", back_populates="technician")


# ---------------------------------------------------------------------------
# Plant hierarchy: ProductionLine -> Machine
# ---------------------------------------------------------------------------
class ProductionLine(Base):
    __tablename__ = "production_lines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255))
    location = Column(String(120))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    machines = relationship("Machine", back_populates="production_line", cascade="all, delete-orphan")


class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    machine_type = Column(String(80), nullable=False)  # CNC, Robot, Conveyor, Press, etc.
    manufacturer = Column(String(120))
    model_number = Column(String(120))
    production_line_id = Column(Integer, ForeignKey("production_lines.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(MachineStatus), default=MachineStatus.IDLE, nullable=False, index=True)
    ideal_cycle_time_seconds = Column(Float, nullable=False, default=30.0)  # design speed, for OEE performance calc
    installation_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    production_line = relationship("ProductionLine", back_populates="machines")
    production_records = relationship("ProductionRecord", back_populates="machine", cascade="all, delete-orphan")
    downtime_events = relationship("DowntimeEvent", back_populates="machine", cascade="all, delete-orphan")
    maintenance_records = relationship("MaintenanceRecord", back_populates="machine", cascade="all, delete-orphan")
    quality_records = relationship("QualityRecord", back_populates="machine", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_machine_line_status", "production_line_id", "status"),)


# ---------------------------------------------------------------------------
# Shifts
# ---------------------------------------------------------------------------
class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Enum(ShiftName), nullable=False, unique=True)
    start_time = Column(String(5), nullable=False)  # "06:00"
    end_time = Column(String(5), nullable=False)    # "14:00"


# ---------------------------------------------------------------------------
# Production
# ---------------------------------------------------------------------------
class ProductionRecord(Base):
    """One row per machine per shift per day — the core throughput/OEE fact table."""
    __tablename__ = "production_records"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=False, index=True)
    production_date = Column(DateTime, nullable=False, index=True)
    planned_production_time_minutes = Column(Float, nullable=False, default=480.0)
    units_produced = Column(Integer, nullable=False, default=0)
    units_rejected = Column(Integer, nullable=False, default=0)
    target_units = Column(Integer, nullable=False, default=0)
    operator_name = Column(String(120))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    machine = relationship("Machine", back_populates="production_records")
    shift = relationship("Shift")

    __table_args__ = (
        Index("ix_production_machine_date", "machine_id", "production_date"),
    )


# ---------------------------------------------------------------------------
# Downtime
# ---------------------------------------------------------------------------
class DowntimeEvent(Base):
    __tablename__ = "downtime_events"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    category = Column(Enum(DowntimeCategory), nullable=False, index=True)
    reason = Column(String(255), nullable=False)
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, nullable=True)  # populated on close-out
    reported_by = Column(String(120))
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    machine = relationship("Machine", back_populates="downtime_events")

    __table_args__ = (
        Index("ix_downtime_machine_start", "machine_id", "start_time"),
    )


# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------
class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    maintenance_type = Column(Enum(MaintenanceType), nullable=False, index=True)
    status = Column(Enum(MaintenanceStatus), default=MaintenanceStatus.SCHEDULED, nullable=False, index=True)
    description = Column(Text, nullable=False)
    scheduled_date = Column(DateTime, nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    cost = Column(Float, default=0.0)
    parts_replaced = Column(String(255))
    failure_code = Column(String(50))  # links to failure-mode taxonomy for predictive analytics
    created_at = Column(DateTime, default=datetime.utcnow)

    machine = relationship("Machine", back_populates="maintenance_records")
    technician = relationship("User", back_populates="maintenance_records")

    __table_args__ = (
        Index("ix_maintenance_machine_date", "machine_id", "scheduled_date"),
    )


# ---------------------------------------------------------------------------
# Quality / Scrap
# ---------------------------------------------------------------------------
class QualityRecord(Base):
    __tablename__ = "quality_records"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True)
    production_record_id = Column(Integer, ForeignKey("production_records.id", ondelete="SET NULL"), nullable=True)
    inspection_date = Column(DateTime, nullable=False, index=True)
    defect_type = Column(String(120), nullable=False)
    severity = Column(Enum(DefectSeverity), nullable=False, index=True)
    quantity_scrapped = Column(Integer, nullable=False, default=0)
    quantity_reworked = Column(Integer, nullable=False, default=0)
    root_cause = Column(String(255))
    inspector_name = Column(String(120))
    created_at = Column(DateTime, default=datetime.utcnow)

    machine = relationship("Machine", back_populates="quality_records")

    __table_args__ = (
        Index("ix_quality_machine_date", "machine_id", "inspection_date"),
    )

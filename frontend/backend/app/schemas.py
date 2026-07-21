"""Pydantic v2 schemas — request/response contracts for the API."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models import (
    UserRole, MachineStatus, ShiftName, DowntimeCategory,
    MaintenanceType, MaintenanceStatus, DefectSeverity
)


# ---------------------------------------------------------------------------
# Auth / Users
# ---------------------------------------------------------------------------
class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.TECHNICIAN


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class LoginRequest(BaseModel):
    username: str
    password: str


# ---------------------------------------------------------------------------
# Production Lines & Machines
# ---------------------------------------------------------------------------
class ProductionLineBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    is_active: bool = True


class ProductionLineCreate(ProductionLineBase):
    pass


class ProductionLineOut(ProductionLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class MachineBase(BaseModel):
    asset_tag: str
    name: str
    machine_type: str
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    production_line_id: int
    status: MachineStatus = MachineStatus.IDLE
    ideal_cycle_time_seconds: float = 30.0
    installation_date: Optional[datetime] = None
    is_active: bool = True


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    name: Optional[str] = None
    machine_type: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    production_line_id: Optional[int] = None
    status: Optional[MachineStatus] = None
    ideal_cycle_time_seconds: Optional[float] = None
    is_active: Optional[bool] = None


class MachineOut(MachineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------------------------------------------------------------------------
# Shifts
# ---------------------------------------------------------------------------
class ShiftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: ShiftName
    start_time: str
    end_time: str


# ---------------------------------------------------------------------------
# Production Records
# ---------------------------------------------------------------------------
class ProductionRecordBase(BaseModel):
    machine_id: int
    shift_id: int
    production_date: datetime
    planned_production_time_minutes: float = 480.0
    units_produced: int = 0
    units_rejected: int = 0
    target_units: int = 0
    operator_name: Optional[str] = None
    notes: Optional[str] = None


class ProductionRecordCreate(ProductionRecordBase):
    pass


class ProductionRecordUpdate(BaseModel):
    units_produced: Optional[int] = None
    units_rejected: Optional[int] = None
    target_units: Optional[int] = None
    operator_name: Optional[str] = None
    notes: Optional[str] = None


class ProductionRecordOut(ProductionRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------------------------------------------------------------------------
# Downtime
# ---------------------------------------------------------------------------
class DowntimeEventBase(BaseModel):
    machine_id: int
    shift_id: Optional[int] = None
    category: DowntimeCategory
    reason: str
    start_time: datetime
    end_time: Optional[datetime] = None
    reported_by: Optional[str] = None
    resolved: bool = False


class DowntimeEventCreate(DowntimeEventBase):
    pass


class DowntimeEventUpdate(BaseModel):
    end_time: Optional[datetime] = None
    resolved: Optional[bool] = None
    reason: Optional[str] = None
    category: Optional[DowntimeCategory] = None


class DowntimeEventOut(DowntimeEventBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    duration_minutes: Optional[float] = None


# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------
class MaintenanceRecordBase(BaseModel):
    machine_id: int
    technician_id: Optional[int] = None
    maintenance_type: MaintenanceType
    status: MaintenanceStatus = MaintenanceStatus.SCHEDULED
    description: str
    scheduled_date: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    cost: float = 0.0
    parts_replaced: Optional[str] = None
    failure_code: Optional[str] = None


class MaintenanceRecordCreate(MaintenanceRecordBase):
    pass


class MaintenanceRecordUpdate(BaseModel):
    status: Optional[MaintenanceStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    cost: Optional[float] = None
    parts_replaced: Optional[str] = None
    technician_id: Optional[int] = None


class MaintenanceRecordOut(MaintenanceRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------
class QualityRecordBase(BaseModel):
    machine_id: int
    production_record_id: Optional[int] = None
    inspection_date: datetime
    defect_type: str
    severity: DefectSeverity
    quantity_scrapped: int = 0
    quantity_reworked: int = 0
    root_cause: Optional[str] = None
    inspector_name: Optional[str] = None


class QualityRecordCreate(QualityRecordBase):
    pass


class QualityRecordOut(QualityRecordBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------------------------------------------------------------------------
# Dashboard / analytics payloads
# ---------------------------------------------------------------------------
class OEEResult(BaseModel):
    machine_id: int
    machine_name: str
    availability: float
    performance: float
    quality: float
    oee: float


class KPISummary(BaseModel):
    total_units_produced: int
    total_units_rejected: int
    overall_oee: float
    overall_availability: float
    overall_performance: float
    overall_quality: float
    total_downtime_minutes: float
    active_machines: int
    machines_down: int
    open_maintenance_alerts: int

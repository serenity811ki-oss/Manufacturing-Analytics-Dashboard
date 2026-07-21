from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/maintenance-records", tags=["Maintenance"])


@router.get("", response_model=List[schemas.MaintenanceRecordOut])
def list_records(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    machine_id: Optional[int] = None,
    maintenance_type: Optional[models.MaintenanceType] = None,
    status_filter: Optional[models.MaintenanceStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 500,
):
    q = db.query(models.MaintenanceRecord)
    if machine_id:
        q = q.filter(models.MaintenanceRecord.machine_id == machine_id)
    if maintenance_type:
        q = q.filter(models.MaintenanceRecord.maintenance_type == maintenance_type)
    if status_filter:
        q = q.filter(models.MaintenanceRecord.status == status_filter)
    if start_date:
        q = q.filter(models.MaintenanceRecord.scheduled_date >= start_date)
    if end_date:
        q = q.filter(models.MaintenanceRecord.scheduled_date <= end_date)
    return q.order_by(models.MaintenanceRecord.scheduled_date.desc()).limit(limit).all()


@router.post("", response_model=schemas.MaintenanceRecordOut, status_code=status.HTTP_201_CREATED)
def create_record(payload: schemas.MaintenanceRecordCreate, db: Session = Depends(get_db),
                   _: models.User = Depends(auth.require_manager_or_admin)):
    record = models.MaintenanceRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}", response_model=schemas.MaintenanceRecordOut)
def update_record(record_id: int, payload: schemas.MaintenanceRecordUpdate, db: Session = Depends(get_db),
                   _: models.User = Depends(auth.require_any_role)):
    record = db.query(models.MaintenanceRecord).filter(models.MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Maintenance record not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(record, k, v)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.require_admin)):
    record = db.query(models.MaintenanceRecord).filter(models.MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Maintenance record not found")
    db.delete(record)
    db.commit()
    return None

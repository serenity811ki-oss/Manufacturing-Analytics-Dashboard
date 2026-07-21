from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/production-records", tags=["Production Records"])


@router.get("", response_model=List[schemas.ProductionRecordOut])
def list_records(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    machine_id: Optional[int] = None,
    shift_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 500,
):
    q = db.query(models.ProductionRecord)
    if machine_id:
        q = q.filter(models.ProductionRecord.machine_id == machine_id)
    if shift_id:
        q = q.filter(models.ProductionRecord.shift_id == shift_id)
    if start_date:
        q = q.filter(models.ProductionRecord.production_date >= start_date)
    if end_date:
        q = q.filter(models.ProductionRecord.production_date <= end_date)
    return q.order_by(models.ProductionRecord.production_date.desc()).limit(limit).all()


@router.post("", response_model=schemas.ProductionRecordOut, status_code=status.HTTP_201_CREATED)
def create_record(payload: schemas.ProductionRecordCreate, db: Session = Depends(get_db),
                   _: models.User = Depends(auth.require_any_role)):
    record = models.ProductionRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}", response_model=schemas.ProductionRecordOut)
def update_record(record_id: int, payload: schemas.ProductionRecordUpdate, db: Session = Depends(get_db),
                   _: models.User = Depends(auth.require_manager_or_admin)):
    record = db.query(models.ProductionRecord).filter(models.ProductionRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Production record not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(record, k, v)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.require_admin)):
    record = db.query(models.ProductionRecord).filter(models.ProductionRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Production record not found")
    db.delete(record)
    db.commit()
    return None

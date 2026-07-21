from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/quality-records", tags=["Quality & Scrap"])


@router.get("", response_model=List[schemas.QualityRecordOut])
def list_records(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    machine_id: Optional[int] = None,
    severity: Optional[models.DefectSeverity] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 500,
):
    q = db.query(models.QualityRecord)
    if machine_id:
        q = q.filter(models.QualityRecord.machine_id == machine_id)
    if severity:
        q = q.filter(models.QualityRecord.severity == severity)
    if start_date:
        q = q.filter(models.QualityRecord.inspection_date >= start_date)
    if end_date:
        q = q.filter(models.QualityRecord.inspection_date <= end_date)
    return q.order_by(models.QualityRecord.inspection_date.desc()).limit(limit).all()


@router.post("", response_model=schemas.QualityRecordOut, status_code=status.HTTP_201_CREATED)
def create_record(payload: schemas.QualityRecordCreate, db: Session = Depends(get_db),
                   _: models.User = Depends(auth.require_any_role)):
    record = models.QualityRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.require_admin)):
    record = db.query(models.QualityRecord).filter(models.QualityRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Quality record not found")
    db.delete(record)
    db.commit()
    return None

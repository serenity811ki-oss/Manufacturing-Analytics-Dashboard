from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/downtime-events", tags=["Downtime Events"])


def _with_duration(event: models.DowntimeEvent) -> models.DowntimeEvent:
    if event.start_time and event.end_time:
        event.duration_minutes = round((event.end_time - event.start_time).total_seconds() / 60.0, 1)
    return event


@router.get("", response_model=List[schemas.DowntimeEventOut])
def list_events(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    machine_id: Optional[int] = None,
    category: Optional[models.DowntimeCategory] = None,
    resolved: Optional[bool] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 500,
):
    q = db.query(models.DowntimeEvent)
    if machine_id:
        q = q.filter(models.DowntimeEvent.machine_id == machine_id)
    if category:
        q = q.filter(models.DowntimeEvent.category == category)
    if resolved is not None:
        q = q.filter(models.DowntimeEvent.resolved == resolved)
    if start_date:
        q = q.filter(models.DowntimeEvent.start_time >= start_date)
    if end_date:
        q = q.filter(models.DowntimeEvent.start_time <= end_date)
    return q.order_by(models.DowntimeEvent.start_time.desc()).limit(limit).all()


@router.post("", response_model=schemas.DowntimeEventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: schemas.DowntimeEventCreate, db: Session = Depends(get_db),
                  _: models.User = Depends(auth.require_any_role)):
    event = models.DowntimeEvent(**payload.model_dump())
    event = _with_duration(event)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}", response_model=schemas.DowntimeEventOut)
def update_event(event_id: int, payload: schemas.DowntimeEventUpdate, db: Session = Depends(get_db),
                  _: models.User = Depends(auth.require_manager_or_admin)):
    event = db.query(models.DowntimeEvent).filter(models.DowntimeEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Downtime event not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(event, k, v)
    event = _with_duration(event)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.require_admin)):
    event = db.query(models.DowntimeEvent).filter(models.DowntimeEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Downtime event not found")
    db.delete(event)
    db.commit()
    return None

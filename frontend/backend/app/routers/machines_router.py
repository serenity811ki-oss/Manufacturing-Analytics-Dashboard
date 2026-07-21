from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/machines", tags=["Machines"])
lines_router = APIRouter(prefix="/api/production-lines", tags=["Production Lines"])


# ---------------------------------------------------------------------------
# Production Lines
# ---------------------------------------------------------------------------
@lines_router.get("", response_model=List[schemas.ProductionLineOut])
def list_lines(db: Session = Depends(get_db), _: models.User = Depends(auth.require_any_role)):
    return db.query(models.ProductionLine).order_by(models.ProductionLine.name).all()


@lines_router.post("", response_model=schemas.ProductionLineOut, status_code=status.HTTP_201_CREATED)
def create_line(payload: schemas.ProductionLineCreate, db: Session = Depends(get_db),
                 _: models.User = Depends(auth.require_manager_or_admin)):
    line = models.ProductionLine(**payload.model_dump())
    db.add(line)
    db.commit()
    db.refresh(line)
    return line


@lines_router.put("/{line_id}", response_model=schemas.ProductionLineOut)
def update_line(line_id: int, payload: schemas.ProductionLineCreate, db: Session = Depends(get_db),
                 _: models.User = Depends(auth.require_manager_or_admin)):
    line = db.query(models.ProductionLine).filter(models.ProductionLine.id == line_id).first()
    if not line:
        raise HTTPException(404, "Production line not found")
    for k, v in payload.model_dump().items():
        setattr(line, k, v)
    db.commit()
    db.refresh(line)
    return line


@lines_router.delete("/{line_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_line(line_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.require_admin)):
    line = db.query(models.ProductionLine).filter(models.ProductionLine.id == line_id).first()
    if not line:
        raise HTTPException(404, "Production line not found")
    db.delete(line)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Machines
# ---------------------------------------------------------------------------
@router.get("", response_model=List[schemas.MachineOut])
def list_machines(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    production_line_id: Optional[int] = None,
    status_filter: Optional[models.MachineStatus] = Query(None, alias="status"),
    search: Optional[str] = None,
):
    q = db.query(models.Machine)
    if production_line_id:
        q = q.filter(models.Machine.production_line_id == production_line_id)
    if status_filter:
        q = q.filter(models.Machine.status == status_filter)
    if search:
        like = f"%{search}%"
        q = q.filter(
            (models.Machine.name.ilike(like)) |
            (models.Machine.asset_tag.ilike(like)) |
            (models.Machine.machine_type.ilike(like))
        )
    return q.order_by(models.Machine.name).all()


@router.get("/{machine_id}", response_model=schemas.MachineOut)
def get_machine(machine_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.require_any_role)):
    machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(404, "Machine not found")
    return machine


@router.post("", response_model=schemas.MachineOut, status_code=status.HTTP_201_CREATED)
def create_machine(payload: schemas.MachineCreate, db: Session = Depends(get_db),
                    _: models.User = Depends(auth.require_manager_or_admin)):
    if db.query(models.Machine).filter(models.Machine.asset_tag == payload.asset_tag).first():
        raise HTTPException(400, "Asset tag already exists")
    machine = models.Machine(**payload.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.put("/{machine_id}", response_model=schemas.MachineOut)
def update_machine(machine_id: int, payload: schemas.MachineUpdate, db: Session = Depends(get_db),
                    _: models.User = Depends(auth.require_manager_or_admin)):
    machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(404, "Machine not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(machine, k, v)
    db.commit()
    db.refresh(machine)
    return machine


@router.delete("/{machine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_machine(machine_id: int, db: Session = Depends(get_db), _: models.User = Depends(auth.require_admin)):
    machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
    if not machine:
        raise HTTPException(404, "Machine not found")
    db.delete(machine)
    db.commit()
    return None

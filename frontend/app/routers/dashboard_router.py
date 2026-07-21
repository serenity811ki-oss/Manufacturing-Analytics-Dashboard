from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, auth, analytics

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard & Analytics"])


@router.get("/kpi-summary")
def kpi_summary(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    oee_rows = analytics.compute_oee_all_machines(db, start_date, end_date)
    n = len(oee_rows) or 1
    total_units = sum(r["units_produced"] for r in oee_rows)
    total_rejected = sum(r["units_rejected"] for r in oee_rows)
    total_downtime = sum(r["downtime_minutes"] for r in oee_rows)

    machines_down = db.query(models.Machine).filter(models.Machine.status == models.MachineStatus.DOWN).count()
    open_alerts = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.status.in_([models.MaintenanceStatus.SCHEDULED, models.MaintenanceStatus.IN_PROGRESS])
    ).count()
    active_machines = db.query(models.Machine).filter(models.Machine.is_active == True).count()  # noqa: E712

    return {
        "total_units_produced": total_units,
        "total_units_rejected": total_rejected,
        "overall_oee": round(sum(r["oee"] for r in oee_rows) / n, 2),
        "overall_availability": round(sum(r["availability"] for r in oee_rows) / n, 2),
        "overall_performance": round(sum(r["performance"] for r in oee_rows) / n, 2),
        "overall_quality": round(sum(r["quality"] for r in oee_rows) / n, 2),
        "total_downtime_minutes": round(total_downtime, 1),
        "active_machines": active_machines,
        "machines_down": machines_down,
        "open_maintenance_alerts": open_alerts,
    }


@router.get("/oee")
def oee(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    machine_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    if machine_id:
        machine = db.query(models.Machine).filter(models.Machine.id == machine_id).first()
        if not machine:
            return []
        return [analytics.compute_oee_for_machine(db, machine, start_date, end_date)]
    return analytics.compute_oee_all_machines(db, start_date, end_date)


@router.get("/mtbf-mttr")
def mtbf_mttr(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    machine_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    return analytics.compute_mtbf_mttr(db, machine_id, start_date, end_date)


@router.get("/downtime-pareto")
def downtime_pareto(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    machine_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    return analytics.downtime_pareto(db, start_date, end_date, machine_id)


@router.get("/shift-performance")
def shift_performance(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    return analytics.shift_performance(db, start_date, end_date)


@router.get("/scrap-quality")
def scrap_quality(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    return analytics.scrap_quality_summary(db, start_date, end_date)


@router.get("/production-trend")
def production_trend(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    granularity: str = Query("day", pattern="^(day|week|month|year)$"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    return analytics.production_trend(db, granularity, start_date, end_date)


@router.get("/equipment-utilization")
def equipment_utilization(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
):
    return analytics.equipment_utilization(db, start_date, end_date)


@router.get("/machine-status-overview")
def machine_status_overview(db: Session = Depends(get_db), _: models.User = Depends(auth.require_any_role)):
    from sqlalchemy import func
    rows = db.query(models.Machine.status, func.count(models.Machine.id)).group_by(models.Machine.status).all()
    return {status.value: count for status, count in rows}


@router.get("/top-bottom-machines")
def top_bottom_machines(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth.require_any_role),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    n: int = 5,
):
    rows = analytics.compute_oee_all_machines(db, start_date, end_date)
    ranked = sorted(rows, key=lambda r: r["oee"], reverse=True)
    return {"top": ranked[:n], "bottom": list(reversed(ranked[-n:])) if len(ranked) >= n else ranked}


@router.get("/maintenance-alerts")
def maintenance_alerts(db: Session = Depends(get_db), _: models.User = Depends(auth.require_any_role)):
    alerts = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.status.in_([models.MaintenanceStatus.SCHEDULED, models.MaintenanceStatus.IN_PROGRESS])
    ).order_by(models.MaintenanceRecord.scheduled_date).all()
    return [
        {
            "id": a.id,
            "machine_id": a.machine_id,
            "machine_name": a.machine.name if a.machine else None,
            "type": a.maintenance_type.value,
            "status": a.status.value,
            "description": a.description,
            "scheduled_date": a.scheduled_date,
        }
        for a in alerts
    ]

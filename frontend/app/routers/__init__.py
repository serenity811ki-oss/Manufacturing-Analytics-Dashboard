from .auth_router import router as auth_router, users_router
from .machines_router import router as machines_router, lines_router
from .production_router import router as production_router
from .downtime_router import router as downtime_router
from .maintenance_router import router as maintenance_router
from .quality_router import router as quality_router
from .dashboard_router import router as dashboard_router
from .reports_router import router as reports_router

__all__ = [
    "auth_router",
    "users_router",
    "machines_router",
    "lines_router",
    "production_router",
    "downtime_router",
    "maintenance_router",
    "quality_router",
    "dashboard_router",
    "reports_router",
]

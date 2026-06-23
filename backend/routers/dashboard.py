from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, date
from decimal import Decimal

from database import get_db
from models import FacturaVenta, UsuarioSistema
from schemas import DashboardResponse, StatsResponse, BarChartItem, FacturaListResponse
from dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

MESES_ES = {
    1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Ago", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic"
}


def _total_mes(db: Session, id_usuario: int, year: int, month: int) -> Decimal:
    """Suma totales de facturas FINALIZADAS de un mes (para ingresos reales)."""
    result = db.query(func.coalesce(func.sum(FacturaVenta.total), 0)).filter(
        FacturaVenta.id_usuario == id_usuario,
        FacturaVenta.estado == "finalizada",
        extract("year", FacturaVenta.fecha_emision) == year,
        extract("month", FacturaVenta.fecha_emision) == month,
    ).scalar()
    return Decimal(str(result))


def _total_mes_todos(db: Session, id_usuario: int, year: int, month: int) -> Decimal:
    """Suma totales de TODAS las facturas (borrador + finalizada) de un mes."""
    result = db.query(func.coalesce(func.sum(FacturaVenta.total), 0)).filter(
        FacturaVenta.id_usuario == id_usuario,
        FacturaVenta.estado != "anulada",   # excluye anuladas
        extract("year", FacturaVenta.fecha_emision) == year,
        extract("month", FacturaVenta.fecha_emision) == month,
    ).scalar()
    return Decimal(str(result))


def _variacion(actual: Decimal, anterior: Decimal) -> float:
    if anterior == 0:
        return 100.0 if actual > 0 else 0.0
    return round(float((actual - anterior) / anterior * 100), 1)


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    hoy = date.today()
    uid = current_user.id_usuario

    mes_ant  = hoy.month - 1 if hoy.month > 1 else 12
    year_ant = hoy.year if hoy.month > 1 else hoy.year - 1

    # ── "Facturado este Mes" = TODAS (no anuladas) del mes actual ──────────
    # Así el usuario ve reflejadas sus facturas aunque estén en borrador.
    facturado_mes     = _total_mes_todos(db, uid, hoy.year, hoy.month)
    facturado_mes_ant = _total_mes_todos(db, uid, year_ant, mes_ant)

    # ── "Comprobantes Emitidos" = TODOS (no anulados) ─────────────────────
    # El usuario quiere ver cuántos comprobantes ha creado, no solo los finalizados.
    total_comprobantes = db.query(func.count(FacturaVenta.id_factura)).filter(
        FacturaVenta.id_usuario == uid,
        FacturaVenta.estado != "anulada"
    ).scalar() or 0

    comprobantes_mes = db.query(func.count(FacturaVenta.id_factura)).filter(
        FacturaVenta.id_usuario == uid,
        FacturaVenta.estado != "anulada",
        extract("year", FacturaVenta.fecha_emision) == hoy.year,
        extract("month", FacturaVenta.fecha_emision) == hoy.month,
    ).scalar() or 0

    # ── "Ingresos Totales" = solo FINALIZADAS (ingresos reales cobrados) ──
    ingresos_totales = db.query(
        func.coalesce(func.sum(FacturaVenta.total), 0)
    ).filter(
        FacturaVenta.id_usuario == uid,
        FacturaVenta.estado == "finalizada"
    ).scalar()
    ingresos_totales = Decimal(str(ingresos_totales))

    ingresos_ant = db.query(
        func.coalesce(func.sum(FacturaVenta.total), 0)
    ).filter(
        FacturaVenta.id_usuario == uid,
        FacturaVenta.estado == "finalizada",
        extract("year", FacturaVenta.fecha_emision) == year_ant,
        extract("month", FacturaVenta.fecha_emision) == mes_ant,
    ).scalar()
    ingresos_ant = Decimal(str(ingresos_ant))

    stats = StatsResponse(
        facturado_mes=facturado_mes,
        facturado_mes_anterior=facturado_mes_ant,
        variacion_facturado=_variacion(facturado_mes, facturado_mes_ant),
        comprobantes_pagados=total_comprobantes,
        comprobantes_pagados_mes=comprobantes_mes,
        ingresos_totales=ingresos_totales,
        ingresos_mes_anterior=ingresos_ant,
        variacion_ingresos=_variacion(ingresos_totales, ingresos_ant)
    )

    # ── Facturas recientes: TODAS (borrador, finalizada, anulada) ─────────
    from sqlalchemy.orm import joinedload
    recientes = db.query(FacturaVenta).options(
        joinedload(FacturaVenta.cliente)
    ).filter(
        FacturaVenta.id_usuario == uid
    ).order_by(FacturaVenta.created_at.desc()).limit(5).all()

    # ── Ingresos últimos 6 meses: suma de TODOS los no anulados ───────────
    ingresos_meses = []
    for i in range(5, -1, -1):
        m = hoy.month - i
        y = hoy.year
        while m <= 0:
            m += 12
            y -= 1
        total = _total_mes_todos(db, uid, y, m)
        ingresos_meses.append(BarChartItem(mes=MESES_ES[m], total=total))

    return DashboardResponse(
        stats=stats,
        facturas_recientes=[FacturaListResponse.from_orm(f) for f in recientes],
        ingresos_por_mes=ingresos_meses
    )
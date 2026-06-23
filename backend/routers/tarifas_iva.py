"""
tarifas_iva.py — Router FastAPI para gestión de tarifas IVA
Registrar en main.py:
    from routers import tarifas_iva
    app.include_router(tarifas_iva.router)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal
from typing import Optional, List
from datetime import datetime

from database import get_db
from models import UsuarioSistema, TarifaIVA
from dependencies import get_current_user

router = APIRouter(prefix="/api/tarifas-iva", tags=["Tarifas IVA"])


# ── Schemas ───────────────────────────────────────────────

class TarifaIVAResponse(BaseModel):
    id_tarifa:   int
    codigo:      str
    porcentaje:  Decimal
    descripcion: str
    etiqueta:    str
    activa:      bool
    es_default:  bool
    nota:        Optional[str]

    class Config:
        from_attributes = True


class TarifaIVACreate(BaseModel):
    codigo:      str
    porcentaje:  Decimal
    descripcion: str
    etiqueta:    str
    nota:        Optional[str] = None


class TarifaIVAUpdate(BaseModel):
    descripcion: Optional[str] = None
    etiqueta:    Optional[str] = None
    activa:      Optional[bool] = None
    es_default:  Optional[bool] = None
    nota:        Optional[str] = None


# ── Helpers ───────────────────────────────────────────────

def require_docente(current_user: UsuarioSistema = Depends(get_current_user)):
    if current_user.rol.value != "docente":
        raise HTTPException(status_code=403, detail="Solo el docente puede gestionar tarifas")
    return current_user


# ═══════════════════════════════════════════════════════════
# GET /api/tarifas-iva/
# Estudiante y docente — lista tarifas activas para facturar
# ═══════════════════════════════════════════════════════════
@router.get("/", response_model=List[TarifaIVAResponse])
def listar_tarifas(
    solo_activas: bool = True,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    """
    Devuelve las tarifas IVA disponibles.
    - Estudiante: solo las activas (para el selector al facturar)
    - Docente con solo_activas=false: ve todas incluidas inactivas
    """
    q = db.query(TarifaIVA)
    if solo_activas or current_user.rol.value != "docente":
        q = q.filter(TarifaIVA.activa == True)
    tarifas = q.order_by(TarifaIVA.porcentaje).all()
    return tarifas


# ═══════════════════════════════════════════════════════════
# GET /api/tarifas-iva/default
# Devuelve la tarifa marcada como default
# ═══════════════════════════════════════════════════════════
@router.get("/default", response_model=TarifaIVAResponse)
def tarifa_default(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    tarifa = db.query(TarifaIVA).filter(
        TarifaIVA.es_default == True,
        TarifaIVA.activa == True
    ).first()
    if not tarifa:
        # Fallback: la mayor porcentaje activa
        tarifa = db.query(TarifaIVA).filter(
            TarifaIVA.activa == True
        ).order_by(TarifaIVA.porcentaje.desc()).first()
    if not tarifa:
        raise HTTPException(status_code=404, detail="No hay tarifas IVA configuradas")
    return tarifa


# ═══════════════════════════════════════════════════════════
# POST /api/tarifas-iva/          [solo docente]
# Crear nueva tarifa (ej: IVA 17%)
# ═══════════════════════════════════════════════════════════
@router.post("/", response_model=TarifaIVAResponse, status_code=201)
def crear_tarifa(
    data: TarifaIVACreate,
    db: Session = Depends(get_db),
    docente: UsuarioSistema = Depends(require_docente),
):
    # Verificar que no exista el mismo código
    if db.query(TarifaIVA).filter(TarifaIVA.codigo == data.codigo).first():
        raise HTTPException(status_code=400, detail=f"Ya existe una tarifa con código '{data.codigo}'")

    # Verificar que no exista el mismo porcentaje
    if db.query(TarifaIVA).filter(TarifaIVA.porcentaje == data.porcentaje).first():
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe una tarifa con {data.porcentaje}%. Puedes reactivarla en lugar de crear una nueva."
        )

    nueva = TarifaIVA(
        codigo=data.codigo.upper(),
        porcentaje=data.porcentaje,
        descripcion=data.descripcion,
        etiqueta=data.etiqueta or f"{int(data.porcentaje)}%",
        activa=True,
        es_default=False,
        nota=data.nota,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


# ═══════════════════════════════════════════════════════════
# PATCH /api/tarifas-iva/{id}     [solo docente]
# Editar tarifa (activar, desactivar, cambiar default, nota)
# ═══════════════════════════════════════════════════════════
@router.patch("/{id_tarifa}", response_model=TarifaIVAResponse)
def actualizar_tarifa(
    id_tarifa: int,
    data: TarifaIVAUpdate,
    db: Session = Depends(get_db),
    docente: UsuarioSistema = Depends(require_docente),
):
    tarifa = db.query(TarifaIVA).filter(TarifaIVA.id_tarifa == id_tarifa).first()
    if not tarifa:
        raise HTTPException(status_code=404, detail="Tarifa no encontrada")

    if data.descripcion is not None: tarifa.descripcion = data.descripcion
    if data.etiqueta    is not None: tarifa.etiqueta    = data.etiqueta
    if data.activa      is not None: tarifa.activa      = data.activa
    if data.nota        is not None: tarifa.nota        = data.nota

    # Si se marca como default, quitar el default de las demás
    if data.es_default is True:
        db.query(TarifaIVA).filter(TarifaIVA.es_default == True).update({"es_default": False})
        tarifa.es_default = True

    db.commit()
    db.refresh(tarifa)
    return tarifa


# ═══════════════════════════════════════════════════════════
# DELETE /api/tarifas-iva/{id}    [solo docente]
# Solo se puede eliminar si no tiene facturas asociadas
# ═══════════════════════════════════════════════════════════
@router.delete("/{id_tarifa}", status_code=204)
def eliminar_tarifa(
    id_tarifa: int,
    db: Session = Depends(get_db),
    docente: UsuarioSistema = Depends(require_docente),
):
    tarifa = db.query(TarifaIVA).filter(TarifaIVA.id_tarifa == id_tarifa).first()
    if not tarifa:
        raise HTTPException(status_code=404, detail="Tarifa no encontrada")

    if tarifa.es_default:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar la tarifa default. Asigna otra como default primero."
        )

    # En lugar de eliminar, desactivar (preserva historial)
    tarifa.activa = False
    db.commit()
    return None
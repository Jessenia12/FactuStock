from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
import os, uuid

from database import get_db
from models import UsuarioSistema, FacturaVenta, SesionUsuario, ParametroSistema
from auth import verificar_password, obtener_password_hash
from dependencies import get_current_user

router = APIRouter(prefix="/api/perfil", tags=["Perfil"])

UPLOAD_DIR = "uploads/fotos_perfil"
os.makedirs(UPLOAD_DIR, exist_ok=True)

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAX = 2 * 1024 * 1024  # 2 MB

# ─── Schemas ──────────────────────────────────────────────
class ActualizarPerfilRequest(BaseModel):
    nombres:   Optional[str] = None
    apellidos: Optional[str] = None
    email:     Optional[str] = None
    curso:     Optional[str] = None
    paralelo:  Optional[str] = None

class CambiarPasswordRequest(BaseModel):
    password_actual: str
    password_nueva:  str
    confirmar:       str

class VerificarPasswordRequest(BaseModel):
    password_actual: str


# ─── GET /api/perfil/ ─────────────────────────────────────
@router.get("/")
def obtener_perfil(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    total_facturas = db.query(func.count(FacturaVenta.id_factura)).filter(
        FacturaVenta.id_usuario == current_user.id_usuario
    ).scalar() or 0

    facturas_mes = db.query(func.count(FacturaVenta.id_factura)).filter(
        FacturaVenta.id_usuario == current_user.id_usuario,
        func.month(FacturaVenta.fecha_emision) == datetime.now().month,
        func.year(FacturaVenta.fecha_emision)  == datetime.now().year,
    ).scalar() or 0

    total_facturado = db.query(
        func.coalesce(func.sum(FacturaVenta.total), 0)
    ).filter(
        FacturaVenta.id_usuario == current_user.id_usuario,
        FacturaVenta.estado == "finalizada"
    ).scalar() or 0

    ultima_actividad = db.query(SesionUsuario).filter(
        SesionUsuario.id_usuario == current_user.id_usuario
    ).order_by(SesionUsuario.created_at.desc()).first()

    foto_url = None
    if hasattr(current_user, 'foto_perfil') and current_user.foto_perfil:
        foto_url = f"/uploads/fotos_perfil/{current_user.foto_perfil}"

    return {
        "id_usuario":    current_user.id_usuario,
        "cedula":        current_user.cedula,
        "nombres":       current_user.nombres,
        "apellidos":     current_user.apellidos,
        "email":         current_user.email,
        "rol":           current_user.rol,
        "curso":         getattr(current_user, 'curso', None),
        "paralelo":      getattr(current_user, 'paralelo', None),
        "estado":        current_user.estado,
        "foto_url":      foto_url,
        "miembro_desde": str(current_user.created_at.date()) if current_user.created_at else None,
        "stats": {
            "total_facturas":  total_facturas,
            "facturas_mes":    facturas_mes,
            "total_facturado": float(total_facturado),
        },
        "ultima_sesion": str(ultima_actividad.created_at) if ultima_actividad else None,
    }


# ─── PATCH /api/perfil/ ───────────────────────────────────
@router.patch("/")
def actualizar_perfil(
    datos: ActualizarPerfilRequest,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    if datos.email and datos.email != current_user.email:
        existe = db.query(UsuarioSistema).filter(
            UsuarioSistema.email == datos.email,
            UsuarioSistema.id_usuario != current_user.id_usuario
        ).first()
        if existe:
            raise HTTPException(status_code=400, detail="El email ya está en uso por otra cuenta.")

    if datos.nombres:              current_user.nombres   = datos.nombres.strip()
    if datos.apellidos:            current_user.apellidos = datos.apellidos.strip()
    if datos.email:                current_user.email     = datos.email.strip().lower()
    if datos.curso is not None:    current_user.curso     = datos.curso or None
    if datos.paralelo is not None: current_user.paralelo  = datos.paralelo or None

    db.commit()
    db.refresh(current_user)
    return {
        "mensaje":   "Perfil actualizado correctamente",
        "nombres":   current_user.nombres,
        "apellidos": current_user.apellidos,
        "email":     current_user.email,
        "curso":     getattr(current_user, 'curso', None),
        "paralelo":  getattr(current_user, 'paralelo', None),
    }


# ─── POST /api/perfil/foto ────────────────────────────────
@router.post("/foto")
async def subir_foto(
    foto: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    filename = foto.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if not ext:
        ct = foto.content_type or ""
        ext_map = {
            "image/jpeg": ".jpg",
            "image/png":  ".png",
            "image/webp": ".webp",
            "image/gif":  ".gif",
        }
        ext = ext_map.get(ct, "")

    if ext not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no permitido. Usa: JPG, PNG, WEBP o GIF"
        )

    contenido = await foto.read()
    if len(contenido) > TAMANO_MAX:
        raise HTTPException(status_code=400, detail="La imagen no debe superar 2 MB.")

    # Eliminar foto anterior si existe
    if hasattr(current_user, 'foto_perfil') and current_user.foto_perfil:
        ruta_anterior = os.path.join(UPLOAD_DIR, current_user.foto_perfil)
        if os.path.exists(ruta_anterior):
            try:
                os.remove(ruta_anterior)
            except Exception:
                pass

    # Guardar nuevo archivo
    nombre_archivo = f"{current_user.id_usuario}_{uuid.uuid4().hex}{ext}"
    ruta_destino   = os.path.join(UPLOAD_DIR, nombre_archivo)
    with open(ruta_destino, "wb") as f:
        f.write(contenido)

    foto_url = f"/uploads/fotos_perfil/{nombre_archivo}"

    # Guardar en BD (solo foto_perfil del usuario, NO toca NEGOCIO_LOGO)
    if hasattr(current_user, 'foto_perfil'):
        current_user.foto_perfil = nombre_archivo
        db.commit()
        db.refresh(current_user)

    return {
        "mensaje":  "Foto de perfil actualizada correctamente",
        "foto_url": foto_url,
    }


# ─── DELETE /api/perfil/foto ──────────────────────────────
@router.delete("/foto")
def eliminar_foto(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    if not hasattr(current_user, 'foto_perfil') or not current_user.foto_perfil:
        raise HTTPException(status_code=404, detail="No tienes una foto de perfil.")

    ruta = os.path.join(UPLOAD_DIR, current_user.foto_perfil)
    if os.path.exists(ruta):
        try:
            os.remove(ruta)
        except Exception:
            pass

    current_user.foto_perfil = None
    db.commit()

    return {"mensaje": "Foto eliminada correctamente"}


# ─── POST /api/perfil/verificar-password ──────────────────
@router.post("/verificar-password")
def verificar_password_actual(
    datos: VerificarPasswordRequest,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    if not verificar_password(datos.password_actual, current_user.password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
    return {"verificado": True, "mensaje": "Contraseña verificada correctamente"}


# ─── POST /api/perfil/cambiar-password ────────────────────
@router.post("/cambiar-password")
def cambiar_password(
    datos: CambiarPasswordRequest,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    if not verificar_password(datos.password_actual, current_user.password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
    if datos.password_nueva != datos.confirmar:
        raise HTTPException(status_code=400, detail="Las contraseñas nuevas no coinciden.")
    if len(datos.password_nueva) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")
    if datos.password_nueva == datos.password_actual:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser diferente a la actual.")

    current_user.password = obtener_password_hash(datos.password_nueva)
    db.commit()
    return {"mensaje": "Contraseña actualizada correctamente"}


# ─── GET /api/perfil/actividad ────────────────────────────
@router.get("/actividad")
def obtener_actividad(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    sesiones = db.query(SesionUsuario).filter(
        SesionUsuario.id_usuario == current_user.id_usuario
    ).order_by(SesionUsuario.created_at.desc()).limit(10).all()

    return {
        "sesiones": [
            {
                "id":         s.id_sesion,
                "created_at": str(s.created_at),
                "activa":     getattr(s, "activa", True),
            }
            for s in sesiones
        ]
    }
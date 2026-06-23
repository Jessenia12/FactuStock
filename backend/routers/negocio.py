from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import os, uuid

from database import get_db
from models import ParametroSistema, UsuarioSistema
from dependencies import get_current_user

router = APIRouter(prefix="/api/negocio", tags=["Negocio"])

# ── Claves que se guardan en parametros_sistema por usuario ──
CLAVES_NEGOCIO = [
    "NEGOCIO_RUC",
    "NEGOCIO_RAZON_SOCIAL",
    "NEGOCIO_NOMBRE",           # nombre comercial
    "NEGOCIO_DIRECCION_MATRIZ",
    "NEGOCIO_DIRECCION_SUCURSAL",
    "NEGOCIO_TELEFONO",
    "NEGOCIO_EMAIL",
    "NEGOCIO_CONTRIBUYENTE",    # ej: RIMPE - Emprendedores
    "NEGOCIO_AMBIENTE",         # Pruebas / Producción
    "NEGOCIO_SERIE_ESTAB",      # 001
    "NEGOCIO_SERIE_EMISION",    # 001
    "NEGOCIO_OBLIGADO_CONT",    # "SI" / "NO"
    "NEGOCIO_LOGO",             # URL relativa al servidor
]

UPLOAD_DIR = "uploads/logos_negocio"
os.makedirs(UPLOAD_DIR, exist_ok=True)

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TAMANO_MAX = 2 * 1024 * 1024  # 2 MB


# ── Schemas ───────────────────────────────────────────────
class NegocioSchema(BaseModel):
    ruc:                  Optional[str] = ""
    razon_social:         Optional[str] = ""
    nombre_comercial:     Optional[str] = ""
    direccion_matriz:     Optional[str] = ""
    direccion_sucursal:   Optional[str] = ""
    telefono:             Optional[str] = ""
    email:                Optional[str] = ""
    contribuyente:        Optional[str] = "RIMPE - Emprendedores"
    ambiente:             Optional[str] = "Pruebas"
    serie_establecimiento:Optional[str] = "001"
    serie_punto_emision:  Optional[str] = "001"
    obligado_contabilidad:Optional[bool] = False
    logo_url:             Optional[str] = ""


def _filas_a_dict(filas) -> dict:
    return {p.clave: p.valor for p in filas}


def _dict_a_schema(d: dict) -> NegocioSchema:
    return NegocioSchema(
        ruc                  = d.get("NEGOCIO_RUC", ""),
        razon_social         = d.get("NEGOCIO_RAZON_SOCIAL", ""),
        nombre_comercial     = d.get("NEGOCIO_NOMBRE", ""),
        direccion_matriz     = d.get("NEGOCIO_DIRECCION_MATRIZ", ""),
        direccion_sucursal   = d.get("NEGOCIO_DIRECCION_SUCURSAL", ""),
        telefono             = d.get("NEGOCIO_TELEFONO", ""),
        email                = d.get("NEGOCIO_EMAIL", ""),
        contribuyente        = d.get("NEGOCIO_CONTRIBUYENTE", "RIMPE - Emprendedores"),
        ambiente             = d.get("NEGOCIO_AMBIENTE", "Pruebas"),
        serie_establecimiento= d.get("NEGOCIO_SERIE_ESTAB", "001"),
        serie_punto_emision  = d.get("NEGOCIO_SERIE_EMISION", "001"),
        obligado_contabilidad= d.get("NEGOCIO_OBLIGADO_CONT", "NO") == "SI",
        logo_url             = d.get("NEGOCIO_LOGO", ""),
    )


def _upsert_param(db: Session, id_usuario: int, clave: str, valor: str):
    """Upsert de un único parámetro."""
    param = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == id_usuario,
        ParametroSistema.clave == clave
    ).first()
    if param:
        param.valor = valor
    else:
        db.add(ParametroSistema(
            id_usuario  = id_usuario,
            clave       = clave,
            valor       = valor,
            descripcion = "Dato del negocio"
        ))


# ── GET /api/negocio ──────────────────────────────────────
@router.get("/", response_model=NegocioSchema)
def obtener_negocio(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    filas = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == current_user.id_usuario
    ).all()
    return _dict_a_schema(_filas_a_dict(filas))


# ── PUT /api/negocio ──────────────────────────────────────
@router.put("/", response_model=NegocioSchema)
def guardar_negocio(
    datos: NegocioSchema,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    nuevo = {
        "NEGOCIO_RUC":              datos.ruc or "",
        "NEGOCIO_RAZON_SOCIAL":     datos.razon_social or "",
        "NEGOCIO_NOMBRE":           datos.nombre_comercial or "",
        "NEGOCIO_DIRECCION_MATRIZ": datos.direccion_matriz or "",
        "NEGOCIO_DIRECCION_SUCURSAL": datos.direccion_sucursal or "",
        "NEGOCIO_TELEFONO":         datos.telefono or "",
        "NEGOCIO_EMAIL":            datos.email or "",
        "NEGOCIO_CONTRIBUYENTE":    datos.contribuyente or "",
        "NEGOCIO_AMBIENTE":         datos.ambiente or "Pruebas",
        "NEGOCIO_SERIE_ESTAB":      datos.serie_establecimiento or "001",
        "NEGOCIO_SERIE_EMISION":    datos.serie_punto_emision or "001",
        "NEGOCIO_OBLIGADO_CONT":    "SI" if datos.obligado_contabilidad else "NO",
        # NEGOCIO_LOGO no se toca aquí; se gestiona por el endpoint dedicado /logo
    }

    existentes = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == current_user.id_usuario
    ).all()
    existentes_dict = {p.clave: p for p in existentes}

    for clave, valor in nuevo.items():
        if clave in existentes_dict:
            existentes_dict[clave].valor = valor
        else:
            db.add(ParametroSistema(
                id_usuario  = current_user.id_usuario,
                clave       = clave,
                valor       = valor,
                descripcion = "Dato del negocio"
            ))

    db.commit()

    filas = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == current_user.id_usuario
    ).all()
    return _dict_a_schema(_filas_a_dict(filas))


# ── POST /api/negocio/logo ────────────────────────────────
@router.post("/logo")
async def subir_logo(
    logo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    """Sube el logo del negocio. Independiente de la foto de perfil del usuario."""
    filename = logo.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if not ext:
        ct = logo.content_type or ""
        ext_map = {"image/jpeg": ".jpg", "image/png": ".png",
                   "image/webp": ".webp", "image/gif": ".gif"}
        ext = ext_map.get(ct, "")

    if ext not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(
            status_code=400,
            detail="Tipo de archivo no permitido. Usa: JPG, PNG, WEBP o GIF"
        )

    contenido = await logo.read()
    if len(contenido) > TAMANO_MAX:
        raise HTTPException(status_code=400, detail="La imagen no debe superar 2 MB.")

    # Eliminar logo anterior si existe
    param_actual = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == current_user.id_usuario,
        ParametroSistema.clave == "NEGOCIO_LOGO"
    ).first()

    if param_actual and param_actual.valor:
        # Si es una URL de logos_negocio, borrar el archivo
        if "logos_negocio" in param_actual.valor:
            nombre_anterior = os.path.basename(param_actual.valor.split("?")[0])
            ruta_anterior = os.path.join(UPLOAD_DIR, nombre_anterior)
            if os.path.exists(ruta_anterior):
                try:
                    os.remove(ruta_anterior)
                except Exception:
                    pass

    # Guardar nuevo archivo
    nombre_archivo = f"logo_{current_user.id_usuario}_{uuid.uuid4().hex}{ext}"
    ruta_destino   = os.path.join(UPLOAD_DIR, nombre_archivo)
    with open(ruta_destino, "wb") as f:
        f.write(contenido)

    logo_url = f"/uploads/logos_negocio/{nombre_archivo}"

    _upsert_param(db, current_user.id_usuario, "NEGOCIO_LOGO", logo_url)
    db.commit()

    return {"mensaje": "Logo actualizado correctamente", "logo_url": logo_url}


# ── DELETE /api/negocio/logo ──────────────────────────────
@router.delete("/logo")
def eliminar_logo(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    """Elimina el logo del negocio."""
    param = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == current_user.id_usuario,
        ParametroSistema.clave == "NEGOCIO_LOGO"
    ).first()

    if not param or not param.valor:
        raise HTTPException(status_code=404, detail="No hay logo configurado.")

    if "logos_negocio" in param.valor:
        nombre = os.path.basename(param.valor.split("?")[0])
        ruta = os.path.join(UPLOAD_DIR, nombre)
        if os.path.exists(ruta):
            try:
                os.remove(ruta)
            except Exception:
                pass

    param.valor = ""
    db.commit()

    return {"mensaje": "Logo eliminado correctamente"}
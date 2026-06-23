"""
routers/recuperar_password.py

SMTP con Gmail — configurar en .env:
    GMAIL_USER=factustocknotificaciones@gmail.com
    GMAIL_APP_PASSWORD=ryeofghgmoydgdvr

El envío de correo se hace en un hilo separado (threading)
para que el servidor responda al instante sin esperar a Gmail.

ESTUDIANTE:
  POST /api/auth/solicitar-recuperacion

DOCENTE:
  GET  /api/auth/solicitudes-recuperacion
  POST /api/auth/aprobar-recuperacion/{id}
  POST /api/auth/enviar-correo-recuperacion/{id}
  POST /api/auth/rechazar-recuperacion/{id}
  POST /api/auth/resetear-password-forzado

RECUPERACIÓN DEL DOCENTE:
  POST /api/auth/recuperar-docente
"""

import os, enum, string, secrets, smtplib, threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, relationship
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func
from pydantic import BaseModel
from dotenv import load_dotenv

from database import get_db, Base
from models import UsuarioSistema
from auth import obtener_password_hash, verificar_token

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Recuperación de Contraseña"])

EMAIL_USER     = os.getenv("GMAIL_USER", "")
EMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
SMTP_HOST      = "smtp.gmail.com"
SMTP_PORT      = 465


# ─── Enum ─────────────────────────────────────────────────
class EstadoSolicitudEnum(str, enum.Enum):
    pendiente = "pendiente"
    aprobada  = "aprobada"
    rechazada = "rechazada"


# ─── Modelo BD ───────────────────────────────────────────
class SolicitudRecuperacion(Base):
    __tablename__ = "solicitudes_recuperacion"

    id_solicitud  = Column(Integer, primary_key=True, index=True)
    id_usuario    = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    motivo        = Column(Text, nullable=True)
    estado        = Column(SAEnum(EstadoSolicitudEnum), default=EstadoSolicitudEnum.pendiente, nullable=False)
    password_temp = Column(String(100), nullable=True)
    created_at    = Column(DateTime, default=func.now())
    updated_at    = Column(DateTime, default=func.now(), onupdate=func.now())
    atendida_por  = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=True)

    usuario = relationship("UsuarioSistema", foreign_keys=[id_usuario])
    docente = relationship("UsuarioSistema", foreign_keys=[atendida_por])


# ─── Schemas ─────────────────────────────────────────────
class SolicitudRequest(BaseModel):
    cedula_o_email: str
    motivo: Optional[str] = None

class AprobarRequest(BaseModel):
    token_docente: str

class EnviarCorreoRequest(BaseModel):
    token_docente: str

class RechazarRequest(BaseModel):
    token_docente: str
    motivo_rechazo: Optional[str] = None

class ResetForzadoRequest(BaseModel):
    token_docente: str
    id_usuario: int
    nueva_password: str

class RecuperarDocenteRequest(BaseModel):
    cedula: str


# ─── Helpers ─────────────────────────────────────────────
def get_docente_from_token(token: str, db: Session) -> UsuarioSistema:
    payload = verificar_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    if payload.get("rol") != "docente":
        raise HTTPException(status_code=403, detail="Solo el docente puede realizar esta acción")
    usuario = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == int(payload["sub"])
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Docente no encontrado")
    return usuario


def generar_password_temporal() -> str:
    chars = (
        string.ascii_letters.replace('l','').replace('I','').replace('O','')
        + string.digits.replace('0','')
    )
    return ''.join(secrets.choice(chars) for _ in range(10))


def _enviar_email_tarea(destinatario: str, nombre: str, password_temp: str, para_docente: bool):
    """
    Tarea real de envío — se ejecuta en un hilo separado.
    El servidor no espera a que termine; responde al instante.
    """
    if not EMAIL_USER or not EMAIL_PASSWORD:
        print("[EMAIL] GMAIL_USER o GMAIL_APP_PASSWORD no configurados en .env")
        return

    intro = (
        "Recibimos una solicitud para restablecer tu contraseña de docente."
        if para_docente
        else "El docente ha aprobado tu solicitud de recuperación de contraseña."
    )

    cuerpo_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:28px;font-weight:900;color:#15389a;margin:0;">FactuStock</h1>
        <p style="font-size:13px;color:#94a3b8;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">Sistema educativo de gestión</p>
      </div>
      <div style="background:#ffffff;border-radius:12px;padding:28px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <p style="font-size:15px;color:#334155;margin:0 0 8px;">Hola, <strong>{nombre}</strong>.</p>
        <p style="font-size:14px;color:#64748b;margin:0 0 24px;line-height:1.6;">{intro}</p>
        <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:18px;text-align:center;margin-bottom:24px;">
          <p style="font-size:11px;color:#64748b;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Tu contraseña temporal</p>
          <p style="font-family:monospace;font-size:28px;font-weight:700;color:#15803d;margin:0;letter-spacing:4px;">{password_temp}</p>
        </div>
        <ol style="font-size:13px;color:#64748b;margin:0 0 24px;padding-left:20px;line-height:1.8;">
          <li>Inicia sesión con esta contraseña temporal.</li>
          <li>Ve a tu <strong>Perfil</strong> y cámbiala por una nueva.</li>
        </ol>
        <div style="background:#fff7ed;border-left:3px solid #fb923c;border-radius:6px;padding:12px 14px;">
          <p style="font-size:12px;color:#9a3412;margin:0;">⚠️ Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      </div>
      <p style="font-size:11px;color:#94a3b8;text-align:center;margin:20px 0 0;">
        Unidad Educativa José Ramón Zambrano Bravo — FactuStock
      </p>
    </div>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "FactuStock — Tu contraseña temporal"
        msg["From"]    = f"FactuStock <{EMAIL_USER}>"
        msg["To"]      = destinatario
        msg.attach(MIMEText(cuerpo_html, "html", "utf-8"))
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.sendmail(EMAIL_USER, destinatario, msg.as_string())
        print(f"[EMAIL OK] Correo enviado a {destinatario}")
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")


def enviar_email_en_fondo(destinatario: str, nombre: str, password_temp: str, para_docente: bool = False):
    """
    Lanza el envío de correo en un hilo separado.
    El endpoint responde de inmediato sin esperar a Gmail.
    """
    hilo = threading.Thread(
        target=_enviar_email_tarea,
        args=(destinatario, nombre, password_temp, para_docente),
        daemon=True
    )
    hilo.start()


# ══════════════════════════════════════════════════════════
# ESTUDIANTE
# ══════════════════════════════════════════════════════════

@router.post("/solicitar-recuperacion")
def solicitar_recuperacion(datos: SolicitudRequest, db: Session = Depends(get_db)):
    cedula_email = datos.cedula_o_email.strip()
    usuario = db.query(UsuarioSistema).filter(
        (UsuarioSistema.cedula == cedula_email) |
        (UsuarioSistema.email  == cedula_email.lower())
    ).first()

    if not usuario:
        return {"ok": False, "mensaje": "No encontramos una cuenta con esa cédula o correo. Verifica los datos."}
    if not usuario.estado:
        return {"ok": False, "mensaje": "Tu cuenta está inactiva. Habla directamente con el docente."}

    existente = db.query(SolicitudRecuperacion).filter(
        SolicitudRecuperacion.id_usuario == usuario.id_usuario,
        SolicitudRecuperacion.estado     == EstadoSolicitudEnum.pendiente
    ).first()
    if existente:
        return {"ok": True, "ya_existia": True, "mensaje": "Ya tienes una solicitud pendiente. El docente la revisará pronto.", "nombre": f"{usuario.nombres} {usuario.apellidos}"}

    nueva = SolicitudRecuperacion(
        id_usuario=usuario.id_usuario,
        motivo=datos.motivo.strip() if datos.motivo else "Sin motivo especificado",
        estado=EstadoSolicitudEnum.pendiente,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return {
        "ok":          True,
        "ya_existia":  False,
        "mensaje":     "Solicitud enviada. El docente la revisará y te comunicará una contraseña temporal.",
        "nombre":      f"{usuario.nombres} {usuario.apellidos}",
        "id_solicitud": nueva.id_solicitud,
    }


# ══════════════════════════════════════════════════════════
# DOCENTE — gestión
# ══════════════════════════════════════════════════════════

@router.get("/solicitudes-recuperacion")
def listar_solicitudes(token: str, db: Session = Depends(get_db)):
    get_docente_from_token(token, db)
    solicitudes = db.query(SolicitudRecuperacion).order_by(
        SolicitudRecuperacion.created_at.desc()
    ).all()
    return [
        {
            "id_solicitud":  s.id_solicitud,
            "id_usuario":    s.id_usuario,
            "nombre":        f"{s.usuario.nombres} {s.usuario.apellidos}",
            "cedula":        s.usuario.cedula,
            "email":         s.usuario.email,
            "curso":         s.usuario.curso,
            "paralelo":      s.usuario.paralelo,
            "motivo":        s.motivo,
            "estado":        s.estado,
            "password_temp": s.password_temp if s.estado == EstadoSolicitudEnum.aprobada else None,
            "created_at":    s.created_at.isoformat() if s.created_at else None,
        }
        for s in solicitudes
    ]


@router.post("/aprobar-recuperacion/{id_solicitud}")
def aprobar_recuperacion(id_solicitud: int, datos: AprobarRequest, db: Session = Depends(get_db)):
    """
    Aprueba la solicitud y genera contraseña temporal.
    El correo se envía desde /enviar-correo-recuperacion/{id} si el docente lo desea.
    """
    docente = get_docente_from_token(datos.token_docente, db)

    solicitud = db.query(SolicitudRecuperacion).filter(
        SolicitudRecuperacion.id_solicitud == id_solicitud
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != EstadoSolicitudEnum.pendiente:
        raise HTTPException(status_code=400, detail=f"La solicitud ya fue {solicitud.estado.value}")

    password_temp = generar_password_temporal()
    usuario = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == solicitud.id_usuario
    ).first()

    usuario.password        = obtener_password_hash(password_temp)
    solicitud.estado        = EstadoSolicitudEnum.aprobada
    solicitud.password_temp = password_temp
    solicitud.atendida_por  = docente.id_usuario
    db.commit()

    return {
        "ok":                True,
        "mensaje":           f"Contraseña restablecida para {usuario.nombres} {usuario.apellidos}",
        "cedula":            usuario.cedula,
        "nombre":            f"{usuario.nombres} {usuario.apellidos}",
        "email":             usuario.email or "",
        "password_temporal": password_temp,
        "correo_enviado":    False,
    }


@router.post("/enviar-correo-recuperacion/{id_solicitud}")
def enviar_correo_recuperacion(id_solicitud: int, datos: EnviarCorreoRequest, db: Session = Depends(get_db)):
    """
    Envía el correo al estudiante en segundo plano (threading).
    Responde al instante — el correo llega en unos segundos.
    """
    get_docente_from_token(datos.token_docente, db)

    solicitud = db.query(SolicitudRecuperacion).filter(
        SolicitudRecuperacion.id_solicitud == id_solicitud
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != EstadoSolicitudEnum.aprobada:
        raise HTTPException(status_code=400, detail="La solicitud no está aprobada aún")
    if not solicitud.password_temp:
        raise HTTPException(status_code=400, detail="No hay contraseña temporal generada")

    usuario = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == solicitud.id_usuario
    ).first()
    if not usuario or not usuario.email:
        raise HTTPException(status_code=400, detail="El estudiante no tiene correo registrado")

    # Lanza el envío en segundo plano — responde inmediatamente
    enviar_email_en_fondo(
        destinatario=usuario.email,
        nombre=f"{usuario.nombres} {usuario.apellidos}",
        password_temp=solicitud.password_temp,
        para_docente=False,
    )

    return {
        "ok":             True,
        "mensaje":        f"Correo enviado a {usuario.email}",
        "email":          usuario.email,
        "correo_enviado": True,
    }


@router.post("/rechazar-recuperacion/{id_solicitud}")
def rechazar_recuperacion(id_solicitud: int, datos: RechazarRequest, db: Session = Depends(get_db)):
    docente = get_docente_from_token(datos.token_docente, db)
    solicitud = db.query(SolicitudRecuperacion).filter(
        SolicitudRecuperacion.id_solicitud == id_solicitud
    ).first()
    if not solicitud:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if solicitud.estado != EstadoSolicitudEnum.pendiente:
        raise HTTPException(status_code=400, detail=f"La solicitud ya fue {solicitud.estado.value}")
    solicitud.estado       = EstadoSolicitudEnum.rechazada
    solicitud.motivo       = datos.motivo_rechazo or solicitud.motivo
    solicitud.atendida_por = docente.id_usuario
    db.commit()
    return {"ok": True, "mensaje": "Solicitud rechazada"}


@router.post("/resetear-password-forzado")
def resetear_password_forzado(datos: ResetForzadoRequest, db: Session = Depends(get_db)):
    get_docente_from_token(datos.token_docente, db)
    usuario = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == datos.id_usuario
    ).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if len(datos.nueva_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    usuario.password = obtener_password_hash(datos.nueva_password)
    db.commit()
    return {"ok": True, "mensaje": f"Contraseña actualizada para {usuario.nombres} {usuario.apellidos}", "cedula": usuario.cedula}


# ══════════════════════════════════════════════════════════
# RECUPERACIÓN DEL DOCENTE
# ══════════════════════════════════════════════════════════

@router.post("/recuperar-docente")
def recuperar_docente(datos: RecuperarDocenteRequest, db: Session = Depends(get_db)):
    respuesta_generica = {
        "ok":     True,
        "mensaje": "Si tu cédula está registrada, recibirás un correo con tu contraseña temporal en unos instantes. Revisa también la carpeta de spam."
    }
    usuario = db.query(UsuarioSistema).filter(
        UsuarioSistema.cedula == datos.cedula.strip()
    ).first()

    if not usuario or usuario.rol.value != "docente" or not usuario.estado or not usuario.email:
        return respuesta_generica

    password_temp    = generar_password_temporal()
    usuario.password = obtener_password_hash(password_temp)
    db.commit()

    # Envío en segundo plano — responde al instante
    enviar_email_en_fondo(
        destinatario=usuario.email,
        nombre=f"{usuario.nombres} {usuario.apellidos}",
        password_temp=password_temp,
        para_docente=True,
    )

    return respuesta_generica
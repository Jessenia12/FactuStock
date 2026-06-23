from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
import os, uuid

from database import get_db
from models import UsuarioSistema, FacturaVenta, TicketSoporte, PermisoModulo
from auth import obtener_password_hash
from dependencies import get_current_user, require_docente

router = APIRouter(prefix="/api/docente", tags=["Docente"])

# ── Lista completa de módulos disponibles ──────────────────────────────
MODULOS_DISPONIBLES = [
    "inicio",
    "comprobantes_emitidos",
    "comprobantes_recibidos",
    "pendientes_emitir",
    "clientes",
    "productos",
    "reportes",
    "generar_ats",
    "configuracion",
    "ayuda_soporte",
]

# ═══════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════
class CrearEstudianteRequest(BaseModel):
    cedula:    str
    nombres:   str
    apellidos: str
    email:     str
    password:  str
    curso:     Optional[str] = None
    paralelo:  Optional[str] = None
    modulos:   Optional[List[str]] = None  # si None → todos activos


class EditarEstudianteRequest(BaseModel):
    nombres:   Optional[str] = None
    apellidos: Optional[str] = None
    email:     Optional[str] = None
    curso:     Optional[str] = None
    paralelo:  Optional[str] = None
    password:  Optional[str] = None   # si se envía, cambia la contraseña


class ActualizarModulosRequest(BaseModel):
    modulos: List[str]   # lista de módulos que deben estar ACTIVOS


class ResponderTicketRequest(BaseModel):
    respuesta: str
    estado:    Optional[str] = "resuelto"   # pendiente | visto | resuelto


class CrearTicketRequest(BaseModel):
    categoria:   str
    modulo:      Optional[str] = None
    asunto:      str
    descripcion: str


# ═══════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════
def _get_modulos_estudiante(db: Session, id_estudiante: int) -> List[str]:
    """Devuelve lista de módulos activos para un estudiante."""
    permisos = db.query(PermisoModulo).filter(
        PermisoModulo.id_estudiante == id_estudiante,
        PermisoModulo.activo == True
    ).all()
    if not permisos:
        # Sin permisos registrados → acceso a todos
        return MODULOS_DISPONIBLES
    return [p.modulo for p in permisos]


def _init_modulos(db: Session, id_estudiante: int, modulos: Optional[List[str]]):
    """Crea los registros de permisos para un estudiante nuevo."""
    lista = modulos if modulos is not None else MODULOS_DISPONIBLES
    for mod in MODULOS_DISPONIBLES:
        permiso = PermisoModulo(
            id_estudiante=id_estudiante,
            modulo=mod,
            activo=(mod in lista)
        )
        db.add(permiso)


def _stats_estudiante(db: Session, id_estudiante: int) -> dict:
    """Calcula estadísticas básicas de un estudiante."""
    total_facturas = db.query(func.count(FacturaVenta.id_factura)).filter(
        FacturaVenta.id_usuario == id_estudiante
    ).scalar() or 0

    total_facturado = db.query(
        func.coalesce(func.sum(FacturaVenta.total), 0)
    ).filter(
        FacturaVenta.id_usuario == id_estudiante,
        FacturaVenta.estado == "finalizada"
    ).scalar() or 0

    tickets_pendientes = db.query(func.count(TicketSoporte.id_ticket)).filter(
        TicketSoporte.id_estudiante == id_estudiante,
        TicketSoporte.estado == "pendiente"
    ).scalar() or 0

    return {
        "total_facturas":      total_facturas,
        "total_facturado":     float(total_facturado),
        "tickets_pendientes":  tickets_pendientes,
    }


# ═══════════════════════════════════════════════════
# ENDPOINTS — GESTIÓN DE ESTUDIANTES
# ═══════════════════════════════════════════════════

@router.get("/estudiantes")
def listar_estudiantes(
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Lista todos los estudiantes con sus stats y módulos asignados."""
    estudiantes = db.query(UsuarioSistema).filter(
        UsuarioSistema.rol == "estudiante"
    ).order_by(UsuarioSistema.apellidos, UsuarioSistema.nombres).all()

    result = []
    for e in estudiantes:
        foto_url = None
        if e.foto_perfil:
            foto_url = f"/uploads/fotos_perfil/{e.foto_perfil}"
        result.append({
            "id_usuario":  e.id_usuario,
            "cedula":      e.cedula,
            "nombres":     e.nombres,
            "apellidos":   e.apellidos,
            "email":       e.email,
            "curso":       e.curso,
            "paralelo":    e.paralelo,
            "estado":      e.estado,
            "foto_url":    foto_url,
            "created_at":  str(e.created_at.date()) if e.created_at else None,
            "modulos":     _get_modulos_estudiante(db, e.id_usuario),
            "stats":       _stats_estudiante(db, e.id_usuario),
        })
    return {"estudiantes": result, "total": len(result)}


@router.post("/estudiantes", status_code=201)
def crear_estudiante(
    datos: CrearEstudianteRequest,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Crea un nuevo estudiante y asigna sus módulos."""
    # Validar unicidad
    if db.query(UsuarioSistema).filter(UsuarioSistema.cedula == datos.cedula).first():
        raise HTTPException(400, "Ya existe un usuario con esa cédula.")
    if db.query(UsuarioSistema).filter(UsuarioSistema.email == datos.email).first():
        raise HTTPException(400, "Ya existe un usuario con ese email.")

    nuevo = UsuarioSistema(
        cedula=datos.cedula,
        nombres=datos.nombres.strip(),
        apellidos=datos.apellidos.strip(),
        email=datos.email.strip().lower(),
        password=obtener_password_hash(datos.password),
        rol="estudiante",
        curso=datos.curso or None,
        paralelo=datos.paralelo or None,
        estado=True,
    )
    db.add(nuevo)
    db.flush()   # obtener id_usuario antes del commit

    _init_modulos(db, nuevo.id_usuario, datos.modulos)
    db.commit()
    db.refresh(nuevo)

    return {
        "mensaje":    "Estudiante creado correctamente",
        "id_usuario": nuevo.id_usuario,
        "cedula":     nuevo.cedula,
        "nombres":    nuevo.nombres,
        "apellidos":  nuevo.apellidos,
        "email":      nuevo.email,
        "modulos":    _get_modulos_estudiante(db, nuevo.id_usuario),
    }


@router.patch("/estudiantes/{id_usuario}")
def editar_estudiante(
    id_usuario: int,
    datos: EditarEstudianteRequest,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Edita datos de un estudiante."""
    est = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == id_usuario,
        UsuarioSistema.rol == "estudiante"
    ).first()
    if not est:
        raise HTTPException(404, "Estudiante no encontrado.")

    if datos.email and datos.email != est.email:
        existe = db.query(UsuarioSistema).filter(
            UsuarioSistema.email == datos.email,
            UsuarioSistema.id_usuario != id_usuario
        ).first()
        if existe:
            raise HTTPException(400, "El email ya está en uso.")

    if datos.nombres:              est.nombres   = datos.nombres.strip()
    if datos.apellidos:            est.apellidos = datos.apellidos.strip()
    if datos.email:                est.email     = datos.email.strip().lower()
    if datos.curso is not None:    est.curso     = datos.curso or None
    if datos.paralelo is not None: est.paralelo  = datos.paralelo or None
    if datos.password:             est.password  = obtener_password_hash(datos.password)

    db.commit()
    db.refresh(est)
    return {"mensaje": "Estudiante actualizado", "id_usuario": est.id_usuario}


@router.patch("/estudiantes/{id_usuario}/estado")
def cambiar_estado_estudiante(
    id_usuario: int,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Activa o desactiva un estudiante."""
    est = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == id_usuario,
        UsuarioSistema.rol == "estudiante"
    ).first()
    if not est:
        raise HTTPException(404, "Estudiante no encontrado.")

    est.estado = not est.estado
    db.commit()
    return {
        "mensaje":  f"Estudiante {'activado' if est.estado else 'desactivado'}",
        "estado":   est.estado
    }


@router.delete("/estudiantes/{id_usuario}")
def eliminar_estudiante(
    id_usuario: int,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Elimina un estudiante y todos sus datos."""
    est = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == id_usuario,
        UsuarioSistema.rol == "estudiante"
    ).first()
    if not est:
        raise HTTPException(404, "Estudiante no encontrado.")

    # Eliminar foto de perfil si existe
    if est.foto_perfil:
        ruta = os.path.join("uploads/fotos_perfil", est.foto_perfil)
        if os.path.exists(ruta):
            try:
                os.remove(ruta)
            except Exception:
                pass

    db.delete(est)
    db.commit()
    return {"mensaje": "Estudiante eliminado correctamente"}


# ═══════════════════════════════════════════════════
# ENDPOINTS — MÓDULOS POR ESTUDIANTE
# ═══════════════════════════════════════════════════

@router.get("/estudiantes/{id_usuario}/modulos")
def obtener_modulos(
    id_usuario: int,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Obtiene los módulos asignados a un estudiante."""
    est = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == id_usuario,
        UsuarioSistema.rol == "estudiante"
    ).first()
    if not est:
        raise HTTPException(404, "Estudiante no encontrado.")

    permisos = db.query(PermisoModulo).filter(
        PermisoModulo.id_estudiante == id_usuario
    ).all()

    if not permisos:
        # Sin registros → todos activos por defecto
        return {
            "modulos_disponibles": MODULOS_DISPONIBLES,
            "modulos_activos":     MODULOS_DISPONIBLES,
        }

    return {
        "modulos_disponibles": MODULOS_DISPONIBLES,
        "modulos_activos":     [p.modulo for p in permisos if p.activo],
    }


@router.put("/estudiantes/{id_usuario}/modulos")
def actualizar_modulos(
    id_usuario: int,
    datos: ActualizarModulosRequest,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Reemplaza completamente los módulos activos de un estudiante."""
    est = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == id_usuario,
        UsuarioSistema.rol == "estudiante"
    ).first()
    if not est:
        raise HTTPException(404, "Estudiante no encontrado.")

    # Eliminar permisos actuales y recrear
    db.query(PermisoModulo).filter(
        PermisoModulo.id_estudiante == id_usuario
    ).delete()

    for mod in MODULOS_DISPONIBLES:
        db.add(PermisoModulo(
            id_estudiante=id_usuario,
            modulo=mod,
            activo=(mod in datos.modulos)
        ))

    db.commit()
    return {
        "mensaje":         "Módulos actualizados",
        "modulos_activos": datos.modulos
    }


# ═══════════════════════════════════════════════════
# ENDPOINTS — TICKETS DE SOPORTE
# ═══════════════════════════════════════════════════

@router.get("/tickets")
def listar_tickets(
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Lista todos los tickets de soporte, opcionalmente filtrados por estado."""
    query = db.query(TicketSoporte)
    if estado:
        query = query.filter(TicketSoporte.estado == estado)
    tickets = query.order_by(TicketSoporte.created_at.desc()).all()

    result = []
    for t in tickets:
        est = t.estudiante
        result.append({
            "id_ticket":          t.id_ticket,
            "categoria":          t.categoria,
            "modulo":             t.modulo,
            "asunto":             t.asunto,
            "descripcion":        t.descripcion,
            "estado":             t.estado,
            "respuesta_docente":  t.respuesta_docente,
            "created_at":         str(t.created_at),
            "updated_at":         str(t.updated_at) if t.updated_at else None,
            "estudiante": {
                "id_usuario": est.id_usuario,
                "nombres":    est.nombres,
                "apellidos":  est.apellidos,
                "email":      est.email,
                "curso":      est.curso,
                "paralelo":   est.paralelo,
            } if est else None,
        })

    pendientes = sum(1 for t in result if t["estado"] == "pendiente")
    return {"tickets": result, "total": len(result), "pendientes": pendientes}


@router.patch("/tickets/{id_ticket}")
def responder_ticket(
    id_ticket: int,
    datos: ResponderTicketRequest,
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """El docente responde o actualiza el estado de un ticket."""
    ticket = db.query(TicketSoporte).filter(
        TicketSoporte.id_ticket == id_ticket
    ).first()
    if not ticket:
        raise HTTPException(404, "Ticket no encontrado.")

    ticket.respuesta_docente = datos.respuesta.strip()
    ticket.estado            = datos.estado
    ticket.updated_at        = datetime.utcnow()
    db.commit()
    return {"mensaje": "Ticket actualizado", "estado": ticket.estado}


# ═══════════════════════════════════════════════════
# ENDPOINTS — ESTUDIANTE (crea su propio ticket)
# ═══════════════════════════════════════════════════

@router.post("/tickets", status_code=201)
def crear_ticket(
    datos: CrearTicketRequest,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    """Un estudiante crea un ticket de soporte dirigido al docente."""
    ticket = TicketSoporte(
        id_estudiante=current_user.id_usuario,
        categoria=datos.categoria,
        modulo=datos.modulo or None,
        asunto=datos.asunto.strip(),
        descripcion=datos.descripcion.strip(),
        estado="pendiente",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {
        "mensaje":   "Consulta enviada correctamente al docente",
        "id_ticket": ticket.id_ticket,
    }


# ═══════════════════════════════════════════════════
# ENDPOINT — MÓDULOS DEL USUARIO ACTUAL (para el frontend)
# ═══════════════════════════════════════════════════

@router.get("/mis-modulos")
def mis_modulos(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    """
    Devuelve los módulos a los que tiene acceso el usuario actual.
    - Docente → todos los módulos siempre
    - Estudiante → solo los asignados por el docente
    """
    if current_user.rol == "docente":
        return {"modulos": MODULOS_DISPONIBLES, "es_docente": True}

    modulos = _get_modulos_estudiante(db, current_user.id_usuario)
    return {"modulos": modulos, "es_docente": False}



# ═══════════════════════════════════════════════════
# ENDPOINT — MIS TICKETS (el estudiante ve sus consultas)
# ═══════════════════════════════════════════════════

@router.get("/mis-tickets")
def mis_tickets(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    """El estudiante ve sus propios tickets con respuesta del docente."""
    tickets = db.query(TicketSoporte).filter(
        TicketSoporte.id_estudiante == current_user.id_usuario
    ).order_by(TicketSoporte.created_at.desc()).all()
    return {
        "tickets": [
            {
                "id_ticket": t.id_ticket, "categoria": t.categoria,
                "modulo": t.modulo, "asunto": t.asunto,
                "descripcion": t.descripcion, "estado": t.estado,
                "respuesta_docente": t.respuesta_docente,
                "created_at": str(t.created_at),
            }
            for t in tickets
        ],
        "total": len(tickets)
    }

# ═══════════════════════════════════════════════════
# ENDPOINT — ESTADÍSTICAS GENERALES DEL DOCENTE
# ═══════════════════════════════════════════════════

@router.get("/resumen")
def resumen_docente(
    db: Session = Depends(get_db),
    _: UsuarioSistema = Depends(require_docente)
):
    """Estadísticas globales del sistema para el panel del docente."""
    total_estudiantes = db.query(func.count(UsuarioSistema.id_usuario)).filter(
        UsuarioSistema.rol == "estudiante"
    ).scalar() or 0

    estudiantes_activos = db.query(func.count(UsuarioSistema.id_usuario)).filter(
        UsuarioSistema.rol == "estudiante",
        UsuarioSistema.estado == True
    ).scalar() or 0

    total_facturas = db.query(func.count(FacturaVenta.id_factura)).scalar() or 0

    total_facturado = db.query(
        func.coalesce(func.sum(FacturaVenta.total), 0)
    ).filter(FacturaVenta.estado == "finalizada").scalar() or 0

    tickets_pendientes = db.query(func.count(TicketSoporte.id_ticket)).filter(
        TicketSoporte.estado == "pendiente"
    ).scalar() or 0

    tickets_total = db.query(func.count(TicketSoporte.id_ticket)).scalar() or 0

    return {
        "total_estudiantes":    total_estudiantes,
        "estudiantes_activos":  estudiantes_activos,
        "total_facturas":       total_facturas,
        "total_facturado":      float(total_facturado),
        "tickets_pendientes":   tickets_pendientes,
        "tickets_total":        tickets_total,
    }
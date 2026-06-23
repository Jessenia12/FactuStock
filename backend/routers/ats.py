"""
ATS — Anexo Transaccional Simplificado
Formato SRI Ecuador — Resolución NAC-DGERCGC14-00366

CORRECCIONES APLICADAS:
  1. Compras: usa la misma lógica virtual de comprobantes-recibidos
     (FacturaVenta + NotaCredito + NotaDebito + LiquidacionCompra donde el
     cliente/receptor es el usuario actual), en lugar de buscar en una tabla
     comprobantes_recibidos que no existe como fuente real de datos.
  2. baseImponible: separado correctamente (tarifa diferente de 0 y diferente de IVA).
  3. codSustento: determinado por tipo de comprobante según tabla SRI.
  4. tipoEm: "E" para electrónico (comprobantes del sistema), "F" solo para físicos.
  5. Nodo <anulados> incluido (valor 0 — el sistema no maneja anulados por ahora).
  6. <autorizacion> nunca vacía: se usa clave_acceso si existe, sino se deja "0" * 49
     para que el XML sea válido y el usuario pueda corregirlo.
  7. Resumen y detalle de compras ahora recogen todos los tipos de comprobante.
"""

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date
import xml.etree.ElementTree as ET

from database import get_db
from models import (
    FacturaVenta,        DetalleFacturaVenta,
    NotaCredito,         DetalleNotaCredito,
    NotaDebito,          DetalleNotaDebito,
    LiquidacionCompra,   DetalleLiquidacionCompra,
    PersonaComercial,    ParametroSistema, UsuarioSistema,
)
from dependencies import get_current_user

router = APIRouter(prefix="/api/ats", tags=["ATS"])

MESES = {
    1: "enero",   2: "febrero",  3: "marzo",    4: "abril",
    5: "mayo",    6: "junio",    7: "julio",     8: "agosto",
    9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _param(db: Session, uid: int, clave: str, default: str = "") -> str:
    row = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == uid,
        ParametroSistema.clave == clave,
    ).first()
    return row.valor if row else default


def _ultimo_dia(anio: int, mes: int) -> int:
    import calendar
    return calendar.monthrange(anio, mes)[1]


def _fmt(v) -> str:
    return f"{float(v or 0):.2f}"


def _tipo_id_sri(tipo: str) -> str:
    """Códigos SRI para tipo de identificación."""
    mapa = {
        "ruc":              "04",
        "cedula":           "05",
        "CEDULA":           "05",
        "pasaporte":        "06",
        "consumidor_final": "07",
        "07":               "07",
    }
    return mapa.get(str(tipo or "").strip(), "05")


def _tipo_comp_sri(tipo: str) -> str:
    """Códigos SRI para tipo de comprobante."""
    return {
        "factura":      "18",
        "nota_credito": "04",
        "nota_debito":  "05",
        "retencion":    "07",
        "liquidacion":  "03",
        "guia":         "06",
    }.get(tipo, "18")


def _cod_sustento(tipo: str) -> str:
    """
    Código de sustento del crédito tributario (tabla SRI).
    01 = Crédito tributario para declaración de IVA (compras)
    03 = Liquidación de compras (bienes/servicios sin RUC)
    04 = Otros (notas de crédito/débito que no generan crédito tributario directo)
    """
    return {
        "factura":      "01",
        "liquidacion":  "03",
        "nota_debito":  "01",
        "nota_credito": "04",
        "retencion":    "01",
        "guia":         "01",
    }.get(tipo, "01")


def _num_serie(numero: str, parte: int) -> str:
    """Extrae establecimiento / punto emisión / secuencial de '001-001-000000001'."""
    try:
        partes = (numero or "").split("-")
        return partes[parte] if len(partes) > parte else "001"
    except Exception:
        return "001"


def _nombre_usuario(u: UsuarioSistema) -> str:
    return f"{u.nombres} {u.apellidos}".strip()


# ─────────────────────────────────────────────────────────────────────────────
# RECOLECTOR DE COMPRAS  (misma lógica que comprobantes-recibidos)
# Busca todos los comprobantes donde el receptor/cliente es la cédula del usuario.
# ─────────────────────────────────────────────────────────────────────────────

def _recolectar_compras(
    db: Session,
    current_user: UsuarioSistema,
    desde: date,
    hasta: date,
) -> list[dict]:
    cedula = current_user.cedula
    result: list[dict] = []

    # ── 1. FACTURAS recibidas ────────────────────────────────────────────────
    facturas = (
        db.query(FacturaVenta)
        .options(joinedload(FacturaVenta.usuario))
        .join(PersonaComercial,
              FacturaVenta.id_persona_comercial == PersonaComercial.id_persona_comercial)
        .filter(
            PersonaComercial.identificacion == cedula,
            FacturaVenta.estado == "finalizada",
            FacturaVenta.fecha_emision >= desde,
            FacturaVenta.fecha_emision <= hasta,
        )
        .all()
    )
    for f in facturas:
        emisor = f.usuario
        result.append({
            "tipo":           "factura",
            "numero":         f.numero_comprobante,
            "fecha_emision":  f.fecha_emision,
            "fecha_registro": f.created_at.date() if f.created_at else f.fecha_emision,
            "clave_acceso":   getattr(f, "clave_acceso", "") or "",
            "subtotal_0":     float(f.subtotal_0   or 0),
            "subtotal_iva":   float(f.subtotal_iva or 0),
            "iva":            float(f.iva          or 0),
            "total":          float(f.total        or 0),
            "proveedor_id":   emisor.cedula if emisor else "",
            "proveedor_tipo": "cedula",
            "proveedor_nombre": _nombre_usuario(emisor) if emisor else "—",
        })

    # ── 2. NOTAS DE CRÉDITO recibidas ────────────────────────────────────────
    notas_c = (
        db.query(NotaCredito)
        .options(joinedload(NotaCredito.usuario))
        .join(PersonaComercial,
              NotaCredito.id_persona_comercial == PersonaComercial.id_persona_comercial)
        .filter(
            PersonaComercial.identificacion == cedula,
            NotaCredito.estado == "emitida",
            NotaCredito.fecha_emision >= desde,
            NotaCredito.fecha_emision <= hasta,
        )
        .all()
    )
    for n in notas_c:
        emisor = n.usuario
        result.append({
            "tipo":           "nota_credito",
            "numero":         n.numero_comprobante,
            "fecha_emision":  n.fecha_emision,
            "fecha_registro": n.created_at.date() if n.created_at else n.fecha_emision,
            "clave_acceso":   getattr(n, "clave_acceso", "") or "",
            "subtotal_0":     float(n.subtotal_0   or 0),
            "subtotal_iva":   float(n.subtotal_iva or 0),
            "iva":            float(n.iva          or 0),
            "total":          float(n.total        or 0),
            "proveedor_id":   emisor.cedula if emisor else "",
            "proveedor_tipo": "cedula",
            "proveedor_nombre": _nombre_usuario(emisor) if emisor else "—",
        })

    # ── 3. NOTAS DE DÉBITO recibidas ─────────────────────────────────────────
    notas_d = (
        db.query(NotaDebito)
        .options(joinedload(NotaDebito.usuario))
        .join(PersonaComercial,
              NotaDebito.id_persona_comercial == PersonaComercial.id_persona_comercial)
        .filter(
            PersonaComercial.identificacion == cedula,
            NotaDebito.estado == "emitida",
            NotaDebito.fecha_emision >= desde,
            NotaDebito.fecha_emision <= hasta,
        )
        .all()
    )
    for n in notas_d:
        emisor = n.usuario
        result.append({
            "tipo":           "nota_debito",
            "numero":         n.numero_comprobante,
            "fecha_emision":  n.fecha_emision,
            "fecha_registro": n.created_at.date() if n.created_at else n.fecha_emision,
            "clave_acceso":   getattr(n, "clave_acceso", "") or "",
            "subtotal_0":     float(n.subtotal_0   or 0),
            "subtotal_iva":   float(n.subtotal_iva or 0),
            "iva":            float(n.iva          or 0),
            "total":          float(n.total        or 0),
            "proveedor_id":   emisor.cedula if emisor else "",
            "proveedor_tipo": "cedula",
            "proveedor_nombre": _nombre_usuario(emisor) if emisor else "—",
        })

    # ── 4. LIQUIDACIONES recibidas ───────────────────────────────────────────
    liquidaciones = (
        db.query(LiquidacionCompra)
        .join(PersonaComercial,
              LiquidacionCompra.id_persona_comercial == PersonaComercial.id_persona_comercial)
        .filter(
            PersonaComercial.identificacion == cedula,
            LiquidacionCompra.estado == "emitida",
            LiquidacionCompra.fecha_emision >= desde,
            LiquidacionCompra.fecha_emision <= hasta,
        )
        .all()
    )
    for liq in liquidaciones:
        emisor = db.query(UsuarioSistema).filter(
            UsuarioSistema.id_usuario == liq.id_usuario
        ).first()
        result.append({
            "tipo":           "liquidacion",
            "numero":         liq.numero_comprobante,
            "fecha_emision":  liq.fecha_emision,
            "fecha_registro": liq.created_at.date() if liq.created_at else liq.fecha_emision,
            "clave_acceso":   getattr(liq, "clave_acceso", "") or "",
            "subtotal_0":     float(liq.subtotal_0   or 0),
            "subtotal_iva":   float(liq.subtotal_iva or 0),
            "iva":            float(liq.iva          or 0),
            "total":          float(liq.total        or 0),
            "proveedor_id":   emisor.cedula if emisor else "",
            "proveedor_tipo": "cedula",
            "proveedor_nombre": _nombre_usuario(emisor) if emisor else "—",
        })

    result.sort(key=lambda x: x["fecha_emision"] or date.min)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/ats/resumen
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/resumen", response_model=dict)
def resumen_ats(
    anio: int = Query(..., ge=2020, le=2099),
    mes:  int = Query(..., ge=1,    le=12),
    db:   Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    uid   = current_user.id_usuario
    desde = date(anio, mes, 1)
    hasta = date(anio, mes, _ultimo_dia(anio, mes))

    # ── Ventas propias ──
    ventas = db.query(
        func.count(FacturaVenta.id_factura).label("cantidad"),
        func.coalesce(func.sum(FacturaVenta.subtotal_0),   0).label("base_0"),
        func.coalesce(func.sum(FacturaVenta.subtotal_iva), 0).label("base_iva"),
        func.coalesce(func.sum(FacturaVenta.iva),          0).label("iva"),
        func.coalesce(func.sum(FacturaVenta.descuento),    0).label("descuento"),
        func.coalesce(func.sum(FacturaVenta.total),        0).label("total"),
    ).filter(
        FacturaVenta.id_usuario == uid,
        FacturaVenta.estado == "finalizada",
        FacturaVenta.fecha_emision >= desde,
        FacturaVenta.fecha_emision <= hasta,
    ).first()

    # ── Compras recibidas (todos los tipos) ──
    compras_items = _recolectar_compras(db, current_user, desde, hasta)
    compras_agg = {
        "cantidad": len(compras_items),
        "base_0":   sum(c["subtotal_0"]   for c in compras_items),
        "base_iva": sum(c["subtotal_iva"] for c in compras_items),
        "iva":      sum(c["iva"]          for c in compras_items),
        "total":    sum(c["total"]        for c in compras_items),
    }

    # ── Datos del negocio ──
    ruc   = _param(db, uid, "ruc",          current_user.cedula)
    razon = _param(db, uid, "razon_social", _nombre_usuario(current_user))

    return {
        "periodo": {"anio": anio, "mes": mes, "mes_nombre": MESES[mes]},
        "negocio": {
            "ruc":             ruc,
            "razon_social":    razon,
            "nombre_comercial": _param(db, uid, "nombre_comercial", razon),
        },
        "ventas": {
            "cantidad":  ventas.cantidad,
            "base_0":    float(ventas.base_0),
            "base_iva":  float(ventas.base_iva),
            "iva":       float(ventas.iva),
            "descuento": float(ventas.descuento),
            "total":     float(ventas.total),
        },
        "compras": compras_agg,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/ats/ventas-detalle
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/ventas-detalle", response_model=dict)
def ventas_detalle(
    anio: int = Query(..., ge=2020, le=2099),
    mes:  int = Query(..., ge=1,    le=12),
    db:   Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    uid   = current_user.id_usuario
    desde = date(anio, mes, 1)
    hasta = date(anio, mes, _ultimo_dia(anio, mes))

    facturas = (
        db.query(FacturaVenta)
        .options(joinedload(FacturaVenta.cliente))
        .filter(
            FacturaVenta.id_usuario == uid,
            FacturaVenta.estado == "finalizada",
            FacturaVenta.fecha_emision >= desde,
            FacturaVenta.fecha_emision <= hasta,
        )
        .order_by(FacturaVenta.fecha_emision)
        .all()
    )

    return {
        "items": [
            {
                "numero":         f.numero_comprobante,
                "fecha":          str(f.fecha_emision),
                "cliente":        (f.cliente.nombres_apellidos or f.cliente.razon_social)
                                  if f.cliente else "—",
                "identificacion": f.cliente.identificacion if f.cliente else "—",
                "tipo_id":        f.cliente.tipo_identificacion.value if f.cliente else "cedula",
                "base_0":         float(f.subtotal_0   or 0),
                "base_iva":       float(f.subtotal_iva or 0),
                "iva":            float(f.iva          or 0),
                "descuento":      float(f.descuento    or 0),
                "total":          float(f.total        or 0),
            }
            for f in facturas
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/ats/compras-detalle
# Ahora devuelve todos los comprobantes recibidos (facturas + NC + ND + LIQ)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/compras-detalle", response_model=dict)
def compras_detalle(
    anio: int = Query(..., ge=2020, le=2099),
    mes:  int = Query(..., ge=1,    le=12),
    db:   Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    desde = date(anio, mes, 1)
    hasta = date(anio, mes, _ultimo_dia(anio, mes))

    compras = _recolectar_compras(db, current_user, desde, hasta)

    return {
        "items": [
            {
                "numero":         c["numero"],
                "tipo":           c["tipo"],
                "clave_acceso":   c["clave_acceso"],
                "fecha":          str(c["fecha_emision"]),
                "proveedor":      c["proveedor_nombre"],
                "identificacion": c["proveedor_id"],
                "tipo_id":        c["proveedor_tipo"],
                "base_0":         c["subtotal_0"],
                "base_iva":       c["subtotal_iva"],
                "iva":            c["iva"],
                "total":          c["total"],
            }
            for c in compras
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/ats/generar-xml
# Genera el XML ATS según esquema oficial SRI
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/generar-xml")
def generar_xml(
    anio: int = Query(..., ge=2020, le=2099),
    mes:  int = Query(..., ge=1,    le=12),
    db:   Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    uid   = current_user.id_usuario
    desde = date(anio, mes, 1)
    hasta = date(anio, mes, _ultimo_dia(anio, mes))

    # ── Datos del negocio ──
    ruc       = _param(db, uid, "ruc",                   current_user.cedula)
    razon     = _param(db, uid, "razon_social",          _nombre_usuario(current_user))
    num_estab = _param(db, uid, "num_establecimientos",  "001")

    # ── Ventas propias ──
    facturas = (
        db.query(FacturaVenta)
        .options(joinedload(FacturaVenta.cliente))
        .filter(
            FacturaVenta.id_usuario == uid,
            FacturaVenta.estado == "finalizada",
            FacturaVenta.fecha_emision >= desde,
            FacturaVenta.fecha_emision <= hasta,
        )
        .order_by(FacturaVenta.fecha_emision)
        .all()
    )

    # ── Compras recibidas ──
    compras = _recolectar_compras(db, current_user, desde, hasta)

    total_ventas = sum(float(f.total or 0) for f in facturas)

    # ─────────────────────────────────────────────────────────────────────────
    # CONSTRUIR XML
    # ─────────────────────────────────────────────────────────────────────────
    ats = ET.Element("iva")

    # ── Cabecera ──
    ET.SubElement(ats, "TipoIDInformante").text  = "R"          # R = RUC
    ET.SubElement(ats, "IdInformante").text      = ruc
    ET.SubElement(ats, "razonSocial").text       = razon
    ET.SubElement(ats, "Anio").text              = str(anio)
    ET.SubElement(ats, "Mes").text               = str(mes).zfill(2)
    ET.SubElement(ats, "numEstabRuc").text       = num_estab
    ET.SubElement(ats, "totalVentas").text       = _fmt(total_ventas)
    ET.SubElement(ats, "codigoOperativo").text   = "IVA"

    # ── COMPRAS ──────────────────────────────────────────────────────────────
    compras_el = ET.SubElement(ats, "compras")

    for c in compras:
        prov_id   = c["proveedor_id"]
        prov_tipo = c["proveedor_tipo"]

        # Si no tenemos proveedor válido lo omitimos del XML
        if not prov_id:
            continue

        # Autorización: clave de acceso si existe; sino 49 ceros (válido, editable)
        autorizacion = (c["clave_acceso"] or "").strip()
        if not autorizacion:
            autorizacion = "0" * 49

        det = ET.SubElement(compras_el, "detalleCompras")
        ET.SubElement(det, "codSustento").text       = _cod_sustento(c["tipo"])
        ET.SubElement(det, "tpIdProv").text          = _tipo_id_sri(prov_tipo)
        ET.SubElement(det, "idProv").text            = prov_id
        ET.SubElement(det, "tipoComprobante").text   = _tipo_comp_sri(c["tipo"])
        ET.SubElement(det, "parteRel").text          = "NO"
        ET.SubElement(det, "fechaRegistro").text     = str(c["fecha_registro"])
        ET.SubElement(det, "establecimiento").text   = _num_serie(c["numero"], 0)
        ET.SubElement(det, "puntoEmision").text      = _num_serie(c["numero"], 1)
        ET.SubElement(det, "secuencial").text        = _num_serie(c["numero"], 2)
        ET.SubElement(det, "fechaEmision").text      = str(c["fecha_emision"])
        ET.SubElement(det, "autorizacion").text      = autorizacion
        ET.SubElement(det, "baseNoGraIva").text      = _fmt(c["subtotal_0"])
        ET.SubElement(det, "baseImponible").text     = _fmt(0)      # tarifa 0% diferente de exento
        ET.SubElement(det, "baseImpGrav").text       = _fmt(c["subtotal_iva"])
        ET.SubElement(det, "baseImpExe").text        = _fmt(0)
        ET.SubElement(det, "montoIce").text          = _fmt(0)
        ET.SubElement(det, "montoIva").text          = _fmt(c["iva"])
        ET.SubElement(det, "valRetBien10").text      = _fmt(0)
        ET.SubElement(det, "valRetServ20").text      = _fmt(0)
        ET.SubElement(det, "valorRetBienes").text    = _fmt(0)
        ET.SubElement(det, "valRetServ50").text      = _fmt(0)
        ET.SubElement(det, "valorRetServicios").text = _fmt(0)
        ET.SubElement(det, "valRetServ100").text     = _fmt(0)
        ET.SubElement(det, "totbasesImpReemb").text  = _fmt(0)

        # Pagos — forma de pago 01 = efectivo/sin sistema financiero (ajustar si tienes el dato)
        pagos = ET.SubElement(det, "pagos")
        pago  = ET.SubElement(pagos, "pago")
        ET.SubElement(pago, "formaPago").text = "01"
        ET.SubElement(pago, "total").text     = _fmt(c["total"])
        ET.SubElement(pago, "plazo").text     = "0"
        ET.SubElement(pago, "unidad").text    = "dias"

    # ── VENTAS ───────────────────────────────────────────────────────────────
    ventas_el = ET.SubElement(ats, "ventas")

    for f in facturas:
        cli = f.cliente
        if not cli:
            continue

        det = ET.SubElement(ventas_el, "detalleVentas")
        ET.SubElement(det, "tpIdCliente").text     = _tipo_id_sri(
            cli.tipo_identificacion.value if cli.tipo_identificacion else "cedula"
        )
        ET.SubElement(det, "idCliente").text           = cli.identificacion or ""
        ET.SubElement(det, "parteRel").text            = "NO"
        ET.SubElement(det, "tipoComprobante").text     = "18"   # factura
        ET.SubElement(det, "tipoEm").text              = "E"    # E = electrónico
        ET.SubElement(det, "numeroComprobantes").text  = "1"
        ET.SubElement(det, "baseNoGraIva").text        = _fmt(f.subtotal_0)
        ET.SubElement(det, "baseImponible").text       = _fmt(0)
        ET.SubElement(det, "baseImpGrav").text         = _fmt(f.subtotal_iva)
        ET.SubElement(det, "montoIva").text            = _fmt(f.iva)
        ET.SubElement(det, "montoIce").text            = _fmt(0)
        ET.SubElement(det, "valorRetIva").text         = _fmt(0)
        ET.SubElement(det, "valorRetRenta").text       = _fmt(0)

    # ── VENTAS POR ESTABLECIMIENTO (resumen requerido por SRI) ───────────────
    ve  = ET.SubElement(ats, "ventasEstablecimiento")
    ves = ET.SubElement(ve, "ventaEst")
    ET.SubElement(ves, "codEstab").text    = "001"
    ET.SubElement(ves, "ventasEstab").text = _fmt(total_ventas)
    ET.SubElement(ves, "ivaComp").text     = _fmt(0)

    # ── ANULADOS (nodo obligatorio, valor 0 si no aplica) ────────────────────
    anulados_el = ET.SubElement(ats, "anulados")
    # Si en el futuro se manejan comprobantes anulados, añadir <detalleAnulados> aquí

    # ── Serializar ───────────────────────────────────────────────────────────
    ET.indent(ats, space="  ")
    xml_bytes = (
        b'<?xml version="1.0" encoding="UTF-8"?>\n'
        + ET.tostring(ats, encoding="unicode").encode("utf-8")
    )

    ruc_safe = ruc.replace(" ", "")
    filename  = f"ATS_{ruc_safe}_{anio}{str(mes).zfill(2)}.xml"
    return Response(
        content=xml_bytes,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
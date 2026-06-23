from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from datetime import date, datetime as _dt
from typing import Optional
import math, io, csv

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.graphics.barcode import code128
from lxml import etree

from database import get_db
from models import (
    FacturaVenta,       DetalleFacturaVenta,
    NotaCredito,        DetalleNotaCredito,
    NotaDebito,         DetalleNotaDebito,
    LiquidacionCompra,  DetalleLiquidacionCompra,
    ProformaVenta,      DetalleProformaVenta,
    PersonaComercial,   UsuarioSistema,
    ParametroSistema,
)
from dependencies import get_current_user

router = APIRouter(prefix="/api/comprobantes-recibidos", tags=["Comprobantes Recibidos"])


# ══════════════════════════════════════════════════════════
# HELPERS GENERALES
# ══════════════════════════════════════════════════════════

def _nombre_emisor(usuario: UsuarioSistema) -> str:
    return f"{usuario.nombres} {usuario.apellidos}".strip()


def _proveedor_dict(usuario: UsuarioSistema) -> dict:
    return {
        "id_persona_comercial": None,
        "id_usuario":           usuario.id_usuario,
        "flag_cliente":         False,
        "flag_proveedor":       True,
        "tipo_identificacion":  "CEDULA",
        "identificacion":       usuario.cedula,
        "razon_social":         None,
        "nombres_apellidos":    _nombre_emisor(usuario),
        "direccion":            None,
        "telefono":             None,
        "email":                usuario.email,
        "created_at":           None,
    }


def _en_rango(fecha_campo, desde: Optional[date], hasta: Optional[date]) -> bool:
    if fecha_campo is None:
        return True
    if isinstance(fecha_campo, _dt):
        fecha_campo = fecha_campo.date()
    elif isinstance(fecha_campo, str):
        try:
            fecha_campo = date.fromisoformat(fecha_campo[:10])
        except Exception:
            return True
    if desde and fecha_campo < desde:
        return False
    if hasta and fecha_campo > hasta:
        return False
    return True


def _match(busqueda: Optional[str], nombre: str, numero: str) -> bool:
    if not busqueda:
        return True
    t = busqueda.lower()
    return t in (nombre or "").lower() or t in (numero or "").lower()


def _param_negocio(db: Session, id_usuario: int, clave: str, default: str = "") -> str:
    p = db.query(ParametroSistema).filter(
        ParametroSistema.clave == clave,
        ParametroSistema.id_usuario == id_usuario
    ).first()
    return p.valor if p else default


# ══════════════════════════════════════════════════════════
# RECOLECTOR PRINCIPAL CON FILTROS SQL (CORREGIDO)
# ══════════════════════════════════════════════════════════

def _recolectar(
    db: Session,
    current_user: UsuarioSistema,
    tipo:        Optional[str]  = None,
    busqueda:    Optional[str]  = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
) -> list:
    cedula = current_user.cedula
    result = []

    # ── 1. FACTURAS ──────────────────────────────────────
    if tipo in (None, "factura"):
        query = (
            db.query(FacturaVenta)
            .options(
                joinedload(FacturaVenta.detalles).joinedload(DetalleFacturaVenta.producto),
                joinedload(FacturaVenta.usuario),
            )
            .join(PersonaComercial,
                  FacturaVenta.id_persona_comercial == PersonaComercial.id_persona_comercial)
            .filter(PersonaComercial.identificacion == cedula, FacturaVenta.estado == "finalizada")
        )
        # Filtros de fecha en SQL
        if fecha_desde:
            query = query.filter(FacturaVenta.fecha_emision >= fecha_desde)
        if fecha_hasta:
            query = query.filter(FacturaVenta.fecha_emision <= fecha_hasta)

        rows = query.all()
        for f in rows:
            emisor = f.usuario
            if not _match(busqueda, _nombre_emisor(emisor), f.numero_comprobante):
                continue
            result.append({
                "id_comprobante":     f"fac-{f.id_factura}",
                "tipo":               "factura",
                "numero_comprobante": f.numero_comprobante,
                "fecha_emision":      f.fecha_emision.isoformat() if f.fecha_emision else None,
                "fecha_recepcion":    None,
                "subtotal_0":         float(f.subtotal_0  or 0),
                "subtotal_iva":       float(f.subtotal_iva or 0),
                "porcentaje_iva":     float(f.porcentaje_iva or 15),
                "iva":                float(f.iva      or 0),
                "descuento":          float(f.descuento or 0),
                "total":              float(f.total),
                "estado":             "registrado",
                "observaciones":      f.observaciones,
                "created_at":         f.created_at.isoformat() if f.created_at else None,
                "proveedor":          _proveedor_dict(emisor),
                "detalles": [
                    {
                        "id_detalle":      d.id_detalle,
                        "descripcion":     d.producto.nombre if d.producto else f"Producto {d.id_producto}",
                        "cantidad":        float(d.cantidad),
                        "precio_unitario": float(d.precio_unitario),
                        "porcentaje_iva":  float(d.porcentaje_iva),
                        "subtotal":        float(d.subtotal),
                        "descuento":       float(d.descuento or 0),
                        "iva":             float(d.iva or 0),
                        "total":           float(d.total),
                    }
                    for d in (f.detalles or [])
                ],
            })

    # ── 2. NOTAS DE CRÉDITO ──────────────────────────────
    if tipo in (None, "nota_credito"):
        query = (
            db.query(NotaCredito)
            .options(
                joinedload(NotaCredito.detalles).joinedload(DetalleNotaCredito.producto),
                joinedload(NotaCredito.usuario),
            )
            .join(PersonaComercial,
                  NotaCredito.id_persona_comercial == PersonaComercial.id_persona_comercial)
            .filter(PersonaComercial.identificacion == cedula, NotaCredito.estado == "emitida")
        )
        if fecha_desde:
            query = query.filter(NotaCredito.fecha_emision >= fecha_desde)
        if fecha_hasta:
            query = query.filter(NotaCredito.fecha_emision <= fecha_hasta)
        rows = query.all()
        for n in rows:
            emisor = n.usuario
            if not _match(busqueda, _nombre_emisor(emisor), n.numero_comprobante):
                continue
            result.append({
                "id_comprobante":     f"nc-{n.id_nota_credito}",
                "tipo":               "nota_credito",
                "numero_comprobante": n.numero_comprobante,
                "fecha_emision":      n.fecha_emision.isoformat() if n.fecha_emision else None,
                "fecha_recepcion":    None,
                "subtotal_0":         float(n.subtotal_0  or 0),
                "subtotal_iva":       float(n.subtotal_iva or 0),
                "porcentaje_iva":     float(n.porcentaje_iva or 15),
                "iva":                float(n.iva   or 0),
                "descuento":          0.0,
                "total":              float(n.total),
                "estado":             "registrado",
                "observaciones":      n.observaciones,
                "created_at":         n.created_at.isoformat() if n.created_at else None,
                "proveedor":          _proveedor_dict(emisor),
                "detalles": [
                    {
                        "id_detalle":      d.id_detalle,
                        "descripcion":     d.descripcion,
                        "cantidad":        float(d.cantidad),
                        "precio_unitario": float(d.precio_unitario),
                        "porcentaje_iva":  float(d.porcentaje_iva),
                        "subtotal":        float(d.subtotal),
                        "descuento":       0.0,
                        "iva":             float(d.iva or 0),
                        "total":           float(d.total),
                    }
                    for d in (n.detalles or [])
                ],
            })

    # ── 3. NOTAS DE DÉBITO ───────────────────────────────
    if tipo in (None, "nota_debito"):
        query = (
            db.query(NotaDebito)
            .options(joinedload(NotaDebito.detalles), joinedload(NotaDebito.usuario))
            .join(PersonaComercial,
                  NotaDebito.id_persona_comercial == PersonaComercial.id_persona_comercial)
            .filter(PersonaComercial.identificacion == cedula, NotaDebito.estado == "emitida")
        )
        if fecha_desde:
            query = query.filter(NotaDebito.fecha_emision >= fecha_desde)
        if fecha_hasta:
            query = query.filter(NotaDebito.fecha_emision <= fecha_hasta)
        rows = query.all()
        for n in rows:
            emisor = n.usuario
            if not _match(busqueda, _nombre_emisor(emisor), n.numero_comprobante):
                continue
            result.append({
                "id_comprobante":     f"nd-{n.id_nota_debito}",
                "tipo":               "nota_debito",
                "numero_comprobante": n.numero_comprobante,
                "fecha_emision":      n.fecha_emision.isoformat() if n.fecha_emision else None,
                "fecha_recepcion":    None,
                "subtotal_0":         float(n.subtotal_0  or 0),
                "subtotal_iva":       float(n.subtotal_iva or 0),
                "porcentaje_iva":     float(n.porcentaje_iva or 15),
                "iva":                float(n.iva   or 0),
                "descuento":          0.0,
                "total":              float(n.total),
                "estado":             "registrado",
                "observaciones":      n.observaciones,
                "created_at":         n.created_at.isoformat() if n.created_at else None,
                "proveedor":          _proveedor_dict(emisor),
                "detalles": [
                    {
                        "id_detalle":      d.id_detalle,
                        "descripcion":     d.descripcion,
                        "cantidad":        1.0,
                        "precio_unitario": float(d.valor),
                        "porcentaje_iva":  float(d.porcentaje_iva),
                        "subtotal":        float(d.valor),
                        "descuento":       0.0,
                        "iva":             float(d.iva or 0),
                        "total":           float(d.total),
                    }
                    for d in (n.detalles or [])
                ],
            })

    # ── 4. LIQUIDACIONES ─────────────────────────────────
    if tipo in (None, "liquidacion"):
        query = (
            db.query(LiquidacionCompra)
            .options(joinedload(LiquidacionCompra.detalles))
            .join(PersonaComercial,
                  LiquidacionCompra.id_persona_comercial == PersonaComercial.id_persona_comercial)
            .filter(PersonaComercial.identificacion == cedula, LiquidacionCompra.estado == "emitida")
        )
        if fecha_desde:
            query = query.filter(LiquidacionCompra.fecha_emision >= fecha_desde)
        if fecha_hasta:
            query = query.filter(LiquidacionCompra.fecha_emision <= fecha_hasta)
        rows = query.all()
        for liq in rows:
            emisor = db.query(UsuarioSistema).filter(UsuarioSistema.id_usuario == liq.id_usuario).first()
            nombre_em = _nombre_emisor(emisor) if emisor else "Emisor desconocido"
            if not _match(busqueda, nombre_em, liq.numero_comprobante):
                continue
            result.append({
                "id_comprobante":     f"liq-{liq.id_liquidacion}",
                "tipo":               "liquidacion",
                "numero_comprobante": liq.numero_comprobante,
                "fecha_emision":      liq.fecha_emision.isoformat() if liq.fecha_emision else None,
                "fecha_recepcion":    None,
                "subtotal_0":         float(liq.subtotal_0  or 0),
                "subtotal_iva":       float(liq.subtotal_iva or 0),
                "porcentaje_iva":     float(liq.porcentaje_iva or 15),
                "iva":                float(liq.iva      or 0),
                "descuento":          float(liq.descuento or 0),
                "total":              float(liq.total),
                "estado":             "registrado",
                "observaciones":      liq.observaciones,
                "created_at":         liq.created_at.isoformat() if liq.created_at else None,
                "proveedor": {
                    "id_persona_comercial": None,
                    "id_usuario":           liq.id_usuario,
                    "flag_cliente":         False,
                    "flag_proveedor":       True,
                    "tipo_identificacion":  "CEDULA",
                    "identificacion":       emisor.cedula if emisor else "—",
                    "razon_social":         None,
                    "nombres_apellidos":    nombre_em,
                    "direccion":            None,
                    "telefono":             None,
                    "email":                emisor.email if emisor else None,
                    "created_at":           None,
                },
                "detalles": [
                    {
                        "id_detalle":      d.id_detalle,
                        "descripcion":     d.descripcion,
                        "cantidad":        float(d.cantidad or 1),
                        "precio_unitario": float(d.precio_unitario),
                        "porcentaje_iva":  float(d.porcentaje_iva or 0),
                        "subtotal":        float(d.subtotal),
                        "descuento":       float(d.descuento or 0),
                        "iva":             float(d.iva or 0),
                        "total":           float(d.total),
                    }
                    for d in (liq.detalles or [])
                ],
            })

    # ── 5. PROFORMAS ─────────────────────────────────────
    if tipo in (None, "proforma"):
        query = (
            db.query(ProformaVenta)
            .options(
                joinedload(ProformaVenta.detalles).joinedload(DetalleProformaVenta.producto),
                joinedload(ProformaVenta.usuario),
            )
            .join(PersonaComercial,
                  ProformaVenta.id_persona_comercial == PersonaComercial.id_persona_comercial)
            .filter(
                PersonaComercial.identificacion == cedula,
                ProformaVenta.estado.in_(["cotizada", "aceptada"]),
            )
        )
        if fecha_desde:
            query = query.filter(ProformaVenta.fecha_emision >= fecha_desde)
        if fecha_hasta:
            query = query.filter(ProformaVenta.fecha_emision <= fecha_hasta)
        rows = query.all()
        for p in rows:
            emisor = p.usuario
            if not _match(busqueda, _nombre_emisor(emisor), p.numero_comprobante):
                continue
            result.append({
                "id_comprobante":     f"pro-{p.id_proforma}",
                "tipo":               "proforma",
                "numero_comprobante": p.numero_comprobante,
                "fecha_emision":      p.fecha_emision.isoformat() if p.fecha_emision else None,
                "fecha_recepcion":    None,
                "subtotal_0":         float(p.subtotal_0  or 0),
                "subtotal_iva":       float(p.subtotal_iva or 0),
                "porcentaje_iva":     float(p.porcentaje_iva or 15),
                "iva":                float(p.iva      or 0),
                "descuento":          float(p.descuento or 0),
                "total":              float(p.total),
                "estado":             "pendiente",
                "observaciones":      p.observaciones,
                "created_at":         p.created_at.isoformat() if p.created_at else None,
                "proveedor":          _proveedor_dict(emisor),
                "detalles": [
                    {
                        "id_detalle":      d.id_detalle,
                        "descripcion":     d.producto.nombre if d.producto else f"Producto {d.id_producto}",
                        "cantidad":        float(d.cantidad),
                        "precio_unitario": float(d.precio_unitario),
                        "porcentaje_iva":  float(d.porcentaje_iva),
                        "subtotal":        float(d.subtotal),
                        "descuento":       float(d.descuento or 0),
                        "iva":             float(d.iva or 0),
                        "total":           float(d.total),
                    }
                    for d in (p.detalles or [])
                ],
            })

    result.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return result


# ══════════════════════════════════════════════════════════
# EL RESTO DEL ARCHIVO (HELPER, ENDPOINTS) SE MANTIENE IGUAL
# Solo se actualiza la función _recolectar y el endpoint listar_comprobantes
# para que pase correctamente los filtros de fecha.
# ══════════════════════════════════════════════════════════

def _resolver_comprobante(id_comprobante: str, db: Session, current_user: UsuarioSistema) -> dict:
    todos = _recolectar(db, current_user)
    comp  = next((c for c in todos if str(c["id_comprobante"]) == str(id_comprobante)), None)
    if not comp:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return comp


def _barcode_comp(clave: str, ancho: float):
    bc_ref = code128.Code128(
        clave,
        barWidth=1.0,
        barHeight=24,
        humanReadable=False,
        quiet=False,
    )
    modulos = bc_ref.width
    bar_width = (ancho / modulos) * 0.92
    return code128.Code128(
        clave,
        barWidth=bar_width,
        barHeight=24,
        humanReadable=False,
        quiet=False,
    )


_TIPO_COLORES = {
    "factura":      ("#1e3a8a", "#dbeafe"),
    "nota_credito": ("#065f46", "#d1fae5"),
    "nota_debito":  ("#991b1b", "#fee2e2"),
    "liquidacion":  ("#9d174d", "#fce7f3"),
    "proforma":     ("#5b21b6", "#ede9fe"),
    "retencion":    ("#92400e", "#fef3c7"),
}

_TIPO_NOMBRES = {
    "factura":      "FACTURA",
    "nota_credito": "NOTA DE CRÉDITO",
    "nota_debito":  "NOTA DE DÉBITO",
    "liquidacion":  "LIQUIDACIÓN DE COMPRAS",
    "proforma":     "PROFORMA / COTIZACIÓN",
    "retencion":    "COMPROBANTE DE RETENCIÓN",
}

_TIPO_CODIGOS_SRI = {
    "factura":      "01",
    "nota_credito": "04",
    "nota_debito":  "05",
    "liquidacion":  "03",
    "retencion":    "07",
    "proforma":     "00",
}


def _generar_pdf_comprobante_recibido(comp: dict, db: Session, current_user: UsuarioSistema) -> io.BytesIO:
    tipo      = comp.get("tipo", "factura")
    color_osc, color_claro = _TIPO_COLORES.get(tipo, ("#1e3a8a", "#dbeafe"))
    titulo    = _TIPO_NOMBRES.get(tipo, "COMPROBANTE")
    tipo_doc  = _TIPO_CODIGOS_SRI.get(tipo, "01")

    def _p(clave, default=""):
        return _param_negocio(db, current_user.id_usuario, clave, default)

    neg_ruc           = _p("NEGOCIO_RUC", current_user.cedula or "9999999999999")
    neg_nombre        = _p("NEGOCIO_NOMBRE", _p("NEGOCIO_RAZON_SOCIAL", "Mi Empresa"))
    neg_dir           = _p("NEGOCIO_DIRECCION_MATRIZ", "")
    neg_tel           = _p("NEGOCIO_TELEFONO", "")
    neg_email         = _p("NEGOCIO_EMAIL", "")
    neg_ambiente      = _p("NEGOCIO_AMBIENTE", "Pruebas")
    neg_serie_estab   = _p("NEGOCIO_SERIE_ESTAB", "001")
    neg_serie_emision = _p("NEGOCIO_SERIE_EMISION", "001")

    prov          = comp.get("proveedor") or {}
    nombre_emisor = prov.get("nombres_apellidos") or prov.get("razon_social") or "—"
    ident_emisor  = prov.get("identificacion") or "—"

    try:
        fd = date.fromisoformat(comp.get("fecha_emision", "2024-01-01"))
        fecha_str = fd.strftime("%d%m%Y")
    except Exception:
        fecha_str = "01012024"

    ruc_13       = (ident_emisor or "0"*13).ljust(13, "0")[:13]
    amb_dig      = "2" if "prod" in neg_ambiente.lower() else "1"
    serie        = f"{neg_serie_estab}{neg_serie_emision}"
    num_digits   = "".join(filter(str.isdigit, comp.get("numero_comprobante") or ""))
    secuencial   = num_digits[-9:].zfill(9) if num_digits else "000000001"
    clave_acceso = f"{fecha_str}{tipo_doc}{ruc_13}{amb_dig}{serie}{secuencial}12345678"
    clave_acceso = clave_acceso[:49].ljust(49, "0")

    iva_pct = float(comp.get("porcentaje_iva") or 15)

    buffer = io.BytesIO()
    doc    = SimpleDocTemplate(buffer, pagesize=A4,
                               rightMargin=1.0*cm, leftMargin=1.0*cm,
                               topMargin=1.0*cm,   bottomMargin=1.0*cm)

    C_OSC       = colors.HexColor(color_osc)
    C_CLARO     = colors.HexColor(color_claro)
    GRIS_CLARO  = colors.HexColor("#f9f9f9")
    BORDE       = colors.HexColor("#000000")
    BORDE_CLARO = colors.HexColor("#cccccc")
    BORDE_MUY_C = colors.HexColor("#eeeeee")
    NEGRO       = colors.HexColor("#000000")
    GRIS_TEXTO  = colors.HexColor("#374151")

    sn = ParagraphStyle("sn", fontName="Helvetica",      fontSize=7, leading=9, textColor=NEGRO)
    sb = ParagraphStyle("sb", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=NEGRO)
    sr = ParagraphStyle("sr", fontName="Helvetica",      fontSize=7, leading=9, alignment=TA_RIGHT)

    elements = []
    col_w = doc.width

    # ── Cabecera ──────────────────────────────────────────
    emisor_content = [
        Paragraph(nombre_emisor,
                  ParagraphStyle("nc", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=NEGRO)),
        Paragraph(f"<b>RUC / CI:</b> {ident_emisor}", sn),
    ]
    if prov.get("email"):
        emisor_content.append(Paragraph(f"<b>Email:</b> {prov['email']}", sn))

    emisor_content.append(Spacer(1, 4))
    emisor_content.append(Paragraph(
        "COMPROBANTE RECIBIDO",
        ParagraphStyle("sub", fontName="Helvetica-Bold", fontSize=7, leading=9,
                       textColor=colors.HexColor(color_osc))
    ))
    emisor_content.append(Paragraph(f"<b>Recibido por:</b> {neg_nombre}", sn))
    if neg_dir:
        emisor_content.append(Paragraph(f"<b>Dirección:</b> {neg_dir}", sn))
    if neg_tel:
        emisor_content.append(Paragraph(f"<b>Teléfono:</b> {neg_tel}", sn))
    if neg_email:
        emisor_content.append(Paragraph(f"<b>Email:</b> {neg_email}", sn))

    et = Table([[emisor_content]], colWidths=[col_w*0.55])
    et.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE),
        ("TOPPADDING",(0,0),(-1,-1),8), ("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10), ("RIGHTPADDING",(0,0),(-1,-1),10),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))

    comp_rows = [
        [Paragraph(titulo,
                   ParagraphStyle("tit", fontName="Helvetica-Bold", fontSize=10, leading=13,
                                  alignment=TA_CENTER, textColor=NEGRO)), ""],
        [Paragraph("No.", sb),
         Paragraph(comp.get("numero_comprobante") or "—",
                   ParagraphStyle("mono", fontName="Courier", fontSize=7, leading=9))],
        [Paragraph("<b>CLAVE ACCESO (EMISOR)</b>", sb), ""],
        [Paragraph(clave_acceso,
                   ParagraphStyle("ck2", fontName="Courier", fontSize=5.5, leading=7, wordWrap="CJK")), ""],
        [Paragraph("FECHA EMISIÓN:", sb),
         Paragraph(comp.get("fecha_emision") or "—", sn)],
        [Paragraph("AMBIENTE:", sb), Paragraph(neg_ambiente, sn)],
    ]
    ct = Table(comp_rows, colWidths=[col_w*0.22, col_w*0.23])
    ct.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_CLARO),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),5), ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("SPAN",(0,0),(1,0)), ("ALIGN",(0,0),(1,0),"CENTER"),
        ("BACKGROUND",(0,0),(1,0), C_CLARO),
        ("SPAN",(0,2),(1,2)), ("SPAN",(0,3),(1,3)),
    ]))

    ancho_barcode = col_w * 0.45 - 8
    clave_box = Table([
        [Paragraph("<b>CLAVE DE ACCESO</b>",
                   ParagraphStyle("cat", fontName="Helvetica-Bold", fontSize=7, leading=9, alignment=TA_CENTER))],
        [_barcode_comp(clave_acceso, ancho_barcode)],
        [Paragraph(clave_acceso,
                   ParagraphStyle("ck3", fontName="Courier", fontSize=5.5, leading=7,
                                  alignment=TA_CENTER, wordWrap="CJK"))],
    ], colWidths=[col_w*0.45])
    clave_box.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("ALIGN",(0,0),(-1,-1),"CENTER"),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),4), ("RIGHTPADDING",(0,0),(-1,-1),4),
    ]))

    der = Table([[ct],[clave_box]], colWidths=[col_w*0.45])
    der.setStyle(TableStyle([
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))

    cab = Table([[et, der]], colWidths=[col_w*0.55, col_w*0.45])
    cab.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    elements.append(cab)

    # ── Detalle de ítems ──────────────────────────────────
    detalles = comp.get("detalles") or []
    if detalles:
        det_enc = [
            Paragraph("DESCRIPCIÓN", ParagraphStyle("dh0", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
            Paragraph("CANT.", ParagraphStyle("dh1", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
            Paragraph("P. UNIT.", ParagraphStyle("dh2", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
            Paragraph("IVA %", ParagraphStyle("dh3", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
            Paragraph("SUBTOTAL", ParagraphStyle("dh4", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
            Paragraph("IVA", ParagraphStyle("dh5", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
            Paragraph("TOTAL", ParagraphStyle("dh6", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        ]
        det_filas = [det_enc]
        for idx, d in enumerate(detalles):
            det_filas.append([
                Paragraph(f"<b>{d.get('descripcion','—')}</b>", sb),
                Paragraph(str(d.get('cantidad',1)), ParagraphStyle(f"cn{idx}", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)),
                Paragraph(f"${float(d.get('precio_unitario',0)):.4f}", sr),
                Paragraph(f"{float(d.get('porcentaje_iva',0)):.0f}%", ParagraphStyle(f"iv{idx}", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)),
                Paragraph(f"${float(d.get('subtotal',0)):.2f}", sr),
                Paragraph(f"${float(d.get('iva',0)):.2f}", sr),
                Paragraph(f"${float(d.get('total',0)):.2f}", sr),
            ])

        det_t = Table(det_filas, colWidths=[col_w*0.34, col_w*0.07, col_w*0.13, col_w*0.07, col_w*0.13, col_w*0.11, col_w*0.15])
        det_s = [
            ("BACKGROUND",(0,0),(-1,0), C_OSC), ("TEXTCOLOR",(0,0),(-1,0), colors.white),
            ("FONTSIZE",(0,0),(-1,0),6.5), ("TOPPADDING",(0,0),(-1,0),4), ("BOTTOMPADDING",(0,0),(-1,0),4),
            ("FONTSIZE",(0,1),(-1,-1),7), ("TOPPADDING",(0,1),(-1,-1),3), ("BOTTOMPADDING",(0,1),(-1,-1),3),
            ("LEFTPADDING",(0,0),(-1,-1),5), ("RIGHTPADDING",(0,0),(-1,-1),5),
            ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_MUY_C),
            ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ]
        for i in range(1, len(det_filas)):
            det_s.append(("BACKGROUND",(0,i),(-1,i), colors.white if i%2==1 else GRIS_CLARO))
        det_t.setStyle(TableStyle(det_s))
        elements.append(det_t)

    # ── Totales ───────────────────────────────────────────
    totales_rows = [
        (f"SUBTOTAL {int(iva_pct)}%", float(comp.get("subtotal_iva") or 0)),
        ("SUBTOTAL 0%",               float(comp.get("subtotal_0")   or 0)),
        ("DESCUENTO",                 float(comp.get("descuento")    or 0)),
        (f"IVA {int(iva_pct)}%",      float(comp.get("iva")         or 0)),
        ("VALOR TOTAL",               float(comp.get("total")        or 0)),
    ]
    tot_data = []
    for i, (label, valor) in enumerate(totales_rows):
        es_t = label == "VALOR TOTAL"
        tot_data.append([
            Paragraph(label, ParagraphStyle(f"tl{i}", fontName="Helvetica-Bold" if es_t else "Helvetica", fontSize=7.5, leading=9)),
            Paragraph(f"$ {valor:.2f}", ParagraphStyle(f"tv{i}", fontName="Courier-Bold" if es_t else "Courier", fontSize=7.5, leading=9, alignment=TA_RIGHT)),
        ])

    tot_t = Table(tot_data, colWidths=[col_w*0.30, col_w*0.15])
    tot_s = [
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_MUY_C),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),6), ("RIGHTPADDING",(0,0),(-1,-1),6),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]
    for i in range(len(tot_data)):
        tot_s.append(("BACKGROUND",(0,i),(-1,i), colors.white if i%2==0 else GRIS_CLARO))
    tot_s.append(("BACKGROUND",(0,-1),(-1,-1), C_CLARO))
    tot_s.append(("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"))
    tot_t.setStyle(TableStyle(tot_s))

    bot = Table([[Spacer(col_w*0.55, 1), tot_t]], colWidths=[col_w*0.55, col_w*0.45])
    bot.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    elements.append(bot)

    if comp.get("observaciones"):
        obs_t = Table([[Paragraph(f"<b>Observaciones:</b> {comp['observaciones']}", sn)]], colWidths=[col_w])
        obs_t.setStyle(TableStyle([
            ("BOX",(0,0),(-1,-1),0.75,BORDE),
            ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
            ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ]))
        elements.append(obs_t)

    now = _dt.now()
    h   = now.hour % 12 or 12
    pie_t = Table([[
        Paragraph("Página 1 de 1",
                  ParagraphStyle("pl", fontName="Helvetica", fontSize=6.5, textColor=GRIS_TEXTO)),
        Paragraph(f"FacuStock — Comprobante recibido  ·  {now.day}/{now.month}/{now.year}, {h}:{now.strftime('%M:%S')} {'am' if now.hour < 12 else 'pm'}",
                  ParagraphStyle("pr", fontName="Helvetica-Oblique", fontSize=6.5, textColor=GRIS_TEXTO, alignment=TA_RIGHT)),
    ]], colWidths=[col_w*0.35, col_w*0.65])
    pie_t.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE),
        ("BACKGROUND",(0,0),(-1,-1), colors.HexColor("#f9fafb")),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    elements.append(pie_t)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def _generar_xml_comprobante_recibido(comp: dict) -> bytes:
    tipo = comp.get("tipo", "comprobante")
    root = etree.Element("comprobanteRecibido")
    root.set("tipo", tipo)

    info = etree.SubElement(root, "informacion")
    etree.SubElement(info, "numeroComprobante").text = comp.get("numero_comprobante") or ""
    etree.SubElement(info, "fechaEmision").text      = str(comp.get("fecha_emision") or "")
    etree.SubElement(info, "estado").text            = comp.get("estado") or ""

    prov = comp.get("proveedor") or {}
    emisor = etree.SubElement(info, "emisor")
    etree.SubElement(emisor, "identificacion").text  = prov.get("identificacion") or ""
    etree.SubElement(emisor, "nombre").text          = prov.get("nombres_apellidos") or prov.get("razon_social") or ""

    tot = etree.SubElement(info, "totales")
    etree.SubElement(tot, "subtotal0").text     = str(comp.get("subtotal_0") or 0)
    etree.SubElement(tot, "subtotalIva").text   = str(comp.get("subtotal_iva") or 0)
    etree.SubElement(tot, "porcentajeIva").text = str(comp.get("porcentaje_iva") or 15)
    etree.SubElement(tot, "iva").text           = str(comp.get("iva") or 0)
    etree.SubElement(tot, "descuento").text     = str(comp.get("descuento") or 0)
    etree.SubElement(tot, "total").text         = str(comp.get("total") or 0)

    dets = etree.SubElement(root, "detalles")
    for d in (comp.get("detalles") or []):
        det = etree.SubElement(dets, "detalle")
        etree.SubElement(det, "descripcion").text    = str(d.get("descripcion") or "")
        etree.SubElement(det, "cantidad").text       = str(d.get("cantidad") or 1)
        etree.SubElement(det, "precioUnitario").text = str(d.get("precio_unitario") or 0)
        etree.SubElement(det, "porcentajeIva").text  = str(d.get("porcentaje_iva") or 0)
        etree.SubElement(det, "subtotal").text       = str(d.get("subtotal") or 0)
        etree.SubElement(det, "iva").text            = str(d.get("iva") or 0)
        etree.SubElement(det, "total").text          = str(d.get("total") or 0)

    if comp.get("observaciones"):
        etree.SubElement(root, "observaciones").text = comp["observaciones"]

    return etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="UTF-8")


# ══════════════════════════════════════════════════════════
# ENDPOINTS (SIN CAMBIOS, PERO INCLUYENDO LA LLAMADA A _recolectar)
# ══════════════════════════════════════════════════════════

@router.get("/", response_model=dict)
def listar_comprobantes(
    pagina:      int           = Query(1,  ge=1),
    por_pagina:  int           = Query(10, ge=1, le=100),
    tipo:        Optional[str] = None,
    buscar:      Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    estado:      Optional[str] = None,
    db:          Session       = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    fd = None
    fh = None
    if fecha_desde:
        try:
            fd = date.fromisoformat(fecha_desde)
        except Exception:
            fd = None
    if fecha_hasta:
        try:
            fh = date.fromisoformat(fecha_hasta)
        except Exception:
            fh = None

    todos = _recolectar(db, current_user, tipo=tipo, busqueda=buscar,
                        fecha_desde=fd, fecha_hasta=fh)

    if estado and estado != "todos":
        todos = [c for c in todos if c["estado"] == estado]

    total  = len(todos)
    inicio = (pagina - 1) * por_pagina
    items  = todos[inicio: inicio + por_pagina]

    return {
        "items":         items,
        "total":         total,
        "pagina":        pagina,
        "por_pagina":    por_pagina,
        "total_paginas": math.ceil(total / por_pagina) if total else 1,
    }


@router.get("/resumen", response_model=dict)
def resumen_comprobantes(
    db:           Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    todos       = _recolectar(db, current_user)
    registrados = [c for c in todos if c["estado"] == "registrado"]
    pendientes  = [c for c in todos if c["estado"] == "pendiente"]
    return {
        "registrados":      len(registrados),
        "pendientes":       len(pendientes),
        "anulados":         0,
        "totalRegistrados": round(sum(c["total"] for c in registrados), 2),
        "totalIVA":         round(sum(c["iva"]   for c in registrados), 2),
    }


@router.get("/exportar/csv")
def exportar_csv(
    tipo:        Optional[str] = None,
    buscar:      Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    estado:      Optional[str] = None,
    db:          Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    fd = date.fromisoformat(fecha_desde) if fecha_desde else None
    fh = date.fromisoformat(fecha_hasta) if fecha_hasta else None
    todos = _recolectar(db, current_user, tipo=tipo, busqueda=buscar,
                        fecha_desde=fd, fecha_hasta=fh)
    if estado and estado != "todos":
        todos = [c for c in todos if c["estado"] == estado]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Tipo", "Número Comprobante", "Emisor", "Identificación Emisor",
        "Fecha Emisión", "Estado", "Subtotal 0%", "Subtotal IVA",
        "% IVA", "IVA", "Descuento", "Total"
    ])
    for c in todos:
        prov = c.get("proveedor") or {}
        writer.writerow([
            c.get("id_comprobante"),
            c.get("tipo"),
            c.get("numero_comprobante"),
            prov.get("nombres_apellidos") or prov.get("razon_social") or "",
            prov.get("identificacion") or "",
            c.get("fecha_emision"),
            c.get("estado"),
            c.get("subtotal_0"),
            c.get("subtotal_iva"),
            c.get("porcentaje_iva"),
            c.get("iva"),
            c.get("descuento"),
            c.get("total"),
        ])

    output.seek(0)
    now_str = _dt.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=comprobantes_recibidos_{now_str}.csv",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


@router.get("/exportar/xml")
def exportar_xml_todos(
    tipo:        Optional[str] = None,
    buscar:      Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    estado:      Optional[str] = None,
    db:          Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user),
):
    fd = date.fromisoformat(fecha_desde) if fecha_desde else None
    fh = date.fromisoformat(fecha_hasta) if fecha_hasta else None
    todos = _recolectar(db, current_user, tipo=tipo, busqueda=buscar,
                        fecha_desde=fd, fecha_hasta=fh)
    if estado and estado != "todos":
        todos = [c for c in todos if c["estado"] == estado]

    root = etree.Element("comprobantesRecibidos")
    root.set("total", str(len(todos)))
    root.set("exportado", _dt.now().isoformat())
    for c in todos:
        comp_el = etree.SubElement(root, "comprobante")
        comp_el.set("tipo", c.get("tipo") or "")
        etree.SubElement(comp_el, "id").text             = str(c.get("id_comprobante"))
        etree.SubElement(comp_el, "numero").text         = c.get("numero_comprobante") or ""
        etree.SubElement(comp_el, "fechaEmision").text   = str(c.get("fecha_emision") or "")
        etree.SubElement(comp_el, "estado").text         = c.get("estado") or ""
        etree.SubElement(comp_el, "total").text          = str(c.get("total") or 0)
        prov = c.get("proveedor") or {}
        emisor_el = etree.SubElement(comp_el, "emisor")
        etree.SubElement(emisor_el, "nombre").text         = prov.get("nombres_apellidos") or ""
        etree.SubElement(emisor_el, "identificacion").text = prov.get("identificacion") or ""

    xml_bytes = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="UTF-8")
    now_str   = _dt.now().strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        io.BytesIO(xml_bytes),
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=comprobantes_recibidos_{now_str}.xml",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


@router.get("/{id_comprobante}/pdf/")
def descargar_pdf(
    id_comprobante: str,
    db:             Session = Depends(get_db),
    current_user:   UsuarioSistema = Depends(get_current_user),
):
    comp   = _resolver_comprobante(id_comprobante, db, current_user)
    buffer = _generar_pdf_comprobante_recibido(comp, db, current_user)
    numero = (comp.get("numero_comprobante") or id_comprobante).replace("/", "-")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=comp_recibido_{numero}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


@router.get("/{id_comprobante}/xml/")
def descargar_xml(
    id_comprobante: str,
    db:             Session = Depends(get_db),
    current_user:   UsuarioSistema = Depends(get_current_user),
):
    comp      = _resolver_comprobante(id_comprobante, db, current_user)
    xml_bytes = _generar_xml_comprobante_recibido(comp)
    numero    = (comp.get("numero_comprobante") or id_comprobante).replace("/", "-")
    return StreamingResponse(
        io.BytesIO(xml_bytes),
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=comp_recibido_{numero}.xml",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


@router.get("/{id_comprobante}", response_model=dict)
def obtener_comprobante(
    id_comprobante: str,
    db:             Session = Depends(get_db),
    current_user:   UsuarioSistema = Depends(get_current_user),
):
    return _resolver_comprobante(id_comprobante, db, current_user)
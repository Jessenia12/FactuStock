from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from decimal import Decimal
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, validator
import math
import io
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from lxml import etree

from database import get_db
from models import PersonaComercial, UsuarioSistema, ParametroSistema, LiquidacionCompra, DetalleLiquidacionCompra
from dependencies import get_current_user


# ─── Helper: cargar logo para ReportLab ──────────────────
def _logo_image(logo_url: str, max_w: float, max_h: float):
    """
    Recibe la URL guardada en NEGOCIO_LOGO (ej: /uploads/logos_negocio/logo.png).
    Prueba múltiples rutas en disco y devuelve un Image de ReportLab escalado, o None.
    """
    if not logo_url:
        return None
    import logging, os as _os
    logger = logging.getLogger(__name__)
    rel = logo_url.lstrip("/")
    cwd = _os.getcwd()
    candidates = [
        _os.path.join(cwd, rel),
        logo_url,
        _os.path.join(_os.environ.get("BASE_DIR", cwd), rel),
        _os.path.join(_os.environ.get("MEDIA_ROOT", "media"), rel),
    ]
    path = next((c for c in candidates if c and _os.path.isfile(c)), None)
    if not path:
        logger.warning("Logo no encontrado. logo_url=%r  cwd=%r", logo_url, cwd)
        return None
    try:
        img = Image(path)
        ratio = min(max_w / img.imageWidth, max_h / img.imageHeight)
        img.drawWidth  = img.imageWidth  * ratio
        img.drawHeight = img.imageHeight * ratio
        return img
    except Exception as e:
        logger.warning("Error cargando logo %r: %s", path, e)
        return None

router = APIRouter(prefix="/api/liquidaciones", tags=["Liquidaciones de Compras"])


# ─── Schemas Pydantic ─────────────────────────────────────
class DetalleLC(BaseModel):
    descripcion:     str
    cantidad:        Decimal
    precio_unitario: Decimal
    porcentaje_iva:  Decimal = Decimal("0.00")
    descuento:       Decimal = Decimal("0.00")

    @validator("cantidad")
    def cantidad_positiva(cls, v):
        if v <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
        return v

class LiquidacionCreate(BaseModel):
    id_persona_comercial: int
    fecha_emision:        date
    porcentaje_iva:       Decimal = Decimal("15.00")
    observaciones:        Optional[str] = None
    detalles:             list[DetalleLC]

    @validator("detalles")
    def al_menos_uno(cls, v):
        if not v:
            raise ValueError("Debe agregar al menos un ítem")
        return v


# ─── Helpers ──────────────────────────────────────────────
def _generar_numero(db: Session, id_usuario: int) -> str:
    param_e = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == id_usuario,
        ParametroSistema.clave == "NEGOCIO_SERIE_ESTAB"
    ).first()
    param_p = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == id_usuario,
        ParametroSistema.clave == "NEGOCIO_SERIE_EMISION"
    ).first()
    estab   = param_e.valor if param_e else "001"
    emision = param_p.valor if param_p else "001"
    total = db.query(func.count(LiquidacionCompra.id_liquidacion)).filter(
        LiquidacionCompra.id_usuario == id_usuario
    ).scalar() or 0
    return f"{estab}-{emision}-{str(total + 1).zfill(9)}"


def _calcular(item: DetalleLC):
    cantidad  = Decimal(str(item.cantidad))
    precio    = Decimal(str(item.precio_unitario))
    descuento = Decimal(str(item.descuento))
    pct_iva   = Decimal(str(item.porcentaje_iva))
    subtotal  = (cantidad * precio) - descuento
    iva       = round(subtotal * (pct_iva / 100), 2) if pct_iva > 0 else Decimal("0.00")
    return subtotal, iva, subtotal + iva


def _param_negocio(db, id_usuario, clave, default=""):
    p = db.query(ParametroSistema).filter(
        ParametroSistema.clave == clave,
        ParametroSistema.id_usuario == id_usuario
    ).first()
    return p.valor if p else default


def _serial(lc: LiquidacionCompra) -> dict:
    return {
        "id_liquidacion":      lc.id_liquidacion,
        "numero_comprobante":  lc.numero_comprobante,
        "fecha_emision":       str(lc.fecha_emision),
        "subtotal_0":          float(lc.subtotal_0),
        "subtotal_iva":        float(lc.subtotal_iva),
        "porcentaje_iva":      float(lc.porcentaje_iva),
        "iva":                 float(lc.iva),
        "descuento":           float(lc.descuento),
        "total":               float(lc.total),
        "estado":              lc.estado,
        "observaciones":       lc.observaciones,
        "created_at":          str(lc.created_at),
        "proveedor": {
            "id_persona_comercial": lc.id_persona_comercial,
            "nombres_apellidos":    lc.proveedor.nombres_apellidos if lc.proveedor else "",
            "razon_social":         lc.proveedor.razon_social if lc.proveedor else "",
            "identificacion":       lc.proveedor.identificacion if lc.proveedor else "",
        } if lc.proveedor else None,
    }


def _serial_full(lc: LiquidacionCompra) -> dict:
    base = _serial(lc)
    base["detalles"] = [
        {
            "id_detalle":      d.id_detalle,
            "descripcion":     d.descripcion,
            "cantidad":        float(d.cantidad),
            "precio_unitario": float(d.precio_unitario),
            "porcentaje_iva":  float(d.porcentaje_iva),
            "subtotal":        float(d.subtotal),
            "descuento":       float(d.descuento),
            "iva":             float(d.iva),
            "total":           float(d.total),
        }
        for d in lc.detalles
    ]
    return base


# ─── GET / ────────────────────────────────────────────────
@router.get("/", response_model=dict)
def listar(
    pagina:     int = Query(1, ge=1),
    por_pagina: int = Query(10, ge=1, le=100),
    estado:     Optional[str] = None,
    buscar:     Optional[str] = None,
    db:         Session = Depends(get_db),
    usuario:    UsuarioSistema = Depends(get_current_user),
):
    q = (
        db.query(LiquidacionCompra)
        .options(joinedload(LiquidacionCompra.proveedor))
        .filter(LiquidacionCompra.id_usuario == usuario.id_usuario)
    )
    if estado:
        q = q.filter(LiquidacionCompra.estado == estado)
    if buscar:
        q = q.join(
            PersonaComercial,
            LiquidacionCompra.id_persona_comercial == PersonaComercial.id_persona_comercial,
            isouter=True
        ).filter(
            LiquidacionCompra.numero_comprobante.contains(buscar) |
            PersonaComercial.nombres_apellidos.contains(buscar)   |
            PersonaComercial.razon_social.contains(buscar)
        )
    total = q.count()
    items = (
        q.order_by(LiquidacionCompra.created_at.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina).all()
    )
    return {
        "items":      [_serial(lc) for lc in items],
        "total":      total,
        "pagina":     pagina,
        "por_pagina": por_pagina,
        "paginas":    max(1, math.ceil(total / por_pagina)),
    }


# ─── GET /resumen ─────────────────────────────────────────
@router.get("/resumen", response_model=dict)
def resumen(
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    filas = db.query(
        LiquidacionCompra.estado,
        func.count(LiquidacionCompra.id_liquidacion).label("cantidad"),
        func.coalesce(func.sum(LiquidacionCompra.total), 0).label("monto"),
    ).filter(LiquidacionCompra.id_usuario == usuario.id_usuario) \
     .group_by(LiquidacionCompra.estado).all()

    res = {"emitidas": 0, "anuladas": 0, "totalEmitido": 0.0}
    for f in filas:
        if f.estado == "emitida":
            res["emitidas"]     = f.cantidad
            res["totalEmitido"] = float(f.monto)
        elif f.estado == "anulada":
            res["anuladas"] = f.cantidad
    return res


# ─── GET /{id} ────────────────────────────────────────────
@router.get("/{id_liquidacion}", response_model=dict)
def obtener(
    id_liquidacion: int,
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    lc = (
        db.query(LiquidacionCompra)
        .options(joinedload(LiquidacionCompra.proveedor), joinedload(LiquidacionCompra.detalles))
        .filter(
            LiquidacionCompra.id_liquidacion == id_liquidacion,
            LiquidacionCompra.id_usuario     == usuario.id_usuario,
        ).first()
    )
    if not lc:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    return _serial_full(lc)


# ─── GET /{id}/pdf/ ───────────────────────────────────────
@router.get("/{id_liquidacion}/pdf/")
def descargar_pdf(
    id_liquidacion: int,
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    lc = (
        db.query(LiquidacionCompra)
        .options(joinedload(LiquidacionCompra.proveedor), joinedload(LiquidacionCompra.detalles))
        .filter(
            LiquidacionCompra.id_liquidacion == id_liquidacion,
            LiquidacionCompra.id_usuario     == usuario.id_usuario,
        ).first()
    )
    if not lc:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")

    uid = usuario.id_usuario
    neg_ruc          = _param_negocio(db, uid, "NEGOCIO_RUC",          usuario.cedula or "9999999999999")
    neg_razon_social = _param_negocio(db, uid, "NEGOCIO_RAZON_SOCIAL", "NOMBRE DEL NEGOCIO S.A.")
    neg_nombre       = _param_negocio(db, uid, "NEGOCIO_NOMBRE",       neg_razon_social)
    neg_dir_matriz   = _param_negocio(db, uid, "NEGOCIO_DIRECCION_MATRIZ", "")
    neg_telefono     = _param_negocio(db, uid, "NEGOCIO_TELEFONO",     "")
    neg_email        = _param_negocio(db, uid, "NEGOCIO_EMAIL",        "")
    neg_ambiente     = _param_negocio(db, uid, "NEGOCIO_AMBIENTE",     "Pruebas")
    neg_obligado     = _param_negocio(db, uid, "NEGOCIO_OBLIGADO_CONT","NO")
    neg_logo_url     = _param_negocio(db, uid, "NEGOCIO_LOGO",            "")
    logo_img         = _logo_image(neg_logo_url, max_w=140, max_h=70)

    nombre_prov    = (lc.proveedor.nombres_apellidos or lc.proveedor.razon_social or "—") if lc.proveedor else "—"
    identificacion = lc.proveedor.identificacion if lc.proveedor else "—"
    iva_pct        = float(lc.porcentaje_iva) if lc.porcentaje_iva else 0

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=1.0*cm, leftMargin=1.0*cm,
        topMargin=1.0*cm,   bottomMargin=1.0*cm)

    ROSA_OSC    = colors.HexColor("#be185d")
    GRIS_CLARO  = colors.HexColor("#f9f9f9")
    BORDE       = colors.HexColor("#000000")
    BORDE_CLARO = colors.HexColor("#cccccc")
    BORDE_MUY_C = colors.HexColor("#eeeeee")
    NEGRO       = colors.HexColor("#000000")
    GRIS_TEXTO  = colors.HexColor("#374151")
    ROSA_TOTAL  = colors.HexColor("#fce7f3")

    sn = ParagraphStyle("sn", fontName="Helvetica",      fontSize=7, leading=9, textColor=NEGRO)
    sb = ParagraphStyle("sb", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=NEGRO)
    sr = ParagraphStyle("sr", fontName="Helvetica",      fontSize=7, leading=9, alignment=TA_RIGHT)

    elements = []
    col_w = doc.width

    emisor_content = [
        # Logo: si existe se muestra primero
        *([Table([[logo_img]], colWidths=[140],
                 style=[("LEFTPADDING",(0,0),(-1,-1),0),
                        ("RIGHTPADDING",(0,0),(-1,-1),0),
                        ("TOPPADDING",(0,0),(-1,-1),0),
                        ("BOTTOMPADDING",(0,0),(-1,-1),4)])]
           if logo_img else []),
        Paragraph(neg_nombre or neg_razon_social,
                  ParagraphStyle("nc", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=NEGRO)),
    ]
    if neg_razon_social and neg_razon_social != neg_nombre:
        emisor_content.append(Paragraph(neg_razon_social, sn))
    if neg_dir_matriz:
        emisor_content.append(Paragraph(f"<b>Dir. Matriz:</b> {neg_dir_matriz}", sn))
    if neg_telefono:
        emisor_content.append(Paragraph(f"<b>Teléfono:</b> {neg_telefono}", sn))
    if neg_email:
        emisor_content.append(Paragraph(f"<b>Email:</b> {neg_email}", sn))
    emisor_content.append(Paragraph(f"<b>Obligado A Llevar Contabilidad:</b> {neg_obligado}", sn))

    emisor_tabla = Table([[emisor_content]], colWidths=[col_w * 0.55])
    emisor_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE),
        ("TOPPADDING",(0,0),(-1,-1),8), ("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10), ("RIGHTPADDING",(0,0),(-1,-1),10),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))

    comp_rows = [
        [Paragraph("<b>R.U.C:</b>", sb), Paragraph(neg_ruc or "—", sb)],
        [Paragraph("LIQUIDACIÓN DE COMPRAS",
                   ParagraphStyle("lc2", fontName="Helvetica-Bold", fontSize=10, leading=12,
                                  alignment=TA_CENTER, textColor=NEGRO)), ""],
        [Paragraph("No.", sb), Paragraph(lc.numero_comprobante or "—",
                   ParagraphStyle("mono", fontName="Courier", fontSize=7, leading=9))],
        [Paragraph("FECHA EMISIÓN:", sb), Paragraph(lc.fecha_emision.strftime('%d/%m/%Y'), sn)],
        [Paragraph("AMBIENTE:", sb), Paragraph(neg_ambiente, sn)],
    ]
    comp_tabla = Table(comp_rows, colWidths=[col_w * 0.20, col_w * 0.25])
    comp_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_CLARO),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),5), ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("SPAN",(0,1),(1,1)), ("ALIGN",(0,1),(1,1),"CENTER"),
    ]))

    cabecera = Table([[emisor_tabla, comp_tabla]], colWidths=[col_w * 0.55, col_w * 0.45])
    cabecera.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    elements.append(cabecera)

    receptor_data = [
        [Paragraph(f"<b>Proveedor (No obligado a facturar):</b> {nombre_prov}", sn),
         Paragraph(f"<b>C.I. / RUC:</b> {identificacion}", sn)],
        [Paragraph(f"<b>Fecha Emisión:</b> {lc.fecha_emision.strftime('%d/%m/%Y')}", sn),
         Paragraph(f"<b>IVA:</b> {int(iva_pct)}%", sn)],
    ]
    receptor_tabla = Table(receptor_data, colWidths=[col_w * 0.6, col_w * 0.4])
    receptor_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_CLARO),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    elements.append(receptor_tabla)

    det_encab = [
        Paragraph("DESCRIPCIÓN", ParagraphStyle("dh1", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("CANT.",       ParagraphStyle("dh2", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("P. UNITARIO", ParagraphStyle("dh3", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("DESCUENTO",   ParagraphStyle("dh4", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("SUBTOTAL",    ParagraphStyle("dh5", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("IVA",         ParagraphStyle("dh6", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("TOTAL",       ParagraphStyle("dh7", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]
    det_filas = [det_encab]
    for idx, d in enumerate(lc.detalles):
        cant = float(d.cantidad)
        det_filas.append([
            Paragraph(d.descripcion or "—", sb),
            Paragraph(str(int(cant) if cant == int(cant) else cant),
                      ParagraphStyle(f"c{idx}", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)),
            Paragraph(f"${float(d.precio_unitario):.5f}", sr),
            Paragraph(f"${float(d.descuento):.2f}", sr),
            Paragraph(f"${float(d.subtotal):.2f}", sr),
            Paragraph(f"${float(d.iva):.2f}", sr),
            Paragraph(f"${float(d.total):.2f}", sr),
        ])

    det_tabla = Table(det_filas, colWidths=[col_w*0.30, col_w*0.07, col_w*0.14, col_w*0.11, col_w*0.13, col_w*0.11, col_w*0.14])
    det_style = [
        ("BACKGROUND",(0,0),(-1,0),ROSA_OSC), ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("FONTSIZE",(0,0),(-1,0),6.5), ("TOPPADDING",(0,0),(-1,0),4), ("BOTTOMPADDING",(0,0),(-1,0),4),
        ("FONTSIZE",(0,1),(-1,-1),7), ("TOPPADDING",(0,1),(-1,-1),3), ("BOTTOMPADDING",(0,1),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),5), ("RIGHTPADDING",(0,0),(-1,-1),5),
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_MUY_C),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]
    for i in range(1, len(det_filas)):
        det_style.append(("BACKGROUND",(0,i),(-1,i), colors.white if i % 2 == 1 else GRIS_CLARO))
    det_tabla.setStyle(TableStyle(det_style))
    elements.append(det_tabla)

    totales_rows = [
        (f"SUBTOTAL {int(iva_pct)}%", float(lc.subtotal_iva)),
        ("SUBTOTAL 0%",               float(lc.subtotal_0)),
        ("DESCUENTO",                 float(lc.descuento)),
        (f"IVA {int(iva_pct)}%",      float(lc.iva)),
        ("VALOR TOTAL",               float(lc.total)),
    ]
    tot_data = []
    for i, (label, valor) in enumerate(totales_rows):
        es_total = label == "VALOR TOTAL"
        tot_data.append([
            Paragraph(label, ParagraphStyle(f"tl{i}", fontName="Helvetica-Bold" if es_total else "Helvetica", fontSize=7.5, leading=9)),
            Paragraph(f"$ {valor:.2f}", ParagraphStyle(f"tv{i}", fontName="Courier-Bold" if es_total else "Courier", fontSize=7.5, leading=9, alignment=TA_RIGHT)),
        ])

    tot_tabla = Table(tot_data, colWidths=[col_w*0.30, col_w*0.15])
    tot_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_MUY_C),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),6), ("RIGHTPADDING",(0,0),(-1,-1),6),
        ("BACKGROUND",(0,-1),(-1,-1),ROSA_TOTAL), ("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),
    ]))

    bottom = Table([[Spacer(1,1), tot_tabla]], colWidths=[col_w*0.55, col_w*0.45])
    bottom.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    elements.append(bottom)

    if lc.observaciones:
        elements.append(Table(
            [[Paragraph(f"<b>Observaciones:</b> {lc.observaciones}", sn)]],
            colWidths=[col_w]
        ))

    _now = datetime.now()
    pie_data = [[
        Paragraph("Página 1 de 1", ParagraphStyle("pl", fontName="Helvetica", fontSize=6.5, textColor=GRIS_TEXTO)),
        Paragraph(f"Generado por FacuStock  ·  {_now.strftime('%d/%m/%Y %H:%M')}",
                  ParagraphStyle("pr", fontName="Helvetica-Oblique", fontSize=6.5, textColor=GRIS_TEXTO, alignment=TA_RIGHT)),
    ]]
    pie_tabla = Table(pie_data, colWidths=[col_w*0.35, col_w*0.65])
    pie_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE),
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f9fafb")),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    elements.append(pie_tabla)

    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(
        buffer, media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=liquidacion_{lc.numero_comprobante}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── GET /{id}/xml/ ───────────────────────────────────────
@router.get("/{id_liquidacion}/xml/")
def descargar_xml(
    id_liquidacion: int,
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    lc = (
        db.query(LiquidacionCompra)
        .options(joinedload(LiquidacionCompra.proveedor), joinedload(LiquidacionCompra.detalles))
        .filter(
            LiquidacionCompra.id_liquidacion == id_liquidacion,
            LiquidacionCompra.id_usuario     == usuario.id_usuario,
        ).first()
    )
    if not lc:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")

    root = etree.Element("liquidacionCompras")
    info = etree.SubElement(root, "infoLiquidacion")
    etree.SubElement(info, "fechaEmision").text      = str(lc.fecha_emision)
    etree.SubElement(info, "numeroComprobante").text = lc.numero_comprobante
    etree.SubElement(info, "estado").text            = lc.estado

    prov = etree.SubElement(info, "proveedor")
    etree.SubElement(prov, "identificacion").text = (lc.proveedor.identificacion or "") if lc.proveedor else ""
    etree.SubElement(prov, "nombre").text         = ((lc.proveedor.nombres_apellidos or lc.proveedor.razon_social or "") if lc.proveedor else "")

    tot = etree.SubElement(info, "totales")
    etree.SubElement(tot, "subtotal0").text    = str(lc.subtotal_0)
    etree.SubElement(tot, "subtotalIva").text  = str(lc.subtotal_iva)
    etree.SubElement(tot, "porcentajeIva").text= str(lc.porcentaje_iva)
    etree.SubElement(tot, "iva").text          = str(lc.iva)
    etree.SubElement(tot, "descuento").text    = str(lc.descuento)
    etree.SubElement(tot, "total").text        = str(lc.total)

    dets = etree.SubElement(root, "detalles")
    for d in lc.detalles:
        det = etree.SubElement(dets, "detalle")
        etree.SubElement(det, "descripcion").text    = d.descripcion or ""
        etree.SubElement(det, "cantidad").text       = str(d.cantidad)
        etree.SubElement(det, "precioUnitario").text = str(d.precio_unitario)
        etree.SubElement(det, "descuento").text      = str(d.descuento)
        etree.SubElement(det, "subtotal").text       = str(d.subtotal)
        etree.SubElement(det, "iva").text            = str(d.iva)
        etree.SubElement(det, "total").text          = str(d.total)

    if lc.observaciones:
        etree.SubElement(root, "observaciones").text = lc.observaciones

    xml_bytes = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="UTF-8")
    return StreamingResponse(
        io.BytesIO(xml_bytes), media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=liquidacion_{lc.numero_comprobante}.xml",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── POST / ───────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
def crear(
    datos:   LiquidacionCreate,
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    proveedor = db.query(PersonaComercial).filter(
        PersonaComercial.id_persona_comercial == datos.id_persona_comercial,
        PersonaComercial.id_usuario           == usuario.id_usuario,
    ).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    if not proveedor.flag_proveedor:
        proveedor.flag_proveedor = True

    subtotal_0   = Decimal("0.00")
    subtotal_iva = Decimal("0.00")
    total_iva    = Decimal("0.00")
    total_desc   = Decimal("0.00")
    detalles_orm = []

    for item in datos.detalles:
        subtotal, iva, total_linea = _calcular(item)
        total_desc += Decimal(str(item.descuento))
        if item.porcentaje_iva > 0:
            subtotal_iva += subtotal
        else:
            subtotal_0 += subtotal
        total_iva += iva
        detalles_orm.append(DetalleLiquidacionCompra(
            descripcion     = item.descripcion.strip(),
            cantidad        = item.cantidad,
            precio_unitario = item.precio_unitario,
            porcentaje_iva  = item.porcentaje_iva,
            subtotal        = subtotal,
            descuento       = item.descuento,
            iva             = iva,
            total           = total_linea,
        ))

    total_lc = subtotal_0 + subtotal_iva + total_iva

    lc = LiquidacionCompra(
        id_usuario           = usuario.id_usuario,
        id_persona_comercial = datos.id_persona_comercial,
        numero_comprobante   = _generar_numero(db, usuario.id_usuario),
        fecha_emision        = datos.fecha_emision,
        porcentaje_iva       = datos.porcentaje_iva,
        subtotal_0           = subtotal_0,
        subtotal_iva         = subtotal_iva,
        iva                  = total_iva,
        descuento            = total_desc,
        total                = total_lc,
        observaciones        = datos.observaciones,
        estado               = "emitida",
    )
    db.add(lc)
    db.flush()

    for det in detalles_orm:
        det.id_liquidacion = lc.id_liquidacion
        db.add(det)

    db.commit()
    db.refresh(lc)

    result = (
        db.query(LiquidacionCompra)
        .options(joinedload(LiquidacionCompra.proveedor), joinedload(LiquidacionCompra.detalles))
        .filter(LiquidacionCompra.id_liquidacion == lc.id_liquidacion).first()
    )
    return _serial_full(result)


# ─── PATCH /{id}/anular ───────────────────────────────────
@router.patch("/{id_liquidacion}/anular")
def anular(
    id_liquidacion: int,
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    lc = db.query(LiquidacionCompra).filter(
        LiquidacionCompra.id_liquidacion == id_liquidacion,
        LiquidacionCompra.id_usuario     == usuario.id_usuario,
    ).first()
    if not lc:
        raise HTTPException(status_code=404, detail="Liquidación no encontrada")
    if lc.estado == "anulada":
        raise HTTPException(status_code=400, detail="La liquidación ya está anulada")
    lc.estado = "anulada"
    db.commit()
    return {"mensaje": "Liquidación anulada", "id_liquidacion": id_liquidacion}
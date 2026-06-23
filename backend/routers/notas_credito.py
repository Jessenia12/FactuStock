from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
import math
import io
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.graphics.barcode import code128
from lxml import etree

from database import get_db
from models import (
    NotaCredito, DetalleNotaCredito, FacturaVenta,
    DetalleFacturaVenta, Producto, PersonaComercial,
    UsuarioSistema, ParametroSistema
)
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

router = APIRouter(prefix="/api/notas-credito", tags=["Notas de Crédito"])


def _generar_numero_nc(db: Session, id_usuario: int) -> str:
    param = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == id_usuario,
        ParametroSistema.clave == "NEGOCIO_SERIE_ESTAB"
    ).first()
    estab = param.valor if param else "001"
    param2 = db.query(ParametroSistema).filter(
        ParametroSistema.id_usuario == id_usuario,
        ParametroSistema.clave == "NEGOCIO_SERIE_EMISION"
    ).first()
    emision = param2.valor if param2 else "001"
    total = db.query(func.count(NotaCredito.id_nota_credito)).filter(
        NotaCredito.id_usuario == id_usuario
    ).scalar() or 0
    return f"{estab}-{emision}-{str(total + 1).zfill(9)}"


def _calcular_linea(cantidad, precio_unitario, porcentaje_iva):
    cant = Decimal(str(cantidad))
    precio = Decimal(str(precio_unitario))
    pct_iva = Decimal(str(porcentaje_iva))
    subtotal = cant * precio
    iva = round(subtotal * (pct_iva / 100), 2) if pct_iva > 0 else Decimal("0.00")
    return subtotal, iva, subtotal + iva


def _param_negocio(db, id_usuario, clave, default=""):
    p = db.query(ParametroSistema).filter(
        ParametroSistema.clave == clave,
        ParametroSistema.id_usuario == id_usuario
    ).first()
    return p.valor if p else default


# ─── GET /api/notas-credito/ ─────────────────────────────
@router.get("/", response_model=dict)
def listar_notas(
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(10, ge=1, le=100),
    estado: Optional[str] = None,
    id_factura: Optional[int] = None,
    buscar: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    query = (
        db.query(NotaCredito)
        .options(
            joinedload(NotaCredito.cliente),
            joinedload(NotaCredito.factura),
        )
        .filter(NotaCredito.id_usuario == current_user.id_usuario)
    )
    if estado:     query = query.filter(NotaCredito.estado == estado)
    if id_factura: query = query.filter(NotaCredito.id_factura == id_factura)
    if buscar:
        query = query.join(PersonaComercial).filter(
            NotaCredito.numero_comprobante.contains(buscar) |
            PersonaComercial.nombres_apellidos.contains(buscar) |
            PersonaComercial.razon_social.contains(buscar)
        )
    total = query.count()
    notas = query.order_by(NotaCredito.created_at.desc()) \
                 .offset((pagina - 1) * por_pagina).limit(por_pagina).all()

    def _serialize(n):
        return {
            "id_nota_credito":    n.id_nota_credito,
            "numero_comprobante": n.numero_comprobante,
            "fecha_emision":      str(n.fecha_emision),
            "motivo":             n.motivo.value if hasattr(n.motivo, "value") else n.motivo,
            "subtotal_0":         float(n.subtotal_0),
            "subtotal_iva":       float(n.subtotal_iva),
            "iva":                float(n.iva),
            "total":              float(n.total),
            "estado":             n.estado.value if hasattr(n.estado, "value") else n.estado,
            "created_at":         str(n.created_at),
            "factura_numero":     n.factura.numero_comprobante if n.factura else None,
            "id_factura":         n.id_factura,
            "cliente": {
                "nombres_apellidos": n.cliente.nombres_apellidos if n.cliente else None,
                "razon_social":      n.cliente.razon_social if n.cliente else None,
                "identificacion":    n.cliente.identificacion if n.cliente else None,
            } if n.cliente else None,
        }

    return {
        "items":         [_serialize(n) for n in notas],
        "total":         total,
        "pagina":        pagina,
        "por_pagina":    por_pagina,
        "total_paginas": math.ceil(total / por_pagina) if total else 1,
    }


# ─── GET /api/notas-credito/resumen ──────────────────────
@router.get("/resumen", response_model=dict)
def resumen_notas(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    filas = db.query(
        NotaCredito.estado,
        func.count(NotaCredito.id_nota_credito).label("cantidad"),
        func.coalesce(func.sum(NotaCredito.total), 0).label("monto")
    ).filter(NotaCredito.id_usuario == current_user.id_usuario) \
     .group_by(NotaCredito.estado).all()

    res = {"emitidas": 0, "anuladas": 0, "totalEmitido": 0.0}
    for f in filas:
        est = f.estado.value if hasattr(f.estado, "value") else str(f.estado)
        if est == "emitida":
            res["emitidas"]     = f.cantidad
            res["totalEmitido"] = float(f.monto)
        elif est == "anulada":
            res["anuladas"] = f.cantidad
    return res


# ─── GET /api/notas-credito/{id} ─────────────────────────
@router.get("/{id_nota}", response_model=dict)
def obtener_nota(
    id_nota: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    nota = (
        db.query(NotaCredito)
        .options(
            joinedload(NotaCredito.cliente),
            joinedload(NotaCredito.factura).joinedload(FacturaVenta.detalles).joinedload(DetalleFacturaVenta.producto),
            joinedload(NotaCredito.detalles).joinedload(DetalleNotaCredito.producto),
        )
        .filter(
            NotaCredito.id_nota_credito == id_nota,
            NotaCredito.id_usuario == current_user.id_usuario
        ).first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")

    def _det(d):
        return {
            "id_detalle":      d.id_detalle,
            "id_producto":     d.id_producto,
            "descripcion":     d.descripcion,
            "cantidad":        d.cantidad,
            "precio_unitario": float(d.precio_unitario),
            "porcentaje_iva":  float(d.porcentaje_iva),
            "subtotal":        float(d.subtotal),
            "iva":             float(d.iva),
            "total":           float(d.total),
            "producto":        {"nombre": d.producto.nombre, "codigo": d.producto.codigo} if d.producto else None,
        }

    return {
        "id_nota_credito":    nota.id_nota_credito,
        "numero_comprobante": nota.numero_comprobante,
        "fecha_emision":      str(nota.fecha_emision),
        "motivo":             nota.motivo.value if hasattr(nota.motivo, "value") else nota.motivo,
        "subtotal_0":         float(nota.subtotal_0),
        "subtotal_iva":       float(nota.subtotal_iva),
        "porcentaje_iva":     float(nota.porcentaje_iva),
        "iva":                float(nota.iva),
        "total":              float(nota.total),
        "estado":             nota.estado.value if hasattr(nota.estado, "value") else nota.estado,
        "observaciones":      nota.observaciones,
        "created_at":         str(nota.created_at),
        "id_factura":         nota.id_factura,
        "factura_numero":     nota.factura.numero_comprobante if nota.factura else None,
        "factura_total":      float(nota.factura.total) if nota.factura else None,
        "cliente":            {
            "id_persona_comercial": nota.cliente.id_persona_comercial,
            "nombres_apellidos":    nota.cliente.nombres_apellidos,
            "razon_social":         nota.cliente.razon_social,
            "identificacion":       nota.cliente.identificacion,
        } if nota.cliente else None,
        "detalles": [_det(d) for d in nota.detalles],
    }


# ─── GET /api/notas-credito/{id}/pdf/ ────────────────────
@router.get("/{id_nota}/pdf/")
def descargar_pdf(
    id_nota: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    nota = (
        db.query(NotaCredito)
        .options(
            joinedload(NotaCredito.cliente),
            joinedload(NotaCredito.factura),
            joinedload(NotaCredito.detalles).joinedload(DetalleNotaCredito.producto),
        )
        .filter(
            NotaCredito.id_nota_credito == id_nota,
            NotaCredito.id_usuario == current_user.id_usuario
        ).first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")

    uid = current_user.id_usuario
    neg_ruc          = _param_negocio(db, uid, "NEGOCIO_RUC",          current_user.cedula or "9999999999999")
    neg_razon_social = _param_negocio(db, uid, "NEGOCIO_RAZON_SOCIAL", "NOMBRE DEL NEGOCIO S.A.")
    neg_nombre       = _param_negocio(db, uid, "NEGOCIO_NOMBRE",       neg_razon_social)
    neg_dir_matriz   = _param_negocio(db, uid, "NEGOCIO_DIRECCION_MATRIZ",   "")
    neg_telefono     = _param_negocio(db, uid, "NEGOCIO_TELEFONO",     "")
    neg_email        = _param_negocio(db, uid, "NEGOCIO_EMAIL",        "")
    neg_ambiente     = _param_negocio(db, uid, "NEGOCIO_AMBIENTE",     "Pruebas")
    neg_obligado     = _param_negocio(db, uid, "NEGOCIO_OBLIGADO_CONT","NO")
    neg_logo_url     = _param_negocio(db, uid, "NEGOCIO_LOGO",            "")
    logo_img         = _logo_image(neg_logo_url, max_w=140, max_h=70)

    nombre_cliente = (
        nota.cliente.nombres_apellidos or nota.cliente.razon_social or "—"
    ) if nota.cliente else "—"
    identificacion = nota.cliente.identificacion if nota.cliente else "—"
    motivo = nota.motivo.value if hasattr(nota.motivo, "value") else nota.motivo
    iva_pct = float(nota.porcentaje_iva) if nota.porcentaje_iva else 0

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.0*cm, leftMargin=1.0*cm,
        topMargin=1.0*cm,   bottomMargin=1.0*cm
    )

    AZUL_OSC     = colors.HexColor("#059669")
    GRIS_CLARO   = colors.HexColor("#f9f9f9")
    GRIS_SEC     = colors.HexColor("#e5e7eb")
    BORDE        = colors.HexColor("#000000")
    BORDE_CLARO  = colors.HexColor("#cccccc")
    BORDE_MUY_C  = colors.HexColor("#eeeeee")
    NEGRO        = colors.HexColor("#000000")
    GRIS_TEXTO   = colors.HexColor("#374151")
    VERDE_TOTAL  = colors.HexColor("#d1fae5")

    sn = ParagraphStyle("sn", fontName="Helvetica",      fontSize=7, leading=9, textColor=NEGRO)
    sb = ParagraphStyle("sb", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=NEGRO)
    sr = ParagraphStyle("sr", fontName="Helvetica",      fontSize=7, leading=9, alignment=TA_RIGHT)

    elements = []
    col_w = doc.width

    # ── Cabecera emisor
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
        ("BOX", (0,0),(-1,-1), 0.75, BORDE),
        ("TOPPADDING",(0,0),(-1,-1),8), ("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("LEFTPADDING",(0,0),(-1,-1),10), ("RIGHTPADDING",(0,0),(-1,-1),10),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))

    comp_rows = [
        [Paragraph("<b>R.U.C:</b>", sb), Paragraph(neg_ruc or "—", sb)],
        [Paragraph("NOTA DE CRÉDITO",
                   ParagraphStyle("nc2", fontName="Helvetica-Bold", fontSize=11, leading=13,
                                  alignment=TA_CENTER, textColor=NEGRO)), ""],
        [Paragraph("No.", sb), Paragraph(nota.numero_comprobante or "—",
                   ParagraphStyle("mono", fontName="Courier", fontSize=7, leading=9))],
        [Paragraph("<b>Factura Referencia:</b>", sb),
         Paragraph(nota.factura.numero_comprobante if nota.factura else "—", sn)],
        [Paragraph("FECHA EMISIÓN:", sb),
         Paragraph(nota.fecha_emision.strftime('%d/%m/%Y'), sn)],
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

    # ── Receptor
    receptor_data = [
        [Paragraph(f"<b>Razón Social / Nombres y Apellidos:</b> {nombre_cliente}", sn),
         Paragraph(f"<b>RUC / CI:</b> {identificacion}", sn)],
        [Paragraph(f"<b>Motivo:</b> {motivo}", sn),
         Paragraph(f"<b>Fecha Emisión:</b> {nota.fecha_emision.strftime('%d/%m/%Y')}", sn)],
    ]
    receptor_tabla = Table(receptor_data, colWidths=[col_w * 0.6, col_w * 0.4])
    receptor_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_CLARO),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    elements.append(receptor_tabla)

    # ── Detalle
    det_encab = [
        Paragraph("DESCRIPCIÓN", ParagraphStyle("dh1", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("CANT.",       ParagraphStyle("dh2", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("P. UNITARIO", ParagraphStyle("dh3", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("SUBTOTAL",    ParagraphStyle("dh4", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("IVA",         ParagraphStyle("dh5", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("TOTAL",       ParagraphStyle("dh6", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]
    det_filas = [det_encab]
    for idx, d in enumerate(nota.detalles):
        det_filas.append([
            Paragraph(d.descripcion or "—", sb),
            Paragraph(str(int(d.cantidad) if float(d.cantidad) == int(d.cantidad) else d.cantidad),
                      ParagraphStyle(f"c{idx}", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)),
            Paragraph(f"${float(d.precio_unitario):.5f}", sr),
            Paragraph(f"${float(d.subtotal):.2f}", sr),
            Paragraph(f"${float(d.iva):.2f}", sr),
            Paragraph(f"${float(d.total):.2f}", sr),
        ])

    det_tabla = Table(det_filas, colWidths=[col_w*0.35, col_w*0.08, col_w*0.16, col_w*0.14, col_w*0.12, col_w*0.15])
    det_style = [
        ("BACKGROUND",(0,0),(-1,0),AZUL_OSC), ("TEXTCOLOR",(0,0),(-1,0),colors.white),
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

    # ── Totales
    totales_rows = [
        (f"SUBTOTAL {int(iva_pct)}%", float(nota.subtotal_iva)),
        ("SUBTOTAL 0%",               float(nota.subtotal_0)),
        (f"IVA {int(iva_pct)}%",      float(nota.iva)),
        ("VALOR TOTAL",               float(nota.total)),
    ]
    tot_data = []
    for i, (label, valor) in enumerate(totales_rows):
        es_total = label == "VALOR TOTAL"
        tot_data.append([
            Paragraph(label, ParagraphStyle(f"tl{i}", fontName="Helvetica-Bold" if es_total else "Helvetica", fontSize=7.5, leading=9)),
            Paragraph(f"$ {valor:.2f}", ParagraphStyle(f"tv{i}", fontName="Courier-Bold" if es_total else "Courier", fontSize=7.5, leading=9, alignment=TA_RIGHT)),
        ])

    tot_tabla = Table(tot_data, colWidths=[col_w*0.30, col_w*0.15])
    tot_style = [
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_MUY_C),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),6), ("RIGHTPADDING",(0,0),(-1,-1),6),
        ("BACKGROUND",(0,-1),(-1,-1),VERDE_TOTAL), ("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),
    ]
    tot_tabla.setStyle(TableStyle(tot_style))

    bottom = Table([[Spacer(1,1), tot_tabla]], colWidths=[col_w*0.55, col_w*0.45])
    bottom.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    elements.append(bottom)

    if nota.observaciones:
        elements.append(Table(
            [[Paragraph(f"<b>Observaciones:</b> {nota.observaciones}", sn)]],
            colWidths=[col_w]
        ))

    # ── Pie
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
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=nota_credito_{nota.numero_comprobante}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── GET /api/notas-credito/{id}/xml/ ────────────────────
@router.get("/{id_nota}/xml/")
def descargar_xml(
    id_nota: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    nota = (
        db.query(NotaCredito)
        .options(
            joinedload(NotaCredito.cliente),
            joinedload(NotaCredito.factura),
            joinedload(NotaCredito.detalles).joinedload(DetalleNotaCredito.producto),
        )
        .filter(
            NotaCredito.id_nota_credito == id_nota,
            NotaCredito.id_usuario == current_user.id_usuario
        ).first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")

    root = etree.Element("notaCredito")
    info = etree.SubElement(root, "infoNotaCredito")
    etree.SubElement(info, "fechaEmision").text      = str(nota.fecha_emision)
    etree.SubElement(info, "numeroComprobante").text = nota.numero_comprobante
    etree.SubElement(info, "motivo").text            = nota.motivo.value if hasattr(nota.motivo, "value") else nota.motivo
    etree.SubElement(info, "estado").text            = nota.estado.value if hasattr(nota.estado, "value") else nota.estado
    etree.SubElement(info, "facturaReferencia").text = nota.factura.numero_comprobante if nota.factura else ""

    cli = etree.SubElement(info, "cliente")
    etree.SubElement(cli, "identificacion").text = nota.cliente.identificacion or "" if nota.cliente else ""
    etree.SubElement(cli, "nombre").text         = (nota.cliente.nombres_apellidos or nota.cliente.razon_social or "") if nota.cliente else ""

    tot = etree.SubElement(info, "totales")
    etree.SubElement(tot, "subtotal0").text   = str(nota.subtotal_0)
    etree.SubElement(tot, "subtotalIva").text = str(nota.subtotal_iva)
    etree.SubElement(tot, "iva").text         = str(nota.iva)
    etree.SubElement(tot, "total").text       = str(nota.total)

    dets = etree.SubElement(root, "detalles")
    for d in nota.detalles:
        det = etree.SubElement(dets, "detalle")
        etree.SubElement(det, "descripcion").text    = d.descripcion or ""
        etree.SubElement(det, "cantidad").text       = str(d.cantidad)
        etree.SubElement(det, "precioUnitario").text = str(d.precio_unitario)
        etree.SubElement(det, "subtotal").text       = str(d.subtotal)
        etree.SubElement(det, "iva").text            = str(d.iva)
        etree.SubElement(det, "total").text          = str(d.total)

    if nota.observaciones:
        etree.SubElement(root, "observaciones").text = nota.observaciones

    xml_bytes = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="UTF-8")
    return StreamingResponse(
        io.BytesIO(xml_bytes),
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=nota_credito_{nota.numero_comprobante}.xml",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── POST /api/notas-credito/ ────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_nota_credito(
    datos: dict,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    factura = db.query(FacturaVenta).options(
        joinedload(FacturaVenta.detalles).joinedload(DetalleFacturaVenta.producto)
    ).filter(
        FacturaVenta.id_factura == datos["id_factura"],
        FacturaVenta.id_usuario == current_user.id_usuario,
        FacturaVenta.estado     == "finalizada"
    ).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada o no está finalizada")

    subtotal_0   = Decimal("0.00")
    subtotal_iva = Decimal("0.00")
    total_iva    = Decimal("0.00")
    detalles_orm = []

    for item in datos.get("detalles", []):
        subtotal, iva, total_linea = _calcular_linea(
            item["cantidad"], item["precio_unitario"], item["porcentaje_iva"]
        )
        if Decimal(str(item["porcentaje_iva"])) > 0:
            subtotal_iva += subtotal
        else:
            subtotal_0 += subtotal
        total_iva += iva

        producto = db.query(Producto).filter(Producto.id_producto == item["id_producto"]).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {item['id_producto']} no encontrado")

        detalles_orm.append(DetalleNotaCredito(
            id_producto     = item["id_producto"],
            descripcion     = producto.nombre,
            cantidad        = item["cantidad"],
            precio_unitario = Decimal(str(item["precio_unitario"])),
            porcentaje_iva  = Decimal(str(item["porcentaje_iva"])),
            subtotal        = subtotal,
            iva             = iva,
            total           = total_linea,
        ))
        producto.stock += item["cantidad"]

    total_nc = subtotal_0 + subtotal_iva + total_iva

    nota = NotaCredito(
        id_usuario           = current_user.id_usuario,
        id_factura           = datos["id_factura"],
        id_persona_comercial = factura.id_persona_comercial,
        numero_comprobante   = _generar_numero_nc(db, current_user.id_usuario),
        fecha_emision        = date.fromisoformat(datos["fecha_emision"]),
        motivo               = datos["motivo"],
        porcentaje_iva       = Decimal(str(datos.get("porcentaje_iva", 15))),
        subtotal_0           = subtotal_0,
        subtotal_iva         = subtotal_iva,
        iva                  = total_iva,
        total                = total_nc,
        observaciones        = datos.get("observaciones"),
        estado               = "emitida",
    )
    db.add(nota)
    db.flush()

    for det in detalles_orm:
        det.id_nota_credito = nota.id_nota_credito
        db.add(det)

    db.commit()
    return {"id_nota_credito": nota.id_nota_credito, "numero_comprobante": nota.numero_comprobante, "total": float(total_nc)}


# ─── PATCH /api/notas-credito/{id}/anular ────────────────
@router.patch("/{id_nota}/anular")
def anular_nota(
    id_nota: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    nota = db.query(NotaCredito).options(
        joinedload(NotaCredito.detalles)
    ).filter(
        NotaCredito.id_nota_credito == id_nota,
        NotaCredito.id_usuario      == current_user.id_usuario
    ).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota de crédito no encontrada")
    est = nota.estado.value if hasattr(nota.estado, "value") else str(nota.estado)
    if est == "anulada":
        raise HTTPException(status_code=400, detail="Ya está anulada")

    for det in nota.detalles:
        producto = db.query(Producto).filter(Producto.id_producto == det.id_producto).first()
        if producto:
            producto.stock -= det.cantidad

    nota.estado = "anulada"
    db.commit()
    return {"mensaje": "Nota de crédito anulada"}
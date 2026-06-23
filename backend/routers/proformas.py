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

from database import get_db
from models import (
    ProformaVenta, DetalleProformaVenta, Producto,
    PersonaComercial, ParametroSistema, UsuarioSistema,
    FacturaVenta, DetalleFacturaVenta, MovimientoInventario, KardexInventario
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

router = APIRouter(prefix="/api/proformas", tags=["Proformas"])


def _generar_numero_proforma(db: Session) -> str:
    total = db.query(func.count(ProformaVenta.id_proforma)).scalar() or 0
    numero = str(total + 1).zfill(9)
    return f"PRO-001-{numero}"


def _calcular_detalle(item):
    cantidad        = Decimal(str(item.cantidad))
    precio_unitario = Decimal(str(item.precio_unitario))
    descuento       = Decimal(str(item.descuento))
    porcentaje_iva  = Decimal(str(item.porcentaje_iva))
    subtotal   = (cantidad * precio_unitario) - descuento
    iva        = round(subtotal * (porcentaje_iva / 100), 2) if porcentaje_iva > 0 else Decimal("0.00")
    total      = subtotal + iva
    return subtotal, iva, total


def _param_negocio(db, id_usuario, clave, default=""):
    p = db.query(ParametroSistema).filter(
        ParametroSistema.clave == clave,
        ParametroSistema.id_usuario == id_usuario
    ).first()
    return p.valor if p else default


# ─── GET /api/proformas/ ──────────────────────────────────
@router.get("/", response_model=dict)
def listar_proformas(
    pagina:      int = Query(1,  ge=1),
    por_pagina:  int = Query(10, ge=1, le=100),
    estado:      Optional[str] = None,
    buscar:      Optional[str] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db:          Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    query = (
        db.query(ProformaVenta)
        .options(joinedload(ProformaVenta.cliente))
        .filter(ProformaVenta.id_usuario == current_user.id_usuario)
    )
    if estado:      query = query.filter(ProformaVenta.estado == estado)
    if fecha_desde: query = query.filter(ProformaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: query = query.filter(ProformaVenta.fecha_emision <= fecha_hasta)
    if buscar:
        query = query.join(PersonaComercial).filter(
            ProformaVenta.numero_comprobante.contains(buscar) |
            PersonaComercial.nombres_apellidos.contains(buscar) |
            PersonaComercial.razon_social.contains(buscar)
        )
    total    = query.count()
    proformas = query.order_by(ProformaVenta.created_at.desc()) \
                     .offset((pagina - 1) * por_pagina) \
                     .limit(por_pagina).all()
    return {
        "items":         [_proforma_list(p) for p in proformas],
        "total":         total,
        "pagina":        pagina,
        "por_pagina":    por_pagina,
        "total_paginas": math.ceil(total / por_pagina) if total else 1,
    }


# ─── GET /api/proformas/resumen ───────────────────────────
@router.get("/resumen", response_model=dict)
def resumen_proformas(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    filas = db.query(
        ProformaVenta.estado,
        func.count(ProformaVenta.id_proforma).label("cantidad"),
        func.coalesce(func.sum(ProformaVenta.total), 0).label("monto")
    ).filter(
        ProformaVenta.id_usuario == current_user.id_usuario
    ).group_by(ProformaVenta.estado).all()

    resumen = {
        "cotizadas": 0, "aceptadas": 0, "rechazadas": 0,
        "convertidas": 0, "totalCotizado": 0.0
    }
    for fila in filas:
        if fila.estado == "cotizada":
            resumen["cotizadas"]     = fila.cantidad
            resumen["totalCotizado"] = float(fila.monto)
        elif fila.estado == "aceptada":
            resumen["aceptadas"]  = fila.cantidad
        elif fila.estado == "rechazada":
            resumen["rechazadas"] = fila.cantidad
        elif fila.estado == "convertida_factura":
            resumen["convertidas"] = fila.cantidad
    return resumen


# ─── GET /api/proformas/{id} ──────────────────────────────
@router.get("/{id_proforma}", response_model=dict)
def obtener_proforma(
    id_proforma: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    proforma = (
        db.query(ProformaVenta)
        .options(
            joinedload(ProformaVenta.cliente),
            joinedload(ProformaVenta.detalles).joinedload(DetalleProformaVenta.producto)
        )
        .filter(
            ProformaVenta.id_proforma == id_proforma,
            ProformaVenta.id_usuario  == current_user.id_usuario
        ).first()
    )
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    return _proforma_full(proforma)


# ─── GET /api/proformas/{id}/pdf/ ─────────────────────────
@router.get("/{id_proforma}/pdf/")
def descargar_pdf(
    id_proforma: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    proforma = (
        db.query(ProformaVenta)
        .options(
            joinedload(ProformaVenta.cliente),
            joinedload(ProformaVenta.detalles).joinedload(DetalleProformaVenta.producto)
        )
        .filter(
            ProformaVenta.id_proforma == id_proforma,
            ProformaVenta.id_usuario  == current_user.id_usuario
        ).first()
    )
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")

    uid = current_user.id_usuario
    neg_ruc          = _param_negocio(db, uid, "NEGOCIO_RUC",          current_user.cedula or "9999999999999")
    neg_razon_social = _param_negocio(db, uid, "NEGOCIO_RAZON_SOCIAL", "NOMBRE DEL NEGOCIO S.A.")
    neg_nombre       = _param_negocio(db, uid, "NEGOCIO_NOMBRE",       neg_razon_social)
    neg_dir_matriz   = _param_negocio(db, uid, "NEGOCIO_DIRECCION_MATRIZ", "")
    neg_telefono     = _param_negocio(db, uid, "NEGOCIO_TELEFONO",     "")
    neg_email        = _param_negocio(db, uid, "NEGOCIO_EMAIL",        "")
    neg_obligado     = _param_negocio(db, uid, "NEGOCIO_OBLIGADO_CONT","NO")
    neg_logo_url     = _param_negocio(db, uid, "NEGOCIO_LOGO",            "")
    logo_img         = _logo_image(neg_logo_url, max_w=140, max_h=70)

    nombre_cliente = (proforma.cliente.nombres_apellidos or proforma.cliente.razon_social or "—") if proforma.cliente else "—"
    identificacion = proforma.cliente.identificacion if proforma.cliente else "—"
    iva_pct        = float(proforma.porcentaje_iva) if proforma.porcentaje_iva else 0

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
        rightMargin=1.0*cm, leftMargin=1.0*cm,
        topMargin=1.0*cm,   bottomMargin=1.0*cm)

    MORADO_OSC  = colors.HexColor("#7c3aed")
    GRIS_CLARO  = colors.HexColor("#f9f9f9")
    BORDE       = colors.HexColor("#000000")
    BORDE_CLARO = colors.HexColor("#cccccc")
    BORDE_MUY_C = colors.HexColor("#eeeeee")
    NEGRO       = colors.HexColor("#000000")
    GRIS_TEXTO  = colors.HexColor("#374151")
    MORADO_TOT  = colors.HexColor("#ede9fe")

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
        [Paragraph("PROFORMA / COTIZACIÓN",
                   ParagraphStyle("pro2", fontName="Helvetica-Bold", fontSize=10, leading=12,
                                  alignment=TA_CENTER, textColor=NEGRO)), ""],
        [Paragraph("No.", sb), Paragraph(proforma.numero_comprobante or "—",
                   ParagraphStyle("mono", fontName="Courier", fontSize=7, leading=9))],
        [Paragraph("FECHA EMISIÓN:", sb), Paragraph(proforma.fecha_emision.strftime('%d/%m/%Y'), sn)],
        [Paragraph("VÁLIDO HASTA:", sb),
         Paragraph(proforma.fecha_validez.strftime('%d/%m/%Y') if proforma.fecha_validez else "—", sn)],
        [Paragraph("ESTADO:", sb),
         Paragraph(proforma.estado.upper() if proforma.estado else "—", sn)],
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

    aviso_data = [[Paragraph(
        "⚠  PROFORMA — Documento no válido como comprobante tributario. Solo tiene valor referencial.",
        ParagraphStyle("av", fontName="Helvetica-Bold", fontSize=7, leading=9,
                       textColor=colors.HexColor("#7c3aed"), alignment=TA_CENTER)
    )]]
    aviso_tabla = Table(aviso_data, colWidths=[col_w])
    aviso_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,colors.HexColor("#c4b5fd")),
        ("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#ede9fe")),
        ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    elements.append(aviso_tabla)

    receptor_data = [
        [Paragraph(f"<b>Cliente:</b> {nombre_cliente}", sn),
         Paragraph(f"<b>RUC / CI:</b> {identificacion}", sn)],
        [Paragraph(f"<b>Fecha Emisión:</b> {proforma.fecha_emision.strftime('%d/%m/%Y')}", sn),
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
        Paragraph("DESCRIPCIÓN",   ParagraphStyle("dh1", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("CANT.",         ParagraphStyle("dh2", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("P. UNITARIO",   ParagraphStyle("dh3", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("DESCUENTO",     ParagraphStyle("dh4", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("SUBTOTAL",      ParagraphStyle("dh5", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("IVA",           ParagraphStyle("dh6", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("TOTAL",         ParagraphStyle("dh7", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]
    det_filas = [det_encab]
    for idx, d in enumerate(proforma.detalles):
        nombre_prod = d.producto.nombre if d.producto else f"Producto {d.id_producto}"
        cant = float(d.cantidad)
        sub_linea = float(d.subtotal)
        det_filas.append([
            Paragraph(f"<b>{nombre_prod}</b>", sb),
            Paragraph(str(int(cant) if cant == int(cant) else cant),
                      ParagraphStyle(f"c{idx}", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)),
            Paragraph(f"${float(d.precio_unitario):.5f}", sr),
            Paragraph(f"${float(d.descuento):.2f}", sr),
            Paragraph(f"${sub_linea:.2f}", sr),
            Paragraph(f"${float(d.iva):.2f}", sr),
            Paragraph(f"${float(d.total):.2f}", sr),
        ])

    det_tabla = Table(det_filas, colWidths=[col_w*0.28, col_w*0.07, col_w*0.14, col_w*0.11, col_w*0.13, col_w*0.11, col_w*0.16])
    det_style = [
        ("BACKGROUND",(0,0),(-1,0),MORADO_OSC), ("TEXTCOLOR",(0,0),(-1,0),colors.white),
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
        (f"SUBTOTAL {int(iva_pct)}%", float(proforma.subtotal_iva)),
        ("SUBTOTAL 0%",               float(proforma.subtotal_0)),
        ("DESCUENTO",                 float(proforma.descuento)),
        (f"IVA {int(iva_pct)}%",      float(proforma.iva)),
        ("VALOR TOTAL",               float(proforma.total)),
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
        ("BACKGROUND",(0,-1),(-1,-1),MORADO_TOT), ("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),
    ]))

    bottom = Table([[Spacer(1,1), tot_tabla]], colWidths=[col_w*0.55, col_w*0.45])
    bottom.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    elements.append(bottom)

    if proforma.observaciones:
        elements.append(Table(
            [[Paragraph(f"<b>Observaciones:</b> {proforma.observaciones}", sn)]],
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
            "Content-Disposition": f"attachment; filename=proforma_{proforma.numero_comprobante}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── POST /api/proformas/ ─────────────────────────────────
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def crear_proforma(
    datos: dict,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    cliente = db.query(PersonaComercial).filter(
        PersonaComercial.id_persona_comercial == datos["id_persona_comercial"],
        PersonaComercial.id_usuario == current_user.id_usuario
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    subtotal_0   = Decimal("0.00")
    subtotal_iva = Decimal("0.00")
    total_iva    = Decimal("0.00")
    total_desc   = Decimal("0.00")
    detalles_orm = []

    for item in datos.get("detalles", []):
        producto = db.query(Producto).filter(
            Producto.id_producto == item["id_producto"],
            Producto.id_usuario  == current_user.id_usuario
        ).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {item['id_producto']} no encontrado")

        class _Item:
            cantidad        = item["cantidad"]
            precio_unitario = item["precio_unitario"]
            descuento       = item.get("descuento", 0)
            porcentaje_iva  = item["porcentaje_iva"]

        subtotal, iva, total_linea = _calcular_detalle(_Item())
        desc = Decimal(str(item.get("descuento", 0)))
        total_desc += desc

        if item["porcentaje_iva"] > 0:
            subtotal_iva += subtotal
        else:
            subtotal_0 += subtotal
        total_iva += iva

        detalles_orm.append(DetalleProformaVenta(
            id_producto     = item["id_producto"],
            cantidad        = item["cantidad"],
            precio_unitario = item["precio_unitario"],
            porcentaje_iva  = item["porcentaje_iva"],
            subtotal        = subtotal,
            descuento       = desc,
            iva             = iva,
            total           = total_linea
        ))

    total_proforma = subtotal_0 + subtotal_iva + total_iva

    from datetime import date as date_type
    fecha_emision = date_type.fromisoformat(datos["fecha_emision"]) if isinstance(datos["fecha_emision"], str) else datos["fecha_emision"]
    fecha_validez = None
    if datos.get("fecha_validez"):
        fecha_validez = date_type.fromisoformat(datos["fecha_validez"]) if isinstance(datos["fecha_validez"], str) else datos["fecha_validez"]

    proforma = ProformaVenta(
        id_usuario           = current_user.id_usuario,
        id_persona_comercial = datos["id_persona_comercial"],
        numero_comprobante   = _generar_numero_proforma(db),
        fecha_emision        = fecha_emision,
        fecha_validez        = fecha_validez,
        subtotal_0           = subtotal_0,
        subtotal_iva         = subtotal_iva,
        porcentaje_iva       = Decimal(str(datos.get("porcentaje_iva", 15))),
        iva                  = total_iva,
        descuento            = total_desc,
        total                = total_proforma,
        observaciones        = datos.get("observaciones"),
        estado               = "cotizada",
    )
    db.add(proforma)
    db.flush()

    for detalle in detalles_orm:
        detalle.id_proforma = proforma.id_proforma
        db.add(detalle)

    db.commit()
    db.refresh(proforma)
    return _proforma_full(
        db.query(ProformaVenta)
        .options(
            joinedload(ProformaVenta.cliente),
            joinedload(ProformaVenta.detalles).joinedload(DetalleProformaVenta.producto)
        )
        .filter(ProformaVenta.id_proforma == proforma.id_proforma).first()
    )


# ─── PATCH /api/proformas/{id}/estado ────────────────────
@router.patch("/{id_proforma}/estado", response_model=dict)
def cambiar_estado(
    id_proforma: int,
    datos: dict,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    proforma = db.query(ProformaVenta).filter(
        ProformaVenta.id_proforma == id_proforma,
        ProformaVenta.id_usuario  == current_user.id_usuario
    ).first()
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")

    nuevo_estado = datos.get("estado")
    estados_validos = ["cotizada", "aceptada", "rechazada", "convertida_factura"]
    if nuevo_estado not in estados_validos:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Válidos: {estados_validos}")

    if proforma.estado == "convertida_factura":
        raise HTTPException(status_code=400, detail="Una proforma ya convertida no puede modificarse")

    proforma.estado = nuevo_estado
    db.commit()
    db.refresh(proforma)
    return _proforma_list(proforma)


# ─── PATCH /api/proformas/{id}/rechazar ──────────────────
# Endpoint dedicado para cerrar/rechazar una cotización con motivo registrado
@router.patch("/{id_proforma}/rechazar", response_model=dict)
def rechazar_proforma(
    id_proforma: int,
    datos: dict,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    proforma = db.query(ProformaVenta).filter(
        ProformaVenta.id_proforma == id_proforma,
        ProformaVenta.id_usuario  == current_user.id_usuario
    ).first()
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")

    if proforma.estado == "convertida_factura":
        raise HTTPException(
            status_code=400,
            detail="No se puede rechazar una proforma ya convertida a factura"
        )
    if proforma.estado == "rechazada":
        raise HTTPException(
            status_code=400,
            detail="Esta proforma ya está rechazada"
        )

    proforma.estado = "rechazada"

    # Guardar el motivo en observaciones si viene en el payload
    observaciones_nuevas = datos.get("observaciones", "").strip()
    if observaciones_nuevas:
        proforma.observaciones = observaciones_nuevas

    db.commit()
    db.refresh(proforma)
    return _proforma_list(proforma)


# ─── POST /api/proformas/{id}/convertir ──────────────────
@router.post("/{id_proforma}/convertir", response_model=dict)
def convertir_a_factura(
    id_proforma: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    proforma = (
        db.query(ProformaVenta)
        .options(
            joinedload(ProformaVenta.cliente),
            joinedload(ProformaVenta.detalles).joinedload(DetalleProformaVenta.producto)
        )
        .filter(
            ProformaVenta.id_proforma == id_proforma,
            ProformaVenta.id_usuario  == current_user.id_usuario
        ).first()
    )
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    if proforma.estado == "convertida_factura":
        raise HTTPException(status_code=400, detail="Ya fue convertida a factura")
    if proforma.estado == "rechazada":
        raise HTTPException(status_code=400, detail="No se puede convertir una proforma rechazada")

    for d in proforma.detalles:
        prod = db.query(Producto).filter(Producto.id_producto == d.id_producto).first()
        if prod and prod.stock < d.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{prod.nombre}'. Disponible: {prod.stock}"
            )

    param = db.query(ParametroSistema).filter(ParametroSistema.clave == "FORMATO_FACTURA").first()
    formato = param.valor if param else "001-001-{NUMERO}"
    total_fact = db.query(func.count(FacturaVenta.id_factura)).scalar() or 0
    num_factura = formato.replace("{NUMERO}", str(total_fact + 1).zfill(9))

    factura = FacturaVenta(
        id_usuario           = current_user.id_usuario,
        id_persona_comercial = proforma.id_persona_comercial,
        numero_comprobante   = num_factura,
        fecha_emision        = proforma.fecha_emision,
        subtotal_0           = proforma.subtotal_0,
        subtotal_iva         = proforma.subtotal_iva,
        porcentaje_iva       = proforma.porcentaje_iva,
        iva                  = proforma.iva,
        descuento            = proforma.descuento,
        total                = proforma.total,
        observaciones        = f"Convertida desde proforma {proforma.numero_comprobante}",
        estado               = "finalizada",
    )
    db.add(factura)
    db.flush()

    for d in proforma.detalles:
        db.add(DetalleFacturaVenta(
            id_factura      = factura.id_factura,
            id_producto     = d.id_producto,
            cantidad        = d.cantidad,
            precio_unitario = d.precio_unitario,
            porcentaje_iva  = d.porcentaje_iva,
            subtotal        = d.subtotal,
            descuento       = d.descuento,
            iva             = d.iva,
            total           = d.total,
        ))
        prod = db.query(Producto).filter(Producto.id_producto == d.id_producto).first()
        if prod:
            prod.stock -= d.cantidad

    movimiento = MovimientoInventario(
        id_usuario           = current_user.id_usuario,
        tipo_movimiento      = "VENTA",
        descripcion          = f"Venta desde proforma {proforma.numero_comprobante}",
        id_persona_comercial = proforma.id_persona_comercial,
        id_factura           = factura.id_factura
    )
    db.add(movimiento)

    proforma.estado = "convertida_factura"
    db.commit()
    db.refresh(factura)

    return {
        "mensaje":         "Proforma convertida a factura exitosamente",
        "id_factura":      factura.id_factura,
        "numero_factura":  factura.numero_comprobante,
        "numero_proforma": proforma.numero_comprobante,
        "total":           float(factura.total),
    }


# ─── Helpers serializadores ───────────────────────────────
def _proforma_list(p) -> dict:
    return {
        "id_proforma":         p.id_proforma,
        "numero_comprobante":  p.numero_comprobante,
        "fecha_emision":       str(p.fecha_emision),
        "fecha_validez":       str(p.fecha_validez) if p.fecha_validez else None,
        "subtotal_0":          float(p.subtotal_0),
        "subtotal_iva":        float(p.subtotal_iva),
        "porcentaje_iva":      float(p.porcentaje_iva),
        "iva":                 float(p.iva),
        "descuento":           float(p.descuento),
        "total":               float(p.total),
        "estado":              p.estado,
        "observaciones":       p.observaciones,
        "created_at":          str(p.created_at),
        "cliente": {
            "id_persona_comercial": p.cliente.id_persona_comercial,
            "nombres_apellidos":    p.cliente.nombres_apellidos,
            "razon_social":         p.cliente.razon_social,
            "identificacion":       p.cliente.identificacion,
        } if p.cliente else None,
    }


def _proforma_full(p) -> dict:
    base = _proforma_list(p)
    base["detalles"] = [
        {
            "id_detalle":      d.id_detalle,
            "id_producto":     d.id_producto,
            "cantidad":        d.cantidad,
            "precio_unitario": float(d.precio_unitario),
            "porcentaje_iva":  float(d.porcentaje_iva),
            "subtotal":        float(d.subtotal),
            "descuento":       float(d.descuento),
            "iva":             float(d.iva),
            "total":           float(d.total),
            "producto": {
                "nombre": d.producto.nombre,
                "codigo": d.producto.codigo,
                "stock":  d.producto.stock,
            } if d.producto else None,
        }
        for d in (p.detalles or [])
    ]
    return base
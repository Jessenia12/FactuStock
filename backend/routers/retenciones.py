from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
import io
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from database import get_db
from dependencies import get_current_user
from models import (
    ComprobanteRetencion, DetalleRetencion,
    ComprobanteRecibido, PersonaComercial,
    UsuarioSistema, EstadoRetencionEnum, TipoRetencionEnum,
    ParametroSistema
)


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

router = APIRouter(prefix="/api/retenciones", tags=["retenciones"])


# ─── Schemas Pydantic ─────────────────────────────────────
class DetalleRetencionIn(BaseModel):
    tipo:           str          # "renta" | "iva"
    codigo_sri:     str
    descripcion:    str
    base_imponible: float
    porcentaje:     float
    valor_retenido: float

class RetencionCreate(BaseModel):
    id_persona_comercial:  int
    id_comprobante_origen: Optional[int] = None
    numero_comprobante:    str
    numero_autorizacion:   Optional[str] = None
    fecha_emision:         date
    ejercicio_fiscal:      str
    observaciones:         Optional[str] = None
    detalles:              list[DetalleRetencionIn]


# ─── helpers ──────────────────────────────────────────────
def _param_negocio(db, id_usuario, clave, default=""):
    p = db.query(ParametroSistema).filter(
        ParametroSistema.clave == clave,
        ParametroSistema.id_usuario == id_usuario
    ).first()
    return p.valor if p else default

def _serial(r: ComprobanteRetencion) -> dict:
    nombre = ""
    if r.proveedor:
        nombre = r.proveedor.razon_social or r.proveedor.nombres_apellidos or ""
    return {
        "id_retencion":           r.id_retencion,
        "numero_comprobante":     r.numero_comprobante,
        "numero_autorizacion":    r.numero_autorizacion,
        "fecha_emision":          str(r.fecha_emision),
        "ejercicio_fiscal":       r.ejercicio_fiscal,
        "total_retenido_renta":   float(r.total_retenido_renta),
        "total_retenido_iva":     float(r.total_retenido_iva),
        "total_retenido":         float(r.total_retenido),
        "estado":                 r.estado.value,
        "observaciones":          r.observaciones,
        "created_at":             str(r.created_at),
        "proveedor": {
            "id_persona_comercial": r.id_persona_comercial,
            "nombre":               nombre,
            "identificacion":       r.proveedor.identificacion if r.proveedor else "",
        },
        "comprobante_origen": {
            "id_comprobante":     r.id_comprobante_origen,
            "numero_comprobante": r.comprobante_origen.numero_comprobante if r.comprobante_origen else None,
        } if r.id_comprobante_origen else None,
    }

def _serial_full(r: ComprobanteRetencion) -> dict:
    base = _serial(r)
    base["detalles"] = [
        {
            "id_detalle":      d.id_detalle,
            "tipo":            d.tipo.value,
            "codigo_sri":      d.codigo_sri,
            "descripcion":     d.descripcion,
            "base_imponible":  float(d.base_imponible),
            "porcentaje":      float(d.porcentaje),
            "valor_retenido":  float(d.valor_retenido),
        }
        for d in r.detalles
    ]
    return base


# ─── GET /  — listar ──────────────────────────────────────
@router.get("/")
def listar_retenciones(
    pagina:    int = Query(1, ge=1),
    por_pagina:int = Query(10, ge=1, le=100),
    estado:    Optional[str] = None,
    buscar:    Optional[str] = None,
    db:        Session = Depends(get_db),
    usuario:   UsuarioSistema = Depends(get_current_user),
):
    q = (
        db.query(ComprobanteRetencion)
        .options(
            joinedload(ComprobanteRetencion.proveedor),
            joinedload(ComprobanteRetencion.comprobante_origen),
        )
        .filter(ComprobanteRetencion.id_usuario == usuario.id_usuario)
    )
    if estado:
        q = q.filter(ComprobanteRetencion.estado == estado)
    if buscar:
        like = f"%{buscar}%"
        q = q.join(PersonaComercial, ComprobanteRetencion.id_persona_comercial == PersonaComercial.id_persona_comercial, isouter=True).filter(
            or_(
                ComprobanteRetencion.numero_comprobante.ilike(like),
                PersonaComercial.nombres_apellidos.ilike(like),
                PersonaComercial.razon_social.ilike(like),
                PersonaComercial.identificacion.ilike(like),
            )
        )
    total = q.count()
    items = (
        q.order_by(ComprobanteRetencion.created_at.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "paginas": max(1, -(-total // por_pagina)),
        "items": [_serial(r) for r in items],
    }


# ─── GET /resumen ─────────────────────────────────────────
@router.get("/resumen")
def resumen_retenciones(
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    base = db.query(ComprobanteRetencion).filter(
        ComprobanteRetencion.id_usuario == usuario.id_usuario
    )
    emitidas = base.filter(ComprobanteRetencion.estado == EstadoRetencionEnum.emitida)
    return {
        "total_emitidas":       base.filter(ComprobanteRetencion.estado == EstadoRetencionEnum.emitida).count(),
        "total_anuladas":       base.filter(ComprobanteRetencion.estado == EstadoRetencionEnum.anulada).count(),
        "total_retenido_renta": float(emitidas.with_entities(func.coalesce(func.sum(ComprobanteRetencion.total_retenido_renta), 0)).scalar()),
        "total_retenido_iva":   float(emitidas.with_entities(func.coalesce(func.sum(ComprobanteRetencion.total_retenido_iva), 0)).scalar()),
        "total_retenido":       float(emitidas.with_entities(func.coalesce(func.sum(ComprobanteRetencion.total_retenido), 0)).scalar()),
    }


# ─── GET /{id} ────────────────────────────────────────────
@router.get("/{id_retencion}")
def obtener_retencion(
    id_retencion: int,
    db:           Session = Depends(get_db),
    usuario:      UsuarioSistema = Depends(get_current_user),
):
    r = (
        db.query(ComprobanteRetencion)
        .options(
            joinedload(ComprobanteRetencion.proveedor),
            joinedload(ComprobanteRetencion.comprobante_origen),
            joinedload(ComprobanteRetencion.detalles),
        )
        .filter(
            ComprobanteRetencion.id_retencion == id_retencion,
            ComprobanteRetencion.id_usuario   == usuario.id_usuario,
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Retención no encontrada")
    return _serial_full(r)


# ─── GET /{id}/pdf/ — descargar PDF ──────────────────────
@router.get("/{id_retencion}/pdf/")
def descargar_pdf(
    id_retencion: int,
    db:           Session = Depends(get_db),
    usuario:      UsuarioSistema = Depends(get_current_user),
):
    r = (
        db.query(ComprobanteRetencion)
        .options(
            joinedload(ComprobanteRetencion.proveedor),
            joinedload(ComprobanteRetencion.comprobante_origen),
            joinedload(ComprobanteRetencion.detalles),
        )
        .filter(
            ComprobanteRetencion.id_retencion == id_retencion,
            ComprobanteRetencion.id_usuario   == usuario.id_usuario,
        )
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Retención no encontrada")

    uid = usuario.id_usuario
    neg_ruc          = _param_negocio(db, uid, "NEGOCIO_RUC",           usuario.cedula or "9999999999999")
    neg_razon_social = _param_negocio(db, uid, "NEGOCIO_RAZON_SOCIAL",  "NOMBRE DEL NEGOCIO S.A.")
    neg_nombre       = _param_negocio(db, uid, "NEGOCIO_NOMBRE",        neg_razon_social)
    neg_dir_matriz   = _param_negocio(db, uid, "NEGOCIO_DIRECCION_MATRIZ", "")
    neg_telefono     = _param_negocio(db, uid, "NEGOCIO_TELEFONO",      "")
    neg_email        = _param_negocio(db, uid, "NEGOCIO_EMAIL",         "")
    neg_ambiente     = _param_negocio(db, uid, "NEGOCIO_AMBIENTE",      "Pruebas")
    neg_obligado     = _param_negocio(db, uid, "NEGOCIO_OBLIGADO_CONT", "NO")
    neg_logo_url     = _param_negocio(db, uid, "NEGOCIO_LOGO",            "")
    logo_img         = _logo_image(neg_logo_url, max_w=140, max_h=70)

    nombre_proveedor  = ""
    identificacion    = "—"
    if r.proveedor:
        nombre_proveedor = r.proveedor.razon_social or r.proveedor.nombres_apellidos or "—"
        identificacion   = r.proveedor.identificacion or "—"

    # ── Colores
    DORADO       = colors.HexColor("#d97706")
    GRIS_CLARO   = colors.HexColor("#f9f9f9")
    BORDE        = colors.HexColor("#000000")
    BORDE_CLARO  = colors.HexColor("#cccccc")
    BORDE_MUY_C  = colors.HexColor("#eeeeee")
    NEGRO        = colors.HexColor("#000000")
    GRIS_TEXTO   = colors.HexColor("#374151")
    DORADO_LIGHT = colors.HexColor("#fef3c7")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.0*cm, leftMargin=1.0*cm,
        topMargin=1.0*cm,   bottomMargin=1.0*cm,
    )

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
        [Paragraph("COMPROBANTE DE RETENCIÓN",
                   ParagraphStyle("nc2", fontName="Helvetica-Bold", fontSize=10, leading=13,
                                  alignment=TA_CENTER, textColor=NEGRO)), ""],
        [Paragraph("No.", sb), Paragraph(r.numero_comprobante or "—",
                   ParagraphStyle("mono", fontName="Courier", fontSize=7, leading=9))],
        [Paragraph("<b>Autorización:</b>", sb),
         Paragraph(r.numero_autorizacion or "—", sn)],
        [Paragraph("FECHA EMISIÓN:", sb),
         Paragraph(r.fecha_emision.strftime('%d/%m/%Y'), sn)],
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

    # ── Proveedor / Receptor
    comp_origen_num = "—"
    if r.comprobante_origen:
        comp_origen_num = r.comprobante_origen.numero_comprobante or "—"

    receptor_data = [
        [Paragraph(f"<b>Razón Social / Nombres y Apellidos:</b> {nombre_proveedor}", sn),
         Paragraph(f"<b>RUC / CI:</b> {identificacion}", sn)],
        [Paragraph(f"<b>Ejercicio Fiscal:</b> {r.ejercicio_fiscal}", sn),
         Paragraph(f"<b>Comprobante Origen:</b> {comp_origen_num}", sn)],
    ]
    receptor_tabla = Table(receptor_data, colWidths=[col_w * 0.6, col_w * 0.4])
    receptor_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_CLARO),
        ("TOPPADDING",(0,0),(-1,-1),4), ("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8),
    ]))
    elements.append(receptor_tabla)

    # ── Detalle retenciones
    det_encab = [
        Paragraph("TIPO",          ParagraphStyle("dh1", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("CÓD. SRI",      ParagraphStyle("dh2", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("DESCRIPCIÓN",   ParagraphStyle("dh3", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("BASE IMP.",     ParagraphStyle("dh4", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("%",             ParagraphStyle("dh5", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("VALOR RET.",    ParagraphStyle("dh6", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]
    det_filas = [det_encab]
    for idx, d in enumerate(r.detalles):
        tipo_label = "RENTA" if d.tipo.value == "renta" else "IVA"
        det_filas.append([
            Paragraph(tipo_label, sb),
            Paragraph(d.codigo_sri or "—",
                      ParagraphStyle(f"c{idx}", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)),
            Paragraph(d.descripcion or "—", sn),
            Paragraph(f"${float(d.base_imponible):.2f}", sr),
            Paragraph(f"{float(d.porcentaje):.1f}%", sr),
            Paragraph(f"${float(d.valor_retenido):.2f}", sr),
        ])

    det_tabla = Table(det_filas, colWidths=[col_w*0.10, col_w*0.10, col_w*0.38, col_w*0.16, col_w*0.10, col_w*0.16])
    det_style = [
        ("BACKGROUND",(0,0),(-1,0), DORADO), ("TEXTCOLOR",(0,0),(-1,0), colors.white),
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
    tot_data = [
        [Paragraph("TOTAL RETENIDO RENTA", sb),
         Paragraph(f"$ {float(r.total_retenido_renta):.2f}",
                   ParagraphStyle("tv1", fontName="Courier", fontSize=7.5, leading=9, alignment=TA_RIGHT))],
        [Paragraph("TOTAL RETENIDO IVA", sb),
         Paragraph(f"$ {float(r.total_retenido_iva):.2f}",
                   ParagraphStyle("tv2", fontName="Courier", fontSize=7.5, leading=9, alignment=TA_RIGHT))],
        [Paragraph("TOTAL RETENIDO", ParagraphStyle("tl3", fontName="Helvetica-Bold", fontSize=8, leading=10)),
         Paragraph(f"$ {float(r.total_retenido):.2f}",
                   ParagraphStyle("tv3", fontName="Courier-Bold", fontSize=8, leading=10, alignment=TA_RIGHT))],
    ]
    tot_tabla = Table(tot_data, colWidths=[col_w*0.30, col_w*0.15])
    tot_tabla.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.75,BORDE), ("INNERGRID",(0,0),(-1,-1),0.3,BORDE_MUY_C),
        ("TOPPADDING",(0,0),(-1,-1),3), ("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),6), ("RIGHTPADDING",(0,0),(-1,-1),6),
        ("BACKGROUND",(0,-1),(-1,-1), DORADO_LIGHT),
        ("FONTNAME",(0,-1),(-1,-1),"Helvetica-Bold"),
    ]))

    bottom = Table([[Spacer(1,1), tot_tabla]], colWidths=[col_w*0.55, col_w*0.45])
    bottom.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),0), ("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    elements.append(bottom)

    if r.observaciones:
        elements.append(Table(
            [[Paragraph(f"<b>Observaciones:</b> {r.observaciones}", sn)]],
            colWidths=[col_w]
        ))

    # ── Pie
    _now = datetime.now()
    pie_data = [[
        Paragraph("Página 1 de 1", ParagraphStyle("pl", fontName="Helvetica", fontSize=6.5, textColor=GRIS_TEXTO)),
        Paragraph(f"Generado por FactuStock  ·  {_now.strftime('%d/%m/%Y %H:%M')}",
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
            "Content-Disposition": f"attachment; filename=retencion_{r.numero_comprobante}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── POST /  — crear ──────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_retencion(
    datos:   RetencionCreate,
    db:      Session = Depends(get_db),
    usuario: UsuarioSistema = Depends(get_current_user),
):
    # Verificar número único
    existe = db.query(ComprobanteRetencion).filter(
        ComprobanteRetencion.numero_comprobante == datos.numero_comprobante,
        ComprobanteRetencion.id_usuario         == usuario.id_usuario,
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail=f"Ya existe una retención con el número {datos.numero_comprobante}")

    if not datos.detalles:
        raise HTTPException(status_code=400, detail="Debe agregar al menos un detalle de retención")

    # Calcular totales
    total_renta = sum(d.valor_retenido for d in datos.detalles if d.tipo == "renta")
    total_iva   = sum(d.valor_retenido for d in datos.detalles if d.tipo == "iva")
    total       = total_renta + total_iva

    retencion = ComprobanteRetencion(
        id_usuario              = usuario.id_usuario,
        id_persona_comercial    = datos.id_persona_comercial,
        id_comprobante_origen   = datos.id_comprobante_origen,
        numero_comprobante      = datos.numero_comprobante,
        numero_autorizacion     = datos.numero_autorizacion,
        fecha_emision           = datos.fecha_emision,
        ejercicio_fiscal        = datos.ejercicio_fiscal,
        total_retenido_renta    = round(total_renta, 2),
        total_retenido_iva      = round(total_iva, 2),
        total_retenido          = round(total, 2),
        observaciones           = datos.observaciones,
        estado                  = EstadoRetencionEnum.emitida,
    )
    db.add(retencion)
    db.flush()

    for d in datos.detalles:
        detalle = DetalleRetencion(
            id_retencion   = retencion.id_retencion,
            tipo           = TipoRetencionEnum(d.tipo),
            codigo_sri     = d.codigo_sri,
            descripcion    = d.descripcion,
            base_imponible = round(d.base_imponible, 2),
            porcentaje     = round(d.porcentaje, 2),
            valor_retenido = round(d.valor_retenido, 2),
        )
        db.add(detalle)

    db.commit()
    db.refresh(retencion)

    # Recargar con relaciones
    r = (
        db.query(ComprobanteRetencion)
        .options(
            joinedload(ComprobanteRetencion.proveedor),
            joinedload(ComprobanteRetencion.comprobante_origen),
            joinedload(ComprobanteRetencion.detalles),
        )
        .filter(ComprobanteRetencion.id_retencion == retencion.id_retencion)
        .first()
    )
    return _serial_full(r)


# ─── PATCH /{id}/anular ───────────────────────────────────
@router.patch("/{id_retencion}/anular")
def anular_retencion(
    id_retencion: int,
    db:           Session = Depends(get_db),
    usuario:      UsuarioSistema = Depends(get_current_user),
):
    r = db.query(ComprobanteRetencion).filter(
        ComprobanteRetencion.id_retencion == id_retencion,
        ComprobanteRetencion.id_usuario   == usuario.id_usuario,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Retención no encontrada")
    if r.estado == EstadoRetencionEnum.anulada:
        raise HTTPException(status_code=400, detail="La retención ya está anulada")

    r.estado = EstadoRetencionEnum.anulada
    db.commit()
    return {"mensaje": "Retención anulada correctamente", "id_retencion": id_retencion}
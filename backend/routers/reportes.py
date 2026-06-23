from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date
from typing import Optional
import math, io

from database import get_db
from models import (
    FacturaVenta, DetalleFacturaVenta, Producto,
    PersonaComercial, UsuarioSistema
)
from dependencies import get_current_user
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: genera PDF con reportlab
# ─────────────────────────────────────────────────────────────────────────────
def _generar_pdf_tabla(titulo: str, subtitulo: str, columnas: list, filas: list,
                        totales: dict = None, pie_nota: str = None) -> bytes:
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    except ImportError:
        raise ImportError("reportlab no instalado. Ejecuta: pip install reportlab")

    buf = io.BytesIO()
    page = landscape(A4) if len(columnas) > 5 else A4
    doc = SimpleDocTemplate(buf, pagesize=page,
                             leftMargin=1.5*cm, rightMargin=1.5*cm,
                             topMargin=1.5*cm, bottomMargin=1.5*cm)

    styles = getSampleStyleSheet()
    AZUL   = colors.HexColor('#15389a')
    GRIS_C = colors.HexColor('#f8fafc')
    GRIS_B = colors.HexColor('#e2e8f0')
    BLANCO = colors.white
    NEGRO  = colors.HexColor('#0f172a')
    TEXTO  = colors.HexColor('#475569')

    story = []

    story.append(Paragraph(titulo, ParagraphStyle('titulo', fontSize=16, fontName='Helvetica-Bold', textColor=AZUL, spaceAfter=4)))
    story.append(Paragraph(subtitulo, ParagraphStyle('sub', fontSize=9, fontName='Helvetica', textColor=TEXTO, spaceAfter=14)))

    header_row = [col['label'] for col in columnas]
    data = [header_row]
    for fila in filas:
        data.append([str(fila.get(col['key'], '')) for col in columnas])

    if totales:
        total_row = []
        for col in columnas:
            total_row.append(totales.get(col['label'], ''))
        data.append(total_row)

    page_w = page[0] - 3 * cm
    col_widths = [col.get('width', page_w / len(columnas)) for col in columnas]
    total_w = sum(col_widths)
    if total_w > page_w:
        factor = page_w / total_w
        col_widths = [w * factor for w in col_widths]

    t = Table(data, colWidths=col_widths, repeatRows=1)

    style = [
        ('BACKGROUND',   (0, 0), (-1, 0), AZUL),
        ('TEXTCOLOR',    (0, 0), (-1, 0), BLANCO),
        ('FONTNAME',     (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING',(0, 0), (-1, 0), 7),
        ('TOPPADDING',   (0, 0), (-1, 0), 7),
        ('FONTNAME',     (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE',     (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING',(0, 1), (-1, -1), 5),
        ('TOPPADDING',   (0, 1), (-1, -1), 5),
        ('TEXTCOLOR',    (0, 1), (-1, -1), NEGRO),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1 if not totales else -2), [BLANCO, GRIS_C]),
        ('GRID',         (0, 0), (-1, -1), 0.4, GRIS_B),
        ('LINEBELOW',    (0, 0), (-1, 0),  1,   AZUL),
    ]

    for ci, col in enumerate(columnas):
        align = col.get('align', 'left').upper()
        rl_align = {'LEFT': 'LEFT', 'RIGHT': 'RIGHT', 'CENTER': 'CENTER'}.get(align, 'LEFT')
        style.append(('ALIGN', (ci, 0), (ci, -1), rl_align))

    if totales:
        last = len(data) - 1
        style += [
            ('BACKGROUND',  (0, last), (-1, last), colors.HexColor('#eff6ff')),
            ('FONTNAME',    (0, last), (-1, last), 'Helvetica-Bold'),
            ('TEXTCOLOR',   (0, last), (-1, last), AZUL),
            ('LINEABOVE',   (0, last), (-1, last), 1.2, AZUL),
        ]

    t.setStyle(TableStyle(style))
    story.append(t)

    if pie_nota:
        story.append(Spacer(1, 0.4*cm))
        story.append(Paragraph(f"* {pie_nota}", ParagraphStyle('nota', fontSize=7, fontName='Helvetica-Oblique', textColor=TEXTO)))

    from datetime import datetime
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} — FactuStock",
        ParagraphStyle('footer', fontSize=7, fontName='Helvetica', textColor=colors.HexColor('#94a3b8'), alignment=TA_RIGHT)
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: respuesta PDF — CORREGIDO
# Sanitiza el filename y expone el header Content-Disposition correctamente.
# El middleware CORS de main.py debe incluir expose_headers=["Content-Disposition"]
# ─────────────────────────────────────────────────────────────────────────────
def _pdf_response(data: bytes, filename: str):
    # Sanitizar: reemplazar None/undefined que puedan venir de fechas nulas
    safe_filename = filename.replace("None", "sin-fecha").replace("undefined", "sin-fecha")
    # Usar comillas en el filename para soportar caracteres especiales
    content_disposition = f'attachment; filename="{safe_filename}"'
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={
            "Content-Disposition": content_disposition,
            # Nota: Access-Control-Expose-Headers se gestiona en el middleware CORS
            # de main.py con expose_headers=["Content-Disposition"]
            # No se duplica aquí porque el middleware CORS sobrescribe los headers CORS.
        }
    )


# ─────────────────────────────────────────────────────────────────────────────
# RESUMEN GENERAL
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/resumen-general", response_model=dict)
def resumen_general(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    filas = db.query(
        FacturaVenta.estado,
        func.count(FacturaVenta.id_factura).label("cantidad"),
        func.coalesce(func.sum(FacturaVenta.total),        0).label("total"),
        func.coalesce(func.sum(FacturaVenta.subtotal_0),   0).label("sub0"),
        func.coalesce(func.sum(FacturaVenta.subtotal_iva), 0).label("subiva"),
        func.coalesce(func.sum(FacturaVenta.iva),          0).label("iva"),
    ).filter(*filtros).group_by(FacturaVenta.estado).all()

    res = {
        "finalizadas": 0, "borradores": 0, "anuladas": 0, "total_comprobantes": 0,
        "total_ventas": 0.0, "subtotal_0": 0.0, "subtotal_iva": 0.0,
        "iva_generado": 0.0, "ticket_promedio": 0.0,
    }
    for f in filas:
        res["total_comprobantes"] += f.cantidad
        if f.estado == "finalizada":
            res["finalizadas"]  = f.cantidad
            res["total_ventas"] = float(f.total)
            res["subtotal_0"]   = float(f.sub0)
            res["subtotal_iva"] = float(f.subiva)
            res["iva_generado"] = float(f.iva)
        elif f.estado == "borrador": res["borradores"] = f.cantidad
        elif f.estado == "anulada":  res["anuladas"]   = f.cantidad
    if res["finalizadas"] > 0:
        res["ticket_promedio"] = round(res["total_ventas"] / res["finalizadas"], 2)
    return res


# ─────────────────────────────────────────────────────────────────────────────
# VENTAS POR MES
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/ventas-por-mes", response_model=dict)
def ventas_por_mes(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada"]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    mes_expr = func.date_format(FacturaVenta.fecha_emision, "%Y-%m")
    filas = db.query(
        mes_expr.label("mes"),
        func.count(FacturaVenta.id_factura).label("cantidad"),
        func.coalesce(func.sum(FacturaVenta.total),        0).label("total"),
        func.coalesce(func.sum(FacturaVenta.subtotal_0),   0).label("sub0"),
        func.coalesce(func.sum(FacturaVenta.subtotal_iva), 0).label("subiva"),
        func.coalesce(func.sum(FacturaVenta.iva),          0).label("iva"),
    ).filter(*filtros).group_by("mes").order_by("mes").all()

    return {"items": [{"mes": f.mes, "cantidad": f.cantidad, "total": float(f.total), "sub0": float(f.sub0), "subiva": float(f.subiva), "iva": float(f.iva)} for f in filas]}


# ─────────────────────────────────────────────────────────────────────────────
# TOP CLIENTES
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/top-clientes", response_model=dict)
def top_clientes(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limite: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada"]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    filas = db.query(
        PersonaComercial.id_persona_comercial,
        func.coalesce(PersonaComercial.nombres_apellidos, PersonaComercial.razon_social).label("nombre"),
        PersonaComercial.identificacion,
        func.count(FacturaVenta.id_factura).label("facturas"),
        func.coalesce(func.sum(FacturaVenta.total), 0).label("total"),
        func.coalesce(func.sum(FacturaVenta.iva),   0).label("iva"),
    ).join(PersonaComercial, FacturaVenta.id_persona_comercial == PersonaComercial.id_persona_comercial
    ).filter(*filtros).group_by(
        PersonaComercial.id_persona_comercial, PersonaComercial.nombres_apellidos,
        PersonaComercial.razon_social, PersonaComercial.identificacion,
    ).order_by(func.sum(FacturaVenta.total).desc()).limit(limite).all()

    return {"items": [{"id_persona": f.id_persona_comercial, "nombre": f.nombre or "Sin nombre", "identificacion": f.identificacion or "—", "facturas": f.facturas, "total": float(f.total), "iva": float(f.iva)} for f in filas]}


# ─────────────────────────────────────────────────────────────────────────────
# TOP PRODUCTOS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/top-productos", response_model=dict)
def top_productos(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limite: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada"]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    filas = db.query(
        Producto.id_producto, Producto.nombre, Producto.codigo,
        func.coalesce(func.sum(DetalleFacturaVenta.cantidad), 0).label("cantidad_vendida"),
        func.count(func.distinct(FacturaVenta.id_factura)).label("num_facturas"),
        func.coalesce(func.sum(DetalleFacturaVenta.total), 0).label("total"),
    ).join(DetalleFacturaVenta, Producto.id_producto == DetalleFacturaVenta.id_producto
    ).join(FacturaVenta, DetalleFacturaVenta.id_factura == FacturaVenta.id_factura
    ).filter(*filtros).group_by(Producto.id_producto, Producto.nombre, Producto.codigo
    ).order_by(func.sum(DetalleFacturaVenta.total).desc()).limit(limite).all()

    return {"items": [{"id_producto": f.id_producto, "nombre": f.nombre, "codigo": f.codigo or "—", "cantidad_vendida": float(f.cantidad_vendida), "num_facturas": f.num_facturas, "total": float(f.total)} for f in filas]}


# ─────────────────────────────────────────────────────────────────────────────
# LIBRO DE VENTAS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/libro-ventas", response_model=dict)
def libro_ventas(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    query = db.query(FacturaVenta).options(joinedload(FacturaVenta.cliente)
    ).filter(FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada")
    if fecha_desde: query = query.filter(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: query = query.filter(FacturaVenta.fecha_emision <= fecha_hasta)
    total = query.count()
    facturas = query.order_by(
        FacturaVenta.fecha_emision.asc(), FacturaVenta.numero_comprobante.asc()
    ).offset((pagina - 1) * por_pagina).limit(por_pagina).all()

    return {
        "items": [{
            "id_factura":          f.id_factura,
            "numero_comprobante":  f.numero_comprobante,
            "fecha_emision":       str(f.fecha_emision) if f.fecha_emision else None,
            "cliente_nombre":      (f.cliente.nombres_apellidos or f.cliente.razon_social) if f.cliente else "—",
            "cliente_ruc":         f.cliente.identificacion if f.cliente else "—",
            "subtotal_0":          float(f.subtotal_0  or 0),
            "subtotal_iva":        float(f.subtotal_iva or 0),
            "iva":                 float(f.iva         or 0),
            "descuento":           float(f.descuento   or 0),
            "total":               float(f.total       or 0),
        } for f in facturas],
        "total":        total,
        "pagina":       pagina,
        "por_pagina":   por_pagina,
        "total_paginas": math.ceil(total / por_pagina) if total else 1,
    }


# ─────────────────────────────────────────────────────────────────────────────
# IVA DETALLE
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/iva-detalle", response_model=dict)
def iva_detalle(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada"]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    res = db.query(
        func.coalesce(func.sum(FacturaVenta.subtotal_0),   0).label("base_0"),
        func.coalesce(func.sum(FacturaVenta.subtotal_iva), 0).label("base_iva"),
        func.coalesce(func.sum(FacturaVenta.iva),          0).label("iva"),
        func.coalesce(func.sum(FacturaVenta.total),        0).label("total"),
        func.count(FacturaVenta.id_factura).label("num_facturas"),
    ).filter(*filtros).first()

    mes_expr = func.date_format(FacturaVenta.fecha_emision, "%Y-%m")
    por_mes = db.query(
        mes_expr.label("mes"),
        func.coalesce(func.sum(FacturaVenta.subtotal_0),   0).label("base_0"),
        func.coalesce(func.sum(FacturaVenta.subtotal_iva), 0).label("base_iva"),
        func.coalesce(func.sum(FacturaVenta.iva),          0).label("iva"),
    ).filter(*filtros).group_by("mes").order_by("mes").all()

    return {
        "resumen": {
            "base_0":        float(res.base_0),
            "base_iva":      float(res.base_iva),
            "iva_generado":  float(res.iva),
            "total_ventas":  float(res.total),
            "num_facturas":  res.num_facturas,
            "casilla_401":   float(res.base_0),
            "casilla_411":   float(res.base_iva),
            "casilla_421":   float(res.iva),
            "casilla_499":   float(res.total),
        },
        "por_mes": [{"mes": m.mes, "base_0": float(m.base_0), "base_iva": float(m.base_iva), "iva": float(m.iva)} for m in por_mes],
    }


# ═════════════════════════════════════════════════════════════════════════════
# EXPORTACIONES PDF
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/exportar/clientes/pdf")
def exportar_clientes_pdf(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limite: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada"]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    filas_db = db.query(
        PersonaComercial.id_persona_comercial,
        func.coalesce(PersonaComercial.nombres_apellidos, PersonaComercial.razon_social).label("nombre"),
        PersonaComercial.identificacion,
        func.count(FacturaVenta.id_factura).label("facturas"),
        func.coalesce(func.sum(FacturaVenta.total), 0).label("total"),
    ).join(PersonaComercial, FacturaVenta.id_persona_comercial == PersonaComercial.id_persona_comercial
    ).filter(*filtros).group_by(
        PersonaComercial.id_persona_comercial, PersonaComercial.nombres_apellidos,
        PersonaComercial.razon_social, PersonaComercial.identificacion,
    ).order_by(func.sum(FacturaVenta.total).desc()).limit(limite).all()

    filas = [{
        "pos":           str(i + 1),
        "nombre":        f.nombre or "—",
        "identificacion": f.identificacion or "—",
        "facturas":      str(f.facturas),
        "total":         f"${float(f.total):,.2f}",
    } for i, f in enumerate(filas_db)]

    total_general   = sum(float(f.total)    for f in filas_db)
    total_facturas  = sum(f.facturas        for f in filas_db)
    periodo = f"{fecha_desde} al {fecha_hasta}" if fecha_desde and fecha_hasta else "Todo el período"

    pdf = _generar_pdf_tabla(
        titulo="Top Clientes por Facturación",
        subtitulo=f"Período: {periodo}  |  {len(filas)} clientes",
        columnas=[
            {"label": "#",              "key": "pos",            "width": 25,  "align": "center"},
            {"label": "Cliente",        "key": "nombre",         "width": 180, "align": "left"},
            {"label": "Identificación", "key": "identificacion", "width": 110, "align": "center"},
            {"label": "Facturas",       "key": "facturas",       "width": 60,  "align": "center"},
            {"label": "Total ($)",      "key": "total",          "width": 90,  "align": "right"},
        ],
        filas=filas,
        totales={
            "#": "TOTAL", "Cliente": "", "Identificación": "",
            "Facturas": str(total_facturas),
            "Total ($)": f"${total_general:,.2f}",
        },
    )
    return _pdf_response(pdf, f"clientes_{fecha_desde}_{fecha_hasta}.pdf")


@router.get("/exportar/productos/pdf")
def exportar_productos_pdf(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    limite: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada"]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    filas_db = db.query(
        Producto.id_producto, Producto.nombre, Producto.codigo,
        func.coalesce(func.sum(DetalleFacturaVenta.cantidad), 0).label("cantidad"),
        func.count(func.distinct(FacturaVenta.id_factura)).label("num_facturas"),
        func.coalesce(func.sum(DetalleFacturaVenta.total), 0).label("total"),
    ).join(DetalleFacturaVenta, Producto.id_producto == DetalleFacturaVenta.id_producto
    ).join(FacturaVenta, DetalleFacturaVenta.id_factura == FacturaVenta.id_factura
    ).filter(*filtros).group_by(Producto.id_producto, Producto.nombre, Producto.codigo
    ).order_by(func.sum(DetalleFacturaVenta.total).desc()).limit(limite).all()

    filas = [{
        "pos":      str(i + 1),
        "nombre":   f.nombre,
        "codigo":   f.codigo or "—",
        "cantidad": str(int(float(f.cantidad))),
        "facturas": f"{f.num_facturas} fact.",
        "total":    f"${float(f.total):,.2f}",
    } for i, f in enumerate(filas_db)]

    total_general = sum(float(f.total) for f in filas_db)
    periodo = f"{fecha_desde} al {fecha_hasta}" if fecha_desde and fecha_hasta else "Todo el período"

    pdf = _generar_pdf_tabla(
        titulo="Productos / Servicios más Vendidos",
        subtitulo=f"Período: {periodo}  |  {len(filas)} productos",
        columnas=[
            {"label": "#",           "key": "pos",      "width": 25,  "align": "center"},
            {"label": "Producto",    "key": "nombre",   "width": 160, "align": "left"},
            {"label": "Código",      "key": "codigo",   "width": 70,  "align": "center"},
            {"label": "Cant.",       "key": "cantidad", "width": 50,  "align": "center"},
            {"label": "En facturas", "key": "facturas", "width": 70,  "align": "center"},
            {"label": "Total ($)",   "key": "total",    "width": 90,  "align": "right"},
        ],
        filas=filas,
        totales={
            "#": "TOTAL", "Producto": "", "Código": "", "Cant.": "",
            "En facturas": "", "Total ($)": f"${total_general:,.2f}",
        },
    )
    return _pdf_response(pdf, f"productos_{fecha_desde}_{fecha_hasta}.pdf")


@router.get("/exportar/libro-ventas/pdf")
def exportar_libro_ventas_pdf(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    query = db.query(FacturaVenta).options(joinedload(FacturaVenta.cliente)
    ).filter(FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada")
    if fecha_desde: query = query.filter(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: query = query.filter(FacturaVenta.fecha_emision <= fecha_hasta)
    facturas = query.order_by(
        FacturaVenta.fecha_emision.asc(), FacturaVenta.numero_comprobante.asc()
    ).all()

    filas = [{
        "numero":  f.numero_comprobante or "—",
        "fecha":   str(f.fecha_emision) if f.fecha_emision else "—",
        "cliente": (f.cliente.nombres_apellidos or f.cliente.razon_social) if f.cliente else "—",
        "ruc":     f.cliente.identificacion if f.cliente else "—",
        "sub0":    f"${float(f.subtotal_0   or 0):,.2f}",
        "subiva":  f"${float(f.subtotal_iva or 0):,.2f}",
        "iva":     f"${float(f.iva          or 0):,.2f}",
        "total":   f"${float(f.total        or 0):,.2f}",
    } for f in facturas]

    t_sub0   = sum(float(f.subtotal_0   or 0) for f in facturas)
    t_subiva = sum(float(f.subtotal_iva or 0) for f in facturas)
    t_iva    = sum(float(f.iva          or 0) for f in facturas)
    t_total  = sum(float(f.total        or 0) for f in facturas)

    periodo = f"{fecha_desde} al {fecha_hasta}" if fecha_desde and fecha_hasta else "Todo el período"
    pdf = _generar_pdf_tabla(
        titulo="Libro de Ventas",
        subtitulo=f"Período: {periodo}  |  {len(filas)} facturas finalizadas",
        columnas=[
            {"label": "Comprobante", "key": "numero",  "width": 100, "align": "center"},
            {"label": "Fecha",       "key": "fecha",   "width": 70,  "align": "center"},
            {"label": "Cliente",     "key": "cliente", "width": 130, "align": "left"},
            {"label": "RUC/Cédula",  "key": "ruc",     "width": 90,  "align": "center"},
            {"label": "Base 0%",     "key": "sub0",    "width": 70,  "align": "right"},
            {"label": "Base IVA",    "key": "subiva",  "width": 70,  "align": "right"},
            {"label": "IVA",         "key": "iva",     "width": 65,  "align": "right"},
            {"label": "Total ($)",   "key": "total",   "width": 80,  "align": "right"},
        ],
        filas=filas,
        totales={
            "Comprobante": f"TOTALES ({len(filas)})", "Fecha": "", "Cliente": "", "RUC/Cédula": "",
            "Base 0%":   f"${t_sub0:,.2f}",
            "Base IVA":  f"${t_subiva:,.2f}",
            "IVA":       f"${t_iva:,.2f}",
            "Total ($)": f"${t_total:,.2f}",
        },
        pie_nota="Valores referenciales basados en facturas finalizadas. Consulta a tu contador para la declaración oficial.",
    )
    return _pdf_response(pdf, f"libro_ventas_{fecha_desde}_{fecha_hasta}.pdf")


@router.get("/exportar/iva/pdf")
def exportar_iva_pdf(
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    uid = current_user.id_usuario
    filtros = [FacturaVenta.id_usuario == uid, FacturaVenta.estado == "finalizada"]
    if fecha_desde: filtros.append(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: filtros.append(FacturaVenta.fecha_emision <= fecha_hasta)

    res = db.query(
        func.coalesce(func.sum(FacturaVenta.subtotal_0),   0).label("base_0"),
        func.coalesce(func.sum(FacturaVenta.subtotal_iva), 0).label("base_iva"),
        func.coalesce(func.sum(FacturaVenta.iva),          0).label("iva"),
        func.coalesce(func.sum(FacturaVenta.total),        0).label("total"),
        func.count(FacturaVenta.id_factura).label("num_facturas"),
    ).filter(*filtros).first()

    filas = [
        {"casilla": "401", "descripcion": "Ventas locales (excluye activos fijos) tarifa 0%",  "valor": f"${float(res.base_0):,.2f}"},
        {"casilla": "411", "descripcion": "Ventas locales (excluye activos fijos) tarifa 15%", "valor": f"${float(res.base_iva):,.2f}"},
        {"casilla": "421", "descripcion": "IVA en ventas",                                      "valor": f"${float(res.iva):,.2f}"},
        {"casilla": "499", "descripcion": "Total ventas y otras operaciones",                   "valor": f"${float(res.total):,.2f}"},
    ]

    periodo = f"{fecha_desde} al {fecha_hasta}" if fecha_desde and fecha_hasta else "Todo el período"
    pdf = _generar_pdf_tabla(
        titulo="Resumen IVA — Formulario 104 (Referencial)",
        subtitulo=f"Período: {periodo}  |  {res.num_facturas} facturas finalizadas",
        columnas=[
            {"label": "Casilla",     "key": "casilla",     "width": 70,  "align": "center"},
            {"label": "Descripción", "key": "descripcion", "width": 320, "align": "left"},
            {"label": "Valor ($)",   "key": "valor",       "width": 100, "align": "right"},
        ],
        filas=filas,
        pie_nota="Valores referenciales. Consulta a tu contador para la declaración oficial ante el SRI.",
    )
    return _pdf_response(pdf, f"iva_{fecha_desde}_{fecha_hasta}.pdf")
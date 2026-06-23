from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, datetime, timedelta
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
    FacturaVenta, DetalleFacturaVenta, Producto,
    PersonaComercial, ParametroSistema, MovimientoInventario,
    KardexInventario, UsuarioSistema,
    ComprobanteRecibido, DetalleComprobanteRecibido
)
from schemas import (
    FacturaCreate, FacturaUpdate, FacturaResponse,
    FacturaListResponse, EstadoFacturaEnum
)
from dependencies import get_current_user, require_docente

router = APIRouter(prefix="/api/facturas", tags=["Facturas"])

# ─── Constantes SRI ───────────────────────────────────────
DIAS_HABILES_ANULACION = 3
DIAS_LABORABLES = {0, 1, 2, 3, 4}


def _dias_habiles_transcurridos(desde: date, hasta: date) -> int:
    if hasta < desde:
        return 0
    dias = 0
    current = desde
    while current <= hasta:
        if current.weekday() in DIAS_LABORABLES:
            dias += 1
        current += timedelta(days=1)
    return max(dias - 1, 0)


def _validar_anulacion_sri(factura: FacturaVenta) -> None:
    estado = factura.estado.value if hasattr(factura.estado, 'value') else factura.estado

    if estado == "borrador":
        raise HTTPException(
            status_code=400,
            detail=(
                "Los documentos en estado 'Borrador' no se anulan: "
                "simplemente elimínalos. La anulación SRI aplica solo a "
                "comprobantes ya autorizados (finalizados/emitidos)."
            )
        )

    if estado in ("anulada", "anulado"):
        raise HTTPException(status_code=400, detail="Este comprobante ya está anulado.")

    if estado not in {"finalizada", "emitida"}:
        raise HTTPException(
            status_code=400,
            detail=f"El comprobante está en estado '{estado}', que no permite anulación directa."
        )

    if factura.fecha_emision:
        hoy  = date.today()
        dias = _dias_habiles_transcurridos(factura.fecha_emision, hoy)
        if dias > DIAS_HABILES_ANULACION:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Han transcurrido {dias} días hábiles desde la emisión "
                    f"({factura.fecha_emision.strftime('%d/%m/%Y')}). "
                    f"El SRI permite anulación directa solo dentro de los primeros "
                    f"{DIAS_HABILES_ANULACION} días hábiles. "
                    "Para anular fuera de este plazo debes emitir una Nota de Crédito."
                )
            )


def _generar_numero_comprobante(db: Session) -> str:
    param = db.query(ParametroSistema).filter(
        ParametroSistema.clave == "FORMATO_FACTURA"
    ).first()
    formato = param.valor if param else "001-001-{NUMERO}"
    total   = db.query(func.count(FacturaVenta.id_factura)).scalar() or 0
    numero  = str(total + 1).zfill(9)
    return formato.replace("{NUMERO}", numero)


def _calcular_detalle(item):
    cantidad        = Decimal(str(item.cantidad))
    precio_unitario = Decimal(str(item.precio_unitario))
    descuento       = Decimal(str(item.descuento))
    porcentaje_iva  = Decimal(str(item.porcentaje_iva))
    subtotal        = (cantidad * precio_unitario) - descuento
    aplica_iva      = porcentaje_iva > 0
    iva             = round(subtotal * (porcentaje_iva / 100), 2) if aplica_iva else Decimal("0.00")
    total           = subtotal + iva
    return subtotal, iva, total


# ╔══════════════════════════════════════════════════════════╗
# ║  CORRECCIÓN: barWidth calculado dinámicamente           ║
# ╚══════════════════════════════════════════════════════════╝
def _barcode_clave_acceso(clave: str, ancho_disponible: float):
    bc_ref = code128.Code128(
        clave,
        barWidth=1.0,
        barHeight=24,
        humanReadable=False,
        quiet=False,
    )
    modulos = bc_ref.width
    bar_width = (ancho_disponible / modulos) * 0.92
    bc = code128.Code128(
        clave,
        barWidth=bar_width,
        barHeight=24,
        humanReadable=False,
        quiet=False,
    )
    return bc


# ─── Helper: construir Image de logo para ReportLab ───────
def _logo_image(logo_url: str, max_w: float, max_h: float):
    """
    Recibe la URL guardada en NEGOCIO_LOGO, p.ej.:
      /uploads/logos_negocio/logo_1_abc123.png
    Prueba múltiples rutas en disco hasta encontrar el archivo.
    Devuelve un objeto Image de ReportLab escalado, o None.
    """
    if not logo_url:
        return None

    import logging
    logger = logging.getLogger(__name__)

    # Ruta relativa sin slash inicial  → "uploads/logos_negocio/archivo.png"
    rel = logo_url.lstrip("/")

    # Directorio donde corre el proceso FastAPI
    cwd = os.getcwd()

    candidates = [
        # 1. Relativa al CWD del servidor (caso más común)
        os.path.join(cwd, rel),
        # 2. Tal cual viene de la BD (por si es absoluta)
        logo_url,
        # 3. BASE_DIR definida en entorno
        os.path.join(os.environ.get("BASE_DIR", cwd), rel),
        # 4. Fallback MEDIA_ROOT
        os.path.join(os.environ.get("MEDIA_ROOT", "media"), rel),
    ]

    path = None
    for c in candidates:
        if c and os.path.isfile(c):
            path = c
            break

    if not path:
        logger.warning(
            "Logo no encontrado. logo_url=%r  cwd=%r  candidatos=%r",
            logo_url, cwd, candidates
        )
        return None

    try:
        img = Image(path)
        ratio = min(max_w / img.imageWidth, max_h / img.imageHeight)
        img.drawWidth  = img.imageWidth  * ratio
        img.drawHeight = img.imageHeight * ratio
        return img
    except Exception as e:
        logger.warning("Error al cargar logo %r: %s", path, e)
        return None


# ─── GET /api/facturas/ ───────────────────────────────────
@router.get("/", response_model=dict)
def listar_facturas(
    pagina:      int = Query(1,  ge=1),
    por_pagina:  int = Query(10, ge=1, le=100),
    estado:      Optional[EstadoFacturaEnum] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    buscar:      Optional[str]  = None,
    db:          Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    query = (
        db.query(FacturaVenta)
        .options(joinedload(FacturaVenta.cliente))
        .filter(FacturaVenta.id_usuario == current_user.id_usuario)
    )
    if estado:      query = query.filter(FacturaVenta.estado == estado)
    if fecha_desde: query = query.filter(FacturaVenta.fecha_emision >= fecha_desde)
    if fecha_hasta: query = query.filter(FacturaVenta.fecha_emision <= fecha_hasta)
    if buscar:
        query = query.join(PersonaComercial).filter(
            FacturaVenta.numero_comprobante.contains(buscar) |
            PersonaComercial.nombres_apellidos.contains(buscar) |
            PersonaComercial.razon_social.contains(buscar)
        )
    total    = query.count()
    facturas = (
        query.order_by(FacturaVenta.created_at.desc())
             .offset((pagina - 1) * por_pagina)
             .limit(por_pagina)
             .all()
    )
    return {
        "items":         [FacturaListResponse.from_orm(f) for f in facturas],
        "total":         total,
        "pagina":        pagina,
        "por_pagina":    por_pagina,
        "total_paginas": math.ceil(total / por_pagina) if total else 1,
    }


# ─── GET /api/facturas/resumen ────────────────────────────
@router.get("/resumen", response_model=dict)
def resumen_facturas(
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    filas = db.query(
        FacturaVenta.estado,
        func.count(FacturaVenta.id_factura).label("cantidad"),
        func.coalesce(func.sum(FacturaVenta.total), 0).label("monto")
    ).filter(
        FacturaVenta.id_usuario == current_user.id_usuario
    ).group_by(FacturaVenta.estado).all()

    resumen = {"finalizadas": 0, "borradores": 0, "anuladas": 0, "totalFinalizado": 0.0}
    for fila in filas:
        if fila.estado == "finalizada":
            resumen["finalizadas"]     = fila.cantidad
            resumen["totalFinalizado"] = float(fila.monto)
        elif fila.estado == "borrador":
            resumen["borradores"] = fila.cantidad
        elif fila.estado == "anulada":
            resumen["anuladas"]   = fila.cantidad
    return resumen


# ─── GET /api/facturas/{id} ───────────────────────────────
@router.get("/{id_factura}", response_model=FacturaResponse)
def obtener_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    factura = (
        db.query(FacturaVenta)
        .options(
            joinedload(FacturaVenta.cliente),
            joinedload(FacturaVenta.detalles).joinedload(DetalleFacturaVenta.producto)
        )
        .filter(
            FacturaVenta.id_factura == id_factura,
            FacturaVenta.id_usuario == current_user.id_usuario
        ).first()
    )
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return factura


# ─── GET /api/facturas/{id}/pdf/ ─────────────────────────
@router.get("/{id_factura}/pdf/")
def descargar_pdf(
    id_factura: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    factura = (
        db.query(FacturaVenta)
        .options(
            joinedload(FacturaVenta.cliente),
            joinedload(FacturaVenta.detalles).joinedload(DetalleFacturaVenta.producto)
        )
        .filter(
            FacturaVenta.id_factura == id_factura,
            FacturaVenta.id_usuario == current_user.id_usuario
        ).first()
    )
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    # ── Datos del negocio ─────────────────────────────────
    def _param(clave, default=""):
        p = db.query(ParametroSistema).filter(
            ParametroSistema.clave      == clave,
            ParametroSistema.id_usuario == current_user.id_usuario
        ).first()
        return p.valor if p else default

    neg_ruc              = _param("NEGOCIO_RUC",                current_user.cedula or "9999999999999")
    neg_razon_social     = _param("NEGOCIO_RAZON_SOCIAL",       "NOMBRE DEL NEGOCIO S.A.")
    neg_nombre_comercial = _param("NEGOCIO_NOMBRE",             neg_razon_social)
    neg_dir_matriz       = _param("NEGOCIO_DIRECCION_MATRIZ",   "")
    neg_dir_sucursal     = _param("NEGOCIO_DIRECCION_SUCURSAL", "")
    neg_telefono         = _param("NEGOCIO_TELEFONO",           "")
    neg_email            = _param("NEGOCIO_EMAIL",              "")
    neg_ambiente         = _param("NEGOCIO_AMBIENTE",           "Pruebas")
    neg_obligado_cont    = _param("NEGOCIO_OBLIGADO_CONT",      "NO")
    neg_contribuyente    = _param("NEGOCIO_CONTRIBUYENTE",      "")
    neg_serie_estab      = _param("NEGOCIO_SERIE_ESTAB",        "001")
    neg_serie_emision    = _param("NEGOCIO_SERIE_EMISION",      "001")
    # ── LOGO: leído desde ParametroSistema ────────────────
    neg_logo_url         = _param("NEGOCIO_LOGO",               "")

    # ── Clave de acceso SRI (49 dígitos) ──────────────────
    fecha_str    = factura.fecha_emision.strftime("%d%m%Y")
    tipo_doc     = "01"
    ruc_13       = (neg_ruc or "0" * 13).ljust(13, "0")[:13]
    amb_dig      = "2" if "prod" in neg_ambiente.lower() else "1"
    serie        = f"{neg_serie_estab}{neg_serie_emision}"
    num_digits   = "".join(filter(str.isdigit, factura.numero_comprobante or ""))
    secuencial   = num_digits[-9:].zfill(9) if num_digits else "000000001"
    clave_acceso = f"{fecha_str}{tipo_doc}{ruc_13}{amb_dig}{serie}{secuencial}12345678"
    clave_acceso = clave_acceso[:49].ljust(49, "0")

    nombre_cliente = (
        factura.cliente.nombres_apellidos or factura.cliente.razon_social or "—"
    ) if factura.cliente else "—"

    iva_pct = float(factura.porcentaje_iva) if factura.porcentaje_iva else 0

    # ── Documento PDF ─────────────────────────────────────
    buffer = io.BytesIO()
    doc    = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.0*cm, leftMargin=1.0*cm,
        topMargin=1.0*cm,   bottomMargin=1.0*cm
    )

    # Paleta
    AZUL_OSCURO     = colors.HexColor("#1e1b4b")
    GRIS_CLARO      = colors.HexColor("#f9f9f9")
    GRIS_SECCION    = colors.HexColor("#e5e7eb")
    BORDE           = colors.HexColor("#000000")
    BORDE_CLARO     = colors.HexColor("#cccccc")
    BORDE_MUY_CLARO = colors.HexColor("#eeeeee")
    NEGRO           = colors.HexColor("#000000")
    GRIS_TEXTO      = colors.HexColor("#374151")
    AZUL_TOTAL      = colors.HexColor("#dbeafe")

    # Estilos base
    sn  = ParagraphStyle("sn",  fontName="Helvetica",      fontSize=7, leading=9,  textColor=NEGRO)
    sb  = ParagraphStyle("sb",  fontName="Helvetica-Bold", fontSize=7, leading=9,  textColor=NEGRO)
    scb = ParagraphStyle("scb", fontName="Helvetica-Bold", fontSize=7, leading=9,  alignment=TA_CENTER)
    sr  = ParagraphStyle("sr",  fontName="Helvetica",      fontSize=7, leading=9,  alignment=TA_RIGHT)

    elements = []
    col_w = doc.width

    # ════════════════════════════════════════════════════
    # SECCIÓN 1 — CABECERA (con logo)
    # ════════════════════════════════════════════════════

    # Intentar cargar imagen del logo
    logo_img = _logo_image(neg_logo_url, max_w=140, max_h=70)

    emisor_content = []

    # Si hay logo, se muestra primero; si no, se omite
    if logo_img:
        # Envolver el Image en una tabla de celda única para que fluya en la lista
        logo_tabla = Table([[logo_img]], colWidths=[140])
        logo_tabla.setStyle(TableStyle([
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        emisor_content.append(logo_tabla)

    emisor_content.append(Paragraph(
        neg_nombre_comercial or neg_razon_social,
        ParagraphStyle("nc", fontName="Helvetica-Bold", fontSize=13, leading=16, textColor=NEGRO)
    ))
    if neg_razon_social and neg_razon_social != neg_nombre_comercial:
        emisor_content.append(Paragraph(neg_razon_social, sn))
    if neg_dir_matriz:
        emisor_content.append(Paragraph(f"<b>Dir. Matriz:</b> {neg_dir_matriz}", sn))
    if neg_dir_sucursal:
        emisor_content.append(Paragraph(f"<b>Dir. Sucursal:</b> {neg_dir_sucursal}", sn))
    if neg_telefono:
        emisor_content.append(Paragraph(f"<b>Teléfono:</b> {neg_telefono}", sn))
    if neg_email:
        emisor_content.append(Paragraph(f"<b>Email:</b> {neg_email}", sn))
    emisor_content.append(Paragraph(f"<b>Obligado A Llevar Contabilidad:</b> {neg_obligado_cont}", sn))
    if neg_contribuyente:
        emisor_content.append(Paragraph(f"<b>Contribuyente Régimen {neg_contribuyente}</b>", sn))

    emisor_tabla = Table([[emisor_content]], colWidths=[col_w * 0.55])
    emisor_tabla.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))

    # Columna derecha — datos del comprobante
    comp_rows = [
        [Paragraph("<b>R.U.C:</b>", sb),
         Paragraph(neg_ruc or "—", ParagraphStyle("ruc_v", fontName="Helvetica-Bold", fontSize=7, leading=9))],
        [Paragraph("FACTURA",
                   ParagraphStyle("fac", fontName="Helvetica-Bold", fontSize=12, leading=14,
                                  alignment=TA_CENTER, textColor=NEGRO)), ""],
        [Paragraph("No.", sb),
         Paragraph(factura.numero_comprobante or "—",
                   ParagraphStyle("mono_no", fontName="Courier", fontSize=7, leading=9))],
        [Paragraph("<b>NÚMERO AUTORIZACIÓN</b>", sb), ""],
        [Paragraph(clave_acceso,
                   ParagraphStyle("ck2", fontName="Courier", fontSize=6, leading=7, wordWrap="CJK")), ""],
        [Paragraph("FECHA Y HORA DE AUTORIZACIÓN", sb),
         Paragraph(f"{factura.fecha_emision.strftime('%d/%m/%Y')} 00:00:00-05:00", sn)],
        [Paragraph("AMBIENTE:", sb), Paragraph(neg_ambiente, sn)],
        [Paragraph("EMISIÓN:", sb),  Paragraph("Normal", sn)],
    ]
    comp_tabla = Table(comp_rows, colWidths=[col_w * 0.20, col_w * 0.25])
    comp_tabla.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3,  BORDE_CLARO),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("SPAN",          (0, 1), (1, 1)),
        ("ALIGN",         (0, 1), (1, 1), "CENTER"),
        ("SPAN",          (0, 3), (1, 3)),
        ("SPAN",          (0, 4), (1, 4)),
    ]))

    ancho_barcode    = col_w * 0.45 - 8
    barcode_flowable = _barcode_clave_acceso(clave_acceso, ancho_barcode)

    clave_box_rows = [
        [Paragraph("<b>CLAVE DE ACCESO</b>",
                   ParagraphStyle("ca_title", fontName="Helvetica-Bold", fontSize=7,
                                  leading=9, alignment=TA_CENTER))],
        [barcode_flowable],
        [Paragraph(
            clave_acceso,
            ParagraphStyle("ck3", fontName="Courier", fontSize=5.5,
                           leading=7, alignment=TA_CENTER, wordWrap="CJK")
        )],
    ]
    clave_box = Table(clave_box_rows, colWidths=[col_w * 0.45])
    clave_box.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
    ]))

    derecha_tabla = Table([[comp_tabla], [clave_box]], colWidths=[col_w * 0.45])
    derecha_tabla.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    cabecera = Table([[emisor_tabla, derecha_tabla]], colWidths=[col_w * 0.55, col_w * 0.45])
    cabecera.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(cabecera)

    # ════════════════════════════════════════════════════
    # SECCIÓN 2 — DATOS DEL RECEPTOR
    # ════════════════════════════════════════════════════
    receptor_data = [
        [
            Paragraph(f"<b>Razón Social / Nombres y Apellidos:</b> {nombre_cliente}", sn),
            Paragraph(f"<b>RUC / CI:</b> {factura.cliente.identificacion or '—'}", sn),
        ],
        [
            Paragraph(f"<b>Fecha Emisión:</b> {factura.fecha_emision.strftime('%d/%m/%Y')}", sn),
            Paragraph("<b>Guía de Remisión:</b> —", sn),
        ],
    ]
    receptor_tabla = Table(receptor_data, colWidths=[col_w * 0.6, col_w * 0.4])
    receptor_tabla.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3,  BORDE_CLARO),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("BACKGROUND",    (0, 0), (-1, -1), colors.white),
    ]))
    elements.append(receptor_tabla)

    # ════════════════════════════════════════════════════
    # SECCIÓN 3 — DETALLE DE PRODUCTOS
    # ════════════════════════════════════════════════════
    det_encab = [
        Paragraph("COD.\nPRINCIPAL",  ParagraphStyle("dh",  fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("COD.\nAUXILIAR",   ParagraphStyle("dh2", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("CANT.",             ParagraphStyle("dh3", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("DESCRIPCIÓN",       ParagraphStyle("dh4", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white)),
        Paragraph("PRECIO\nUNITARIO",  ParagraphStyle("dh5", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("DESCUENTO",         ParagraphStyle("dh6", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("PRECIO\nTOTAL",     ParagraphStyle("dh7", fontName="Helvetica-Bold", fontSize=6.5, leading=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]
    det_filas = [det_encab]
    for idx, d in enumerate(factura.detalles):
        nombre_prod = d.producto.nombre if d.producto else f"Producto {d.id_producto}"
        cod_prod    = str(d.producto.codigo) if d.producto and d.producto.codigo else "—"
        sub_linea   = float(d.cantidad) * float(d.precio_unitario) - float(d.descuento)
        det_filas.append([
            Paragraph(cod_prod, ParagraphStyle(f"mo{idx}", fontName="Courier", fontSize=7, leading=9)),
            Paragraph("—", sn),
            Paragraph(
                str(int(d.cantidad) if float(d.cantidad) == int(d.cantidad) else d.cantidad),
                ParagraphStyle(f"cen{idx}", fontName="Helvetica", fontSize=7, leading=9, alignment=TA_CENTER)
            ),
            Paragraph(f"<b>{nombre_prod}</b>", sb),
            Paragraph(f"${float(d.precio_unitario):.5f}", sr),
            Paragraph("0% $0.00", sr),
            Paragraph(f"${sub_linea:.2f}", sr),
        ])

    det_tabla = Table(
        det_filas,
        colWidths=[col_w*0.11, col_w*0.08, col_w*0.06, col_w*0.33, col_w*0.14, col_w*0.13, col_w*0.15]
    )
    det_style = [
        ("BACKGROUND",    (0, 0), (-1, 0),  AZUL_OSCURO),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
        ("FONTSIZE",      (0, 0), (-1, 0),  6.5),
        ("TOPPADDING",    (0, 0), (-1, 0),  4),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  4),
        ("FONTSIZE",      (0, 1), (-1, -1), 7),
        ("TOPPADDING",    (0, 1), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3,  BORDE_MUY_CLARO),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(1, len(det_filas)):
        bg = colors.white if i % 2 == 1 else GRIS_CLARO
        det_style.append(("BACKGROUND", (0, i), (-1, i), bg))
    det_tabla.setStyle(TableStyle(det_style))
    elements.append(det_tabla)

    # ════════════════════════════════════════════════════
    # SECCIÓN 4 — FORMA DE PAGO + INFO ADICIONAL | TOTALES
    # ════════════════════════════════════════════════════
    pago_th  = ParagraphStyle("pth",  fontName="Helvetica-Bold", fontSize=6.5, leading=8)
    pago_td  = ParagraphStyle("ptd",  fontName="Helvetica",      fontSize=6.5, leading=8)
    pago_tdr = ParagraphStyle("ptdr", fontName="Helvetica",      fontSize=6.5, leading=8, alignment=TA_RIGHT)

    pago_data = [
        [Paragraph("<b>Forma de Pago</b>",
                   ParagraphStyle("phc", fontName="Helvetica-Bold", fontSize=7, alignment=TA_CENTER)),
         "", "", ""],
        [Paragraph("Forma de Pago", pago_th),
         Paragraph("Valor", ParagraphStyle("pvh", fontName="Helvetica-Bold", fontSize=6.5, alignment=TA_RIGHT)),
         Paragraph("Plazo", pago_th),
         Paragraph("Tiempo", pago_th)],
        [Paragraph("SIN UTILIZACION DEL SISTEMA FINANCIERO", pago_td),
         Paragraph(f"${float(factura.total):.2f}", pago_tdr),
         Paragraph("0", pago_td),
         Paragraph("dias", pago_td)],
    ]
    pago_tabla = Table(pago_data, colWidths=[col_w*0.28, col_w*0.09, col_w*0.08, col_w*0.09])
    pago_tabla.setStyle(TableStyle([
        ("SPAN",          (0, 0), (3, 0)),
        ("BACKGROUND",    (0, 0), (3, 0),  GRIS_SECCION),
        ("ALIGN",         (0, 0), (3, 0),  "CENTER"),
        ("BACKGROUND",    (0, 1), (3, 1),  GRIS_SECCION),
        ("FONTNAME",      (0, 1), (3, 1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 1), (3, 1),  6.5),
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3,  BORDE_CLARO),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("FONTSIZE",      (0, 2), (-1, -1), 6.5),
    ]))

    info_rows_data = [
        [Paragraph("<b>Información Adicional</b>",
                   ParagraphStyle("ihc", fontName="Helvetica-Bold", fontSize=7, alignment=TA_CENTER)), ""],
    ]
    if factura.cliente and getattr(factura.cliente, "direccion", None):
        info_rows_data.append([Paragraph("DIRECCIÓN", pago_th), Paragraph(factura.cliente.direccion, pago_td)])
    if neg_telefono:
        info_rows_data.append([Paragraph("TELÉFONO", pago_th), Paragraph(neg_telefono, pago_td)])
    if neg_email:
        info_rows_data.append([Paragraph("EMAIL", pago_th), Paragraph(neg_email, pago_td)])
    if factura.cliente and getattr(factura.cliente, "email", None):
        info_rows_data.append([Paragraph("EMAIL CLIENTE", pago_th), Paragraph(factura.cliente.email, pago_td)])
    if len(info_rows_data) == 1:
        info_rows_data.append([Paragraph("—", pago_td), Paragraph("", pago_td)])

    info_tabla = Table(info_rows_data, colWidths=[col_w*0.18, col_w*0.36])
    info_tabla.setStyle(TableStyle([
        ("SPAN",          (0, 0), (1, 0)),
        ("BACKGROUND",    (0, 0), (1, 0),  GRIS_SECCION),
        ("ALIGN",         (0, 0), (1, 0),  "CENTER"),
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3,  BORDE_CLARO),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("FONTSIZE",      (0, 0), (-1, -1), 6.5),
    ]))

    totales_rows = [
        (f"SUBTOTAL {int(iva_pct)}%",      float(factura.subtotal_iva)),
        ("SUBTOTAL 0%",                    float(factura.subtotal_0)),
        ("SUBTOTAL NO OBJETO IVA",         0.0),
        ("SUBTOTAL EXENTO IVA",            0.0),
        ("SUBTOTAL SIN IMPUESTOS",         float(factura.subtotal_0) + float(factura.subtotal_iva)),
        ("DESCUENTO",                      float(factura.descuento)),
        ("ICE",                            0.0),
        (f"IVA {int(iva_pct)}%",           float(factura.iva)),
        ("PROPINA",                        0.0),
        ("VALOR TOTAL",                    float(factura.total)),
    ]
    tot_data = []
    for i, (label, valor) in enumerate(totales_rows):
        es_total  = label == "VALOR TOTAL"
        lbl_style = ParagraphStyle(
            f"tl_{i}",
            fontName="Helvetica-Bold" if es_total else "Helvetica",
            fontSize=7.5, leading=9
        )
        val_style = ParagraphStyle(
            f"tv_{i}",
            fontName="Courier-Bold" if es_total else "Courier",
            fontSize=7.5, leading=9, alignment=TA_RIGHT
        )
        tot_data.append([Paragraph(label, lbl_style), Paragraph(f"$ {valor:.2f}", val_style)])

    tot_tabla = Table(tot_data, colWidths=[col_w*0.30, col_w*0.15])
    tot_style_list = [
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3,  BORDE_MUY_CLARO),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(len(tot_data)):
        bg = colors.white if i % 2 == 0 else GRIS_CLARO
        tot_style_list.append(("BACKGROUND", (0, i), (-1, i), bg))
    tot_style_list += [
        ("BACKGROUND", (0, -1), (-1, -1), AZUL_TOTAL),
        ("FONTNAME",   (0, -1), (-1, -1), "Helvetica-Bold"),
    ]
    tot_tabla.setStyle(TableStyle(tot_style_list))

    bottom_data = [[[pago_tabla, info_tabla], tot_tabla]]
    bottom_tabla = Table(bottom_data, colWidths=[col_w * 0.55, col_w * 0.45])
    bottom_tabla.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(bottom_tabla)

    # ── Observaciones ─────────────────────────────────────
    if factura.observaciones:
        obs_data = [[Paragraph(f"<b>Observaciones:</b> {factura.observaciones}", sn)]]
        obs_tabla = Table(obs_data, colWidths=[col_w])
        obs_tabla.setStyle(TableStyle([
            ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(obs_tabla)

    # ── Pie de página ─────────────────────────────────────
    from datetime import datetime as _dt
    _now  = _dt.now()
    _hora = _now.hour % 12 or 12
    _ampm = "am" if _now.hour < 12 else "pm"
    now_str = f"{_now.day}/{_now.month}/{_now.year}, {_hora}:{_now.strftime('%M:%S')} {_ampm}"

    estado_actual = factura.estado.value if hasattr(factura.estado, 'value') else factura.estado
    es_borrador   = estado_actual == "borrador"

    pie_data = [[
        Paragraph("Página 1 de 1",
                  ParagraphStyle("pie_l", fontName="Helvetica", fontSize=6.5, textColor=GRIS_TEXTO)),
        Paragraph(
            "⚠  BORRADOR — No válido como comprobante tributario" if es_borrador
            else f"Generado por FacuStock  ·  {now_str}",
            ParagraphStyle(
                "pie_r",
                fontName="Helvetica-Bold" if es_borrador else "Helvetica-Oblique",
                fontSize=6.5,
                textColor=colors.HexColor("#dc2626") if es_borrador else GRIS_TEXTO,
                alignment=TA_RIGHT
            )
        ),
    ]]
    pie_tabla = Table(pie_data, colWidths=[col_w * 0.35, col_w * 0.65])
    pie_tabla.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.75, BORDE),
        ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#f9fafb")),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    elements.append(pie_tabla)

    if es_borrador:
        elements.append(Spacer(1, 0.3*cm))
        elements.append(Paragraph(
            "BORRADOR — No válido como comprobante oficial",
            ParagraphStyle("bor", fontName="Helvetica-Bold", fontSize=9,
                           alignment=TA_CENTER, textColor=colors.HexColor("#dc2626"))
        ))

    doc.build(elements)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=factura_{factura.numero_comprobante}.pdf",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── GET /api/facturas/{id}/xml/ ─────────────────────────
@router.get("/{id_factura}/xml/")
def descargar_xml(
    id_factura: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    factura = (
        db.query(FacturaVenta)
        .options(
            joinedload(FacturaVenta.cliente),
            joinedload(FacturaVenta.detalles).joinedload(DetalleFacturaVenta.producto)
        )
        .filter(
            FacturaVenta.id_factura == id_factura,
            FacturaVenta.id_usuario == current_user.id_usuario
        ).first()
    )
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    def _param(clave, default=""):
        p = db.query(ParametroSistema).filter(
            ParametroSistema.clave      == clave,
            ParametroSistema.id_usuario == current_user.id_usuario
        ).first()
        return p.valor if p else default

    neg_ruc          = _param("NEGOCIO_RUC",              current_user.cedula or "9999999999999")
    neg_razon_social = _param("NEGOCIO_RAZON_SOCIAL",     "NOMBRE DEL NEGOCIO S.A.")
    neg_dir_matriz   = _param("NEGOCIO_DIRECCION_MATRIZ", "")
    neg_ambiente     = _param("NEGOCIO_AMBIENTE",         "Pruebas")
    neg_serie_estab  = _param("NEGOCIO_SERIE_ESTAB",      "001")
    neg_serie_emision = _param("NEGOCIO_SERIE_EMISION",   "001")

    fecha_str    = factura.fecha_emision.strftime("%d%m%Y")
    tipo_doc     = "01"
    ruc_13       = (neg_ruc or "0" * 13).ljust(13, "0")[:13]
    amb_dig      = "2" if "prod" in neg_ambiente.lower() else "1"
    serie        = f"{neg_serie_estab}{neg_serie_emision}"
    num_digits   = "".join(filter(str.isdigit, factura.numero_comprobante or ""))
    secuencial   = num_digits[-9:].zfill(9) if num_digits else "000000001"
    clave_acceso = f"{fecha_str}{tipo_doc}{ruc_13}{amb_dig}{serie}{secuencial}12345678"
    clave_acceso = clave_acceso[:49].ljust(49, "0")

    nombre_cliente = (
        factura.cliente.nombres_apellidos or factura.cliente.razon_social or "CONSUMIDOR FINAL"
    ) if factura.cliente else "CONSUMIDOR FINAL"
    id_cliente = factura.cliente.identificacion if factura.cliente else "9999999999999"

    iva_pct = float(factura.porcentaje_iva) if factura.porcentaje_iva else 0

    root = etree.Element("factura", id="comprobante", version="1.0.0")

    info_tri = etree.SubElement(root, "infoTributaria")
    etree.SubElement(info_tri, "ambiente").text        = amb_dig
    etree.SubElement(info_tri, "tipoEmision").text     = "1"
    etree.SubElement(info_tri, "razonSocial").text     = neg_razon_social
    etree.SubElement(info_tri, "nombreComercial").text = neg_razon_social
    etree.SubElement(info_tri, "ruc").text             = ruc_13
    etree.SubElement(info_tri, "claveAcceso").text     = clave_acceso
    etree.SubElement(info_tri, "codDoc").text          = tipo_doc
    etree.SubElement(info_tri, "estab").text           = neg_serie_estab
    etree.SubElement(info_tri, "ptoEmi").text          = neg_serie_emision
    etree.SubElement(info_tri, "secuencial").text      = secuencial
    etree.SubElement(info_tri, "dirMatriz").text       = neg_dir_matriz or "—"

    info_fac = etree.SubElement(root, "infoFactura")
    etree.SubElement(info_fac, "fechaEmision").text              = factura.fecha_emision.strftime("%d/%m/%Y")
    etree.SubElement(info_fac, "dirEstablecimiento").text        = neg_dir_matriz or "—"
    etree.SubElement(info_fac, "tipoIdentificacionComprador").text = "04"
    etree.SubElement(info_fac, "razonSocialComprador").text      = nombre_cliente
    etree.SubElement(info_fac, "identificacionComprador").text   = id_cliente
    etree.SubElement(info_fac, "totalSinImpuestos").text         = f"{float(factura.subtotal_0) + float(factura.subtotal_iva):.2f}"
    etree.SubElement(info_fac, "totalDescuento").text            = f"{float(factura.descuento):.2f}"

    tot_imp = etree.SubElement(info_fac, "totalConImpuestos")
    if iva_pct > 0:
        di = etree.SubElement(tot_imp, "totalImpuesto")
        etree.SubElement(di, "codigo").text         = "2"
        etree.SubElement(di, "codigoPorcentaje").text = "2"
        etree.SubElement(di, "baseImponible").text  = f"{float(factura.subtotal_iva):.2f}"
        etree.SubElement(di, "tarifa").text         = f"{int(iva_pct)}"
        etree.SubElement(di, "valor").text          = f"{float(factura.iva):.2f}"
    if float(factura.subtotal_0) > 0:
        di0 = etree.SubElement(tot_imp, "totalImpuesto")
        etree.SubElement(di0, "codigo").text          = "2"
        etree.SubElement(di0, "codigoPorcentaje").text = "0"
        etree.SubElement(di0, "baseImponible").text   = f"{float(factura.subtotal_0):.2f}"
        etree.SubElement(di0, "tarifa").text          = "0"
        etree.SubElement(di0, "valor").text           = "0.00"

    etree.SubElement(info_fac, "propina").text       = "0.00"
    etree.SubElement(info_fac, "importeTotal").text  = f"{float(factura.total):.2f}"
    etree.SubElement(info_fac, "moneda").text        = "DOLAR"

    pagos_el = etree.SubElement(info_fac, "pagos")
    pago_el  = etree.SubElement(pagos_el, "pago")
    etree.SubElement(pago_el, "formaPago").text = "01"
    etree.SubElement(pago_el, "total").text     = f"{float(factura.total):.2f}"
    etree.SubElement(pago_el, "plazo").text     = "0"
    etree.SubElement(pago_el, "unidadTiempo").text = "dias"

    detalles_el = etree.SubElement(root, "detalles")
    for d in factura.detalles:
        det_el = etree.SubElement(detalles_el, "detalle")
        nombre_prod = d.producto.nombre if d.producto else f"Producto {d.id_producto}"
        cod_prod    = str(d.producto.codigo) if d.producto and d.producto.codigo else "000"
        sub_linea   = float(d.cantidad) * float(d.precio_unitario) - float(d.descuento)
        etree.SubElement(det_el, "codigoPrincipal").text  = cod_prod
        etree.SubElement(det_el, "descripcion").text      = nombre_prod
        etree.SubElement(det_el, "cantidad").text         = f"{float(d.cantidad):.2f}"
        etree.SubElement(det_el, "precioUnitario").text   = f"{float(d.precio_unitario):.5f}"
        etree.SubElement(det_el, "descuento").text        = f"{float(d.descuento):.2f}"
        etree.SubElement(det_el, "precioTotalSinImpuesto").text = f"{sub_linea:.2f}"
        imp_el = etree.SubElement(det_el, "impuestos")
        imp_d  = etree.SubElement(imp_el, "impuesto")
        etree.SubElement(imp_d, "codigo").text         = "2"
        etree.SubElement(imp_d, "codigoPorcentaje").text = "2" if iva_pct > 0 else "0"
        etree.SubElement(imp_d, "tarifa").text         = f"{int(iva_pct)}"
        etree.SubElement(imp_d, "baseImponible").text  = f"{sub_linea:.2f}"
        etree.SubElement(imp_d, "valor").text          = f"{sub_linea * iva_pct / 100:.2f}"

    xml_bytes = etree.tostring(root, pretty_print=True, xml_declaration=True, encoding="UTF-8")
    return StreamingResponse(
        io.BytesIO(xml_bytes),
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=factura_{factura.numero_comprobante}.xml",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


# ─── POST /api/facturas/ ─────────────────────────────────
@router.post("/", response_model=FacturaResponse, status_code=status.HTTP_201_CREATED)
def crear_factura(
    datos: FacturaCreate,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    cliente = db.query(PersonaComercial).filter(
        PersonaComercial.id_persona_comercial == datos.id_persona_comercial,
        PersonaComercial.id_usuario           == current_user.id_usuario
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    numero_comprobante = _generar_numero_comprobante(db)
    subtotal_0   = Decimal("0.00")
    subtotal_iva = Decimal("0.00")
    total_iva    = Decimal("0.00")
    total_desc   = Decimal("0.00")
    detalles_orm = []

    for item in datos.detalles:
        producto = db.query(Producto).filter(
            Producto.id_producto == item.id_producto,
            Producto.id_usuario  == current_user.id_usuario
        ).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {item.id_producto} no encontrado")

        subtotal, iva, total_linea = _calcular_detalle(item)
        total_desc += Decimal(str(item.descuento))

        if item.porcentaje_iva > 0:
            subtotal_iva += subtotal
            total_iva    += iva
        else:
            subtotal_0 += subtotal

        det = DetalleFacturaVenta(
            id_producto     = item.id_producto,
            cantidad        = item.cantidad,
            precio_unitario = item.precio_unitario,
            descuento       = item.descuento,
            porcentaje_iva  = item.porcentaje_iva,
            subtotal        = subtotal,
            iva             = iva,
            total           = total_linea,
        )
        detalles_orm.append(det)

    total_factura = subtotal_0 + subtotal_iva + total_iva - total_desc

    factura = FacturaVenta(
        id_usuario           = current_user.id_usuario,
        id_persona_comercial = datos.id_persona_comercial,
        numero_comprobante   = numero_comprobante,
        fecha_emision        = datos.fecha_emision or date.today(),
        porcentaje_iva       = datos.porcentaje_iva,
        subtotal_0           = subtotal_0,
        subtotal_iva         = subtotal_iva,
        iva                  = total_iva,
        descuento            = total_desc,
        total                = total_factura,
        estado               = datos.estado or "borrador",
        observaciones        = datos.observaciones,
    )
    db.add(factura)
    db.flush()

    for det in detalles_orm:
        det.id_factura = factura.id_factura
        db.add(det)

    if (datos.estado or "borrador") == "finalizada":
        for item, det in zip(datos.detalles, detalles_orm):
            producto = db.query(Producto).filter(Producto.id_producto == item.id_producto).first()
            if producto:
                if producto.stock < item.cantidad:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Stock insuficiente para '{producto.nombre}'"
                    )
                producto.stock -= item.cantidad

        movimiento = MovimientoInventario(
            id_usuario           = current_user.id_usuario,
            tipo_movimiento      = "VENTA",
            descripcion          = f"Factura {numero_comprobante}",
            id_persona_comercial = datos.id_persona_comercial,
        )
        db.add(movimiento)
        db.flush()
        movimiento.id_factura = factura.id_factura

        for item in datos.detalles:
            producto = db.query(Producto).filter(Producto.id_producto == item.id_producto).first()
            if producto:
                db.add(KardexInventario(
                    id_movimiento        = movimiento.id_movimiento,
                    id_producto          = item.id_producto,
                    cantidad             = item.cantidad,
                    costo_unitario       = producto.costo_promedio,
                    total_costo          = item.cantidad * producto.costo_promedio,
                    saldo_cantidad       = producto.stock,
                    saldo_costo_unitario = producto.costo_promedio,
                    saldo_costo_total    = producto.stock * producto.costo_promedio
                ))

        # Registrar comprobante recibido en el cliente si es usuario del sistema
        try:
            usuario_receptor = db.query(UsuarioSistema).filter(
                UsuarioSistema.cedula == cliente.identificacion
            ).first()

            if usuario_receptor and usuario_receptor.id_usuario != current_user.id_usuario:
                nombre_emisor = f"{current_user.nombres} {current_user.apellidos}".strip()

                proveedor_en_receptor = db.query(PersonaComercial).filter(
                    PersonaComercial.id_usuario     == usuario_receptor.id_usuario,
                    PersonaComercial.identificacion == current_user.cedula,
                    PersonaComercial.flag_proveedor == True
                ).first()

                if not proveedor_en_receptor:
                    proveedor_en_receptor = PersonaComercial(
                        id_usuario          = usuario_receptor.id_usuario,
                        identificacion      = current_user.cedula,
                        tipo_identificacion = "CEDULA",
                        razon_social        = nombre_emisor,
                        nombres_apellidos   = nombre_emisor,
                        flag_proveedor      = True,
                        flag_cliente        = False,
                    )
                    db.add(proveedor_en_receptor)
                    db.flush()

                ya_existe = db.query(ComprobanteRecibido).filter(
                    ComprobanteRecibido.id_usuario         == usuario_receptor.id_usuario,
                    ComprobanteRecibido.numero_comprobante == numero_comprobante,
                ).first()

                if not ya_existe:
                    comp_recibido = ComprobanteRecibido(
                        id_usuario           = usuario_receptor.id_usuario,
                        id_persona_comercial = proveedor_en_receptor.id_persona_comercial,
                        tipo                 = "factura",
                        numero_comprobante   = numero_comprobante,
                        fecha_emision        = datos.fecha_emision,
                        porcentaje_iva       = datos.porcentaje_iva,
                        subtotal_0           = subtotal_0,
                        subtotal_iva         = subtotal_iva,
                        iva                  = total_iva,
                        descuento            = total_desc,
                        total                = total_factura,
                        observaciones        = f"Recibida automáticamente de {nombre_emisor}",
                        estado               = "pendiente",
                    )
                    db.add(comp_recibido)
                    db.flush()

                    for det in detalles_orm:
                        prod = db.query(Producto).filter(Producto.id_producto == det.id_producto).first()
                        db.add(DetalleComprobanteRecibido(
                            id_comprobante  = comp_recibido.id_comprobante,
                            descripcion     = prod.nombre if prod else f"Producto {det.id_producto}",
                            cantidad        = det.cantidad,
                            precio_unitario = det.precio_unitario,
                            porcentaje_iva  = det.porcentaje_iva,
                            subtotal        = det.subtotal,
                            descuento       = det.descuento,
                            iva             = det.iva,
                            total           = det.total,
                        ))
        except Exception:
            pass

    db.commit()
    db.refresh(factura)
    return db.query(FacturaVenta).options(
        joinedload(FacturaVenta.cliente),
        joinedload(FacturaVenta.detalles).joinedload(DetalleFacturaVenta.producto)
    ).filter(FacturaVenta.id_factura == factura.id_factura).first()


# ─── PATCH /api/facturas/{id} ─────────────────────────────
@router.patch("/{id_factura}", response_model=FacturaResponse)
def actualizar_factura(
    id_factura: int,
    datos: FacturaUpdate,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    factura = db.query(FacturaVenta).filter(
        FacturaVenta.id_factura == id_factura,
        FacturaVenta.id_usuario == current_user.id_usuario
    ).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.estado == "anulada":
        raise HTTPException(status_code=400, detail="No se puede modificar una factura anulada")

    if datos.estado:
        if datos.estado == EstadoFacturaEnum.anulada:
            for detalle in factura.detalles:
                producto = db.query(Producto).filter(Producto.id_producto == detalle.id_producto).first()
                if producto:
                    producto.stock += detalle.cantidad
        elif datos.estado == EstadoFacturaEnum.finalizada and factura.estado == "borrador":
            for detalle in factura.detalles:
                producto = db.query(Producto).filter(Producto.id_producto == detalle.id_producto).first()
                if producto:
                    if producto.stock < detalle.cantidad:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Stock insuficiente para '{producto.nombre}'"
                        )
                    producto.stock -= detalle.cantidad
        factura.estado = datos.estado

    if datos.observaciones is not None:
        factura.observaciones = datos.observaciones

    db.commit()
    db.refresh(factura)
    return factura


# ─── PATCH /api/facturas/{id}/anular ─────────────────────
@router.patch("/{id_factura}/anular", response_model=FacturaResponse)
def anular_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(get_current_user)
):
    factura = db.query(FacturaVenta).options(
        joinedload(FacturaVenta.detalles)
    ).filter(
        FacturaVenta.id_factura == id_factura,
        FacturaVenta.id_usuario == current_user.id_usuario
    ).first()

    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    _validar_anulacion_sri(factura)

    estado_actual = factura.estado.value if hasattr(factura.estado, 'value') else factura.estado
    if estado_actual == "finalizada":
        for detalle in factura.detalles:
            producto = db.query(Producto).filter(Producto.id_producto == detalle.id_producto).first()
            if producto:
                producto.stock += detalle.cantidad

        movimiento = MovimientoInventario(
            id_usuario           = current_user.id_usuario,
            tipo_movimiento      = "ANULACION_VENTA",
            descripcion          = f"Anulación - Factura {factura.numero_comprobante}",
            id_persona_comercial = factura.id_persona_comercial,
            id_factura           = factura.id_factura
        )
        db.add(movimiento)
        db.flush()

        for detalle in factura.detalles:
            producto = db.query(Producto).filter(Producto.id_producto == detalle.id_producto).first()
            if producto:
                db.add(KardexInventario(
                    id_movimiento        = movimiento.id_movimiento,
                    id_producto          = detalle.id_producto,
                    cantidad             = detalle.cantidad,
                    costo_unitario       = producto.costo_promedio,
                    total_costo          = detalle.cantidad * producto.costo_promedio,
                    saldo_cantidad       = producto.stock,
                    saldo_costo_unitario = producto.costo_promedio,
                    saldo_costo_total    = producto.stock * producto.costo_promedio
                ))

    factura.estado = "anulada"
    db.commit()
    db.refresh(factura)
    return factura


# ─── DELETE /api/facturas/{id} ────────────────────────────
@router.delete("/{id_factura}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_factura(
    id_factura: int,
    db: Session = Depends(get_db),
    current_user: UsuarioSistema = Depends(require_docente)
):
    factura = db.query(FacturaVenta).filter(
        FacturaVenta.id_factura == id_factura,
        FacturaVenta.id_usuario == current_user.id_usuario
    ).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.estado != "borrador":
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar facturas en borrador")

    for detalle in factura.detalles:
        producto = db.query(Producto).filter(Producto.id_producto == detalle.id_producto).first()
        if producto:
            producto.stock += detalle.cantidad

    db.delete(factura)
    db.commit()
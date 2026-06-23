from pydantic import BaseModel, validator, Field
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
import re


# ─── Enums ────────────────────────────────────────────────
class RolEnum(str, Enum):
    docente    = "docente"
    estudiante = "estudiante"

class EstadoFacturaEnum(str, Enum):
    borrador   = "borrador"
    finalizada = "finalizada"
    anulada    = "anulada"

class TipoIdentificacionEnum(str, Enum):
    RUC       = "RUC"
    CEDULA    = "CEDULA"
    PASAPORTE = "PASAPORTE"

class TipoMovimientoEnum(str, Enum):
    COMPRA             = "COMPRA"
    VENTA              = "VENTA"
    INVENTARIO_INICIAL = "INVENTARIO_INICIAL"
    AJUSTE_ENTRADA     = "AJUSTE_ENTRADA"
    AJUSTE_SALIDA      = "AJUSTE_SALIDA"

class EstadoComprobanteRecibidoEnum(str, Enum):
    pendiente  = "pendiente"
    registrado = "registrado"
    anulado    = "anulado"

class TipoComprobanteEnum(str, Enum):
    factura      = "factura"
    nota_credito = "nota_credito"
    nota_debito  = "nota_debito"
    retencion    = "retencion"
    liquidacion  = "liquidacion"
    guia         = "guia"

class EstadoProformaEnum(str, Enum):
    cotizada           = "cotizada"
    aceptada           = "aceptada"
    rechazada          = "rechazada"
    convertida_factura = "convertida_factura"


# ─── Validadores Ecuador ───────────────────────────────────
def _validar_cedula_ec(cedula: str):
    if not re.fullmatch(r'\d{10}', cedula):
        return False, 'La cédula debe tener exactamente 10 dígitos numéricos'
    provincia = int(cedula[:2])
    if provincia < 1 or provincia > 24:
        return False, 'Los primeros dos dígitos no corresponden a una provincia válida'
    coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = 0
    for i, coef in enumerate(coeficientes):
        val = int(cedula[i]) * coef
        if val >= 10:
            val -= 9
        total += val
    digito_verificador = (10 - (total % 10)) % 10
    if digito_verificador != int(cedula[9]):
        return False, 'La cédula no es válida (dígito verificador incorrecto)'
    return True, ''

def _validar_ruc_ec(ruc: str):
    if not re.fullmatch(r'\d{13}', ruc):
        return False, 'El RUC debe tener exactamente 13 dígitos numéricos'
    if not ruc.endswith('001'):
        return False, 'El RUC debe terminar en 001'
    tercer_digito = int(ruc[2])
    if tercer_digito < 6:
        ok, msg = _validar_cedula_ec(ruc[:10])
        if not ok:
            return False, f'RUC persona natural inválido: {msg}'
    elif tercer_digito == 6:
        pass
    elif tercer_digito == 9:
        pass
    else:
        return False, 'El tercer dígito del RUC no es válido'
    return True, ''


# ─── Auth ─────────────────────────────────────────────────
class LoginRequest(BaseModel):
    usuario:    str
    password:   str
    recordarme: bool = False

class UsuarioResponse(BaseModel):
    id_usuario: int
    cedula:     str
    nombres:    str
    apellidos:  str
    email:      str
    rol:        RolEnum
    curso:      Optional[str] = None
    paralelo:   Optional[str] = None
    estado:     bool

    class Config:
        from_attributes = True

class LoginResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    usuario:      UsuarioResponse
    mensaje:      str


# ─── Personas Comerciales ─────────────────────────────────
class PersonaComercialBase(BaseModel):
    flag_cliente:        bool = False
    flag_proveedor:      bool = False
    tipo_identificacion: TipoIdentificacionEnum
    identificacion:      str
    razon_social:        Optional[str] = None
    nombres_apellidos:   str
    direccion:           Optional[str] = None
    telefono:            Optional[str] = None
    email:               Optional[str] = None

class PersonaComercialResponse(PersonaComercialBase):
    id_persona_comercial: int
    id_usuario:           int
    created_at:           Optional[datetime] = None   # ← Optional por si acaso

    class Config:
        from_attributes = True

class PersonaComercialCreate(PersonaComercialBase):

    @validator('identificacion')
    def validar_identificacion(cls, v, values):
        tipo = values.get('tipo_identificacion')
        v = v.strip()
        if not v:
            raise ValueError('La identificación es obligatoria')
        if tipo == TipoIdentificacionEnum.CEDULA:
            ok, msg = _validar_cedula_ec(v)
            if not ok:
                raise ValueError(msg)
        elif tipo == TipoIdentificacionEnum.RUC:
            ok, msg = _validar_ruc_ec(v)
            if not ok:
                raise ValueError(msg)
        elif tipo == TipoIdentificacionEnum.PASAPORTE:
            if not (5 <= len(v) <= 20):
                raise ValueError('El pasaporte debe tener entre 5 y 20 caracteres')
            if not re.fullmatch(r'[A-Za-z0-9\-]+', v):
                raise ValueError('El pasaporte solo puede contener letras, números y guiones')
        return v

    @validator('telefono')
    def validar_telefono(cls, v):
        if not v or not v.strip():
            return v
        if not re.fullmatch(r'\d{10}', v.strip()):
            raise ValueError('El teléfono debe tener exactamente 10 dígitos numéricos')
        return v.strip()

    @validator('email')
    def validar_email(cls, v):
        if not v or not v.strip():
            return v
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', v.strip()):
            raise ValueError('El formato del email no es válido')
        return v.strip()

    @validator('nombres_apellidos')
    def validar_nombres(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('El nombre es obligatorio')
        if len(v) < 2:
            raise ValueError('El nombre debe tener al menos 2 caracteres')
        return v

class PersonaComercialUpdate(BaseModel):
    flag_cliente:        Optional[bool]                   = None
    flag_proveedor:      Optional[bool]                   = None
    tipo_identificacion: Optional[TipoIdentificacionEnum] = None
    identificacion:      Optional[str]                    = None
    razon_social:        Optional[str]                    = None
    nombres_apellidos:   Optional[str]                    = None
    direccion:           Optional[str]                    = None
    telefono:            Optional[str]                    = None
    email:               Optional[str]                    = None

    @validator('identificacion')
    def validar_identificacion(cls, v, values):
        if not v:
            return v
        v    = v.strip()
        tipo = values.get('tipo_identificacion')
        if tipo == TipoIdentificacionEnum.CEDULA:
            ok, msg = _validar_cedula_ec(v)
            if not ok:
                raise ValueError(msg)
        elif tipo == TipoIdentificacionEnum.RUC:
            ok, msg = _validar_ruc_ec(v)
            if not ok:
                raise ValueError(msg)
        elif tipo == TipoIdentificacionEnum.PASAPORTE:
            if not (5 <= len(v) <= 20):
                raise ValueError('El pasaporte debe tener entre 5 y 20 caracteres')
            if not re.fullmatch(r'[A-Za-z0-9\-]+', v):
                raise ValueError('El pasaporte solo puede contener letras, números y guiones')
        return v

    @validator('telefono')
    def validar_telefono(cls, v):
        if not v or not v.strip():
            return v
        if not re.fullmatch(r'\d{10}', v.strip()):
            raise ValueError('El teléfono debe tener exactamente 10 dígitos numéricos')
        return v.strip()

    @validator('email')
    def validar_email(cls, v):
        if not v or not v.strip():
            return v
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', v.strip()):
            raise ValueError('El formato del email no es válido')
        return v.strip()

    @validator('nombres_apellidos')
    def validar_nombres(cls, v):
        if not v:
            return v
        v = v.strip()
        if len(v) < 2:
            raise ValueError('El nombre debe tener al menos 2 caracteres')
        return v


# ─── Categorías ───────────────────────────────────────────
class CategoriaCreate(BaseModel):
    nombre:      str
    descripcion: Optional[str] = None

class CategoriaResponse(CategoriaCreate):
    id_categoria: int
    id_usuario:   int
    created_at:   Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Productos ────────────────────────────────────────────
class ProductoBase(BaseModel):
    codigo:          str
    nombre:          str
    descripcion:     Optional[str] = None
    precio_unitario: Decimal
    porcentaje_iva:  Decimal       = Decimal("15.00")
    stock_minimo:    int           = 5
    id_categoria:    Optional[int] = None

class ProductoCreate(ProductoBase):
    stock:          int     = 0
    costo_promedio: Decimal = Decimal("0.00")

class ProductoUpdate(BaseModel):
    codigo:          Optional[str]     = None
    nombre:          Optional[str]     = None
    descripcion:     Optional[str]     = None
    precio_unitario: Optional[Decimal] = None
    porcentaje_iva:  Optional[Decimal] = None
    stock:           Optional[int]     = None
    stock_minimo:    Optional[int]     = None
    costo_promedio:  Optional[Decimal] = None
    id_categoria:    Optional[int]     = None

class ProductoResponse(ProductoBase):
    id_producto:    int
    id_usuario:     int
    stock:          int
    costo_promedio: Decimal
    created_at:     Optional[datetime] = None
    categoria:      Optional[CategoriaResponse] = None

    class Config:
        from_attributes = True


# ─── Detalle de Factura ───────────────────────────────────
class DetalleFacturaCreate(BaseModel):
    id_producto:     int
    cantidad:        int
    precio_unitario: Decimal
    porcentaje_iva:  Decimal
    descuento:       Decimal = Decimal("0.00")

    @validator("cantidad")
    def cantidad_positiva(cls, v):
        if v <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
        return v

class DetalleFacturaResponse(BaseModel):
    id_detalle:      int
    id_producto:     int
    cantidad:        int
    precio_unitario: Decimal
    porcentaje_iva:  Decimal
    subtotal:        Decimal
    descuento:       Decimal
    iva:             Decimal
    total:           Decimal
    producto:        Optional[ProductoResponse] = None

    class Config:
        from_attributes = True


# ─── Facturas ─────────────────────────────────────────────
class FacturaCreate(BaseModel):
    id_persona_comercial: int
    fecha_emision:        date
    porcentaje_iva:       Decimal           = Decimal("15.00")
    observaciones:        Optional[str]     = None
    estado:               Optional[str]     = "borrador"
    detalles:             List[DetalleFacturaCreate]

    @validator("detalles")
    def detalles_no_vacios(cls, v):
        if not v:
            raise ValueError("La factura debe tener al menos un producto")
        return v

    @validator("estado")
    def estado_valido(cls, v):
        if v and v not in ("borrador", "finalizada"):
            raise ValueError("Estado debe ser 'borrador' o 'finalizada'")
        return v or "borrador"

class FacturaUpdate(BaseModel):
    estado:        Optional[EstadoFacturaEnum] = None
    observaciones: Optional[str]              = None

class FacturaResponse(BaseModel):
    id_factura:           int
    id_usuario:           int
    id_persona_comercial: int
    numero_comprobante:   str
    fecha_emision:        date
    subtotal_0:           Decimal
    subtotal_iva:         Decimal
    porcentaje_iva:       Decimal
    iva:                  Decimal
    descuento:            Decimal
    total:                Decimal
    estado:               EstadoFacturaEnum
    observaciones:        Optional[str]     = None
    created_at:           Optional[datetime]= None
    cliente:              Optional[PersonaComercialResponse] = None
    detalles:             List[DetalleFacturaResponse]       = []

    class Config:
        from_attributes = True

class FacturaListResponse(BaseModel):
    id_factura:           int
    numero_comprobante:   str
    fecha_emision:        date
    subtotal_0:           Optional[Decimal] = Decimal("0.00")
    subtotal_iva:         Optional[Decimal] = Decimal("0.00")
    iva:                  Optional[Decimal] = Decimal("0.00")
    total:                Decimal
    estado:               EstadoFacturaEnum
    created_at:           Optional[datetime] = None
    cliente:              Optional[PersonaComercialResponse] = None

    class Config:
        from_attributes = True


# ─── Dashboard Stats ──────────────────────────────────────
class StatsResponse(BaseModel):
    facturado_mes:            Decimal
    facturado_mes_anterior:   Decimal
    variacion_facturado:      float
    comprobantes_pagados:     int
    comprobantes_pagados_mes: int
    ingresos_totales:         Decimal
    ingresos_mes_anterior:    Decimal
    variacion_ingresos:       float

class BarChartItem(BaseModel):
    mes:   str
    total: Decimal

class DashboardResponse(BaseModel):
    stats:              StatsResponse
    facturas_recientes: List[FacturaListResponse]
    ingresos_por_mes:   List[BarChartItem]


# ─── Paginación ───────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items:         list
    total:         int
    pagina:        int
    por_pagina:    int
    total_paginas: int


# ─── Comprobantes Recibidos ───────────────────────────────
class DetalleComprobanteCreate(BaseModel):
    descripcion:     str
    cantidad:        Decimal
    precio_unitario: Decimal
    porcentaje_iva:  Decimal
    descuento:       Decimal = Decimal("0.00")

    @validator("cantidad")
    def cantidad_positiva(cls, v):
        if v <= 0:
            raise ValueError("La cantidad debe ser mayor a 0")
        return v

class DetalleComprobanteResponse(BaseModel):
    id_detalle:      int
    descripcion:     str
    cantidad:        Decimal
    precio_unitario: Decimal
    porcentaje_iva:  Decimal
    subtotal:        Decimal
    descuento:       Optional[Decimal] = Decimal("0.00")
    iva:             Optional[Decimal] = Decimal("0.00")
    total:           Decimal

    class Config:
        from_attributes = True

class ComprobanteRecibidoCreate(BaseModel):
    id_persona_comercial: int
    tipo:                 TipoComprobanteEnum = TipoComprobanteEnum.factura
    numero_comprobante:   str
    clave_acceso:         Optional[str]       = None
    fecha_emision:        date
    porcentaje_iva:       Decimal             = Decimal("15.00")
    observaciones:        Optional[str]       = None
    detalles:             List[DetalleComprobanteCreate] = []

    @validator("numero_comprobante")
    def validar_numero(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("El número de comprobante es obligatorio")
        return v

    @validator("clave_acceso")
    def validar_clave(cls, v):
        if not v or not v.strip():
            return None
        v = v.strip()
        if not re.fullmatch(r'\d{49}', v):
            raise ValueError("La clave de acceso debe tener exactamente 49 dígitos numéricos")
        return v

class ComprobanteRecibidoUpdate(BaseModel):
    estado:          Optional[EstadoComprobanteRecibidoEnum] = None
    observaciones:   Optional[str]                          = None
    fecha_recepcion: Optional[date]                         = None
    clave_acceso:    Optional[str]                          = None

    @validator("clave_acceso")
    def validar_clave(cls, v):
        if not v or not v.strip():
            return None
        v = v.strip()
        if not re.fullmatch(r'\d{49}', v):
            raise ValueError("La clave de acceso debe tener exactamente 49 dígitos numéricos")
        return v

class ComprobanteRecibidoResponse(BaseModel):
    id_comprobante:       int
    id_usuario:           int
    id_persona_comercial: int
    tipo:                 TipoComprobanteEnum
    numero_comprobante:   str
    clave_acceso:         Optional[str]  = None
    fecha_emision:        date
    fecha_recepcion:      Optional[date] = None
    subtotal_0:           Optional[Decimal] = Decimal("0.00")
    subtotal_iva:         Optional[Decimal] = Decimal("0.00")
    porcentaje_iva:       Optional[Decimal] = Decimal("15.00")
    iva:                  Optional[Decimal] = Decimal("0.00")   # ← Optional
    descuento:            Optional[Decimal] = Decimal("0.00")
    total:                Decimal
    estado:               EstadoComprobanteRecibidoEnum
    observaciones:        Optional[str]     = None
    created_at:           Optional[datetime]= None              # ← Optional
    proveedor:            Optional[PersonaComercialResponse] = None
    detalles:             List[DetalleComprobanteResponse]   = []

    class Config:
        from_attributes = True

# ─── ↓↓↓  CORRECCIÓN PRINCIPAL  ↓↓↓ ─────────────────────
class ComprobanteRecibidoListResponse(BaseModel):
    id_comprobante:       int
    tipo:                 TipoComprobanteEnum
    numero_comprobante:   str
    fecha_emision:        date
    fecha_recepcion:      Optional[date]    = None
    subtotal_0:           Optional[Decimal] = Decimal("0.00")
    subtotal_iva:         Optional[Decimal] = Decimal("0.00")
    porcentaje_iva:       Optional[Decimal] = Decimal("15.00")
    iva:                  Optional[Decimal] = Decimal("0.00")   # ← era Decimal (sin Optional) → ERROR 500
    descuento:            Optional[Decimal] = Decimal("0.00")
    total:                Decimal
    estado:               EstadoComprobanteRecibidoEnum
    observaciones:        Optional[str]     = None
    created_at:           Optional[datetime]= None              # ← era datetime (sin Optional) → ERROR 500
    proveedor:            Optional[PersonaComercialResponse] = None

    class Config:
        from_attributes = True


# ─── Proformas ────────────────────────────────────────────
class DetalleProformaCreate(DetalleFacturaCreate):
    pass

class DetalleProformaResponse(BaseModel):
    id_detalle:      int
    id_proforma:     int
    id_producto:     int
    cantidad:        int
    precio_unitario: Decimal
    porcentaje_iva:  Decimal
    subtotal:        Decimal
    descuento:       Optional[Decimal] = Decimal("0.00")
    iva:             Optional[Decimal] = Decimal("0.00")
    total:           Decimal
    producto:        Optional[ProductoResponse] = None

    class Config:
        from_attributes = True

class ProformaCreate(BaseModel):
    id_persona_comercial: int
    fecha_emision:        date
    fecha_validez:        Optional[date]           = None
    porcentaje_iva:       Decimal                  = Decimal("15.00")
    observaciones:        Optional[str]            = None
    detalles:             List[DetalleFacturaCreate]

    @validator("detalles")
    def detalles_no_vacios(cls, v):
        if not v:
            raise ValueError("La proforma debe tener al menos un producto")
        return v

class ProformaUpdate(BaseModel):
    estado:        Optional[EstadoProformaEnum] = None
    observaciones: Optional[str]               = None
    fecha_validez: Optional[date]              = None

class ProformaResponse(BaseModel):
    id_proforma:          int
    id_usuario:           int
    id_persona_comercial: int
    numero_comprobante:   str
    fecha_emision:        date
    fecha_validez:        Optional[date]    = None
    subtotal_0:           Optional[Decimal] = Decimal("0.00")
    subtotal_iva:         Optional[Decimal] = Decimal("0.00")
    porcentaje_iva:       Optional[Decimal] = Decimal("15.00")
    iva:                  Optional[Decimal] = Decimal("0.00")
    descuento:            Optional[Decimal] = Decimal("0.00")
    total:                Decimal
    estado:               EstadoProformaEnum
    observaciones:        Optional[str]     = None
    created_at:           Optional[datetime]= None
    cliente:              Optional[PersonaComercialResponse]  = None
    detalles:             List[DetalleProformaResponse]       = []

    class Config:
        from_attributes = True

class ProformaListResponse(BaseModel):
    id_proforma:          int
    numero_comprobante:   str
    fecha_emision:        date
    fecha_validez:        Optional[date]    = None
    total:                Decimal
    estado:               EstadoProformaEnum
    created_at:           Optional[datetime]= None
    cliente:              Optional[PersonaComercialResponse] = None

    class Config:
        from_attributes = True
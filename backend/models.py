from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, Boolean,
    ForeignKey, Text, DECIMAL, Numeric, Date, SmallInteger
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


# ─── Enums ────────────────────────────────────────────────
class RolEnum(str, enum.Enum):
    docente    = "docente"
    estudiante = "estudiante"

class EstadoFacturaEnum(str, enum.Enum):
    borrador   = "borrador"
    finalizada = "finalizada"
    anulada    = "anulada"

class TipoIdentificacionEnum(str, enum.Enum):
    RUC       = "RUC"
    CEDULA    = "CEDULA"
    PASAPORTE = "PASAPORTE"

class TipoMovimientoEnum(str, enum.Enum):
    COMPRA             = "COMPRA"
    VENTA              = "VENTA"
    INVENTARIO_INICIAL = "INVENTARIO_INICIAL"
    AJUSTE_ENTRADA     = "AJUSTE_ENTRADA"
    AJUSTE_SALIDA      = "AJUSTE_SALIDA"

class EstadoComprobanteRecibidoEnum(str, enum.Enum):
    pendiente  = "pendiente"
    registrado = "registrado"
    anulado    = "anulado"

class TipoComprobanteEnum(str, enum.Enum):
    factura      = "factura"
    nota_credito = "nota_credito"
    nota_debito  = "nota_debito"
    retencion    = "retencion"
    liquidacion  = "liquidacion"
    guia         = "guia"

class MotivoNotaCreditoEnum(str, enum.Enum):
    devolucion_total   = "devolucion_total"
    devolucion_parcial = "devolucion_parcial"
    descuento          = "descuento"
    error_facturacion  = "error_facturacion"
    anulacion          = "anulacion"

class EstadoNotaCreditoEnum(str, enum.Enum):
    emitida = "emitida"
    anulada = "anulada"

class MotivoNotaDebitoEnum(str, enum.Enum):
    interes_mora       = "interes_mora"
    ajuste_precio      = "ajuste_precio"
    gastos_adicionales = "gastos_adicionales"
    error_facturacion  = "error_facturacion"
    otros              = "otros"

class EstadoNotaDebitoEnum(str, enum.Enum):
    emitida = "emitida"
    anulada = "anulada"


class EstadoGuiaEnum(str, enum.Enum):
    emitida = "emitida"
    anulada = "anulada"

class TipoIdentificacionTransportistaEnum(str, enum.Enum):
    RUC       = "RUC"
    CEDULA    = "CEDULA"
    PASAPORTE = "PASAPORTE"

class TipoRetencionEnum(str, enum.Enum):
    renta = "renta"
    iva   = "iva"

class EstadoRetencionEnum(str, enum.Enum):
    emitida = "emitida"
    anulada = "anulada"

class EstadoProformaEnum(str, enum.Enum):
    cotizada          = "cotizada"
    aceptada          = "aceptada"
    rechazada         = "rechazada"
    convertida_factura = "convertida_factura"


# ─── Usuarios ─────────────────────────────────────────────
class UsuarioSistema(Base):
    __tablename__ = "usuarios_sistema"

    id_usuario = Column(Integer, primary_key=True, index=True)
    cedula     = Column(String(10),  unique=True, nullable=False, index=True)
    nombres    = Column(String(100), nullable=False)
    apellidos  = Column(String(100), nullable=False)
    email      = Column(String(150), unique=True, nullable=False, index=True)
    password   = Column(String(255), nullable=False)
    rol        = Column(Enum(RolEnum), nullable=False)
    curso      = Column(String(50),  nullable=True)
    paralelo   = Column(String(10),  nullable=True)
    estado     = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    foto_perfil = Column(String(255), nullable=True)

    sesiones               = relationship("SesionUsuario",        back_populates="usuario", cascade="all, delete")
    facturas               = relationship("FacturaVenta",         back_populates="usuario")
    personas_comerciales   = relationship("PersonaComercial",     back_populates="usuario", cascade="all, delete")
    productos              = relationship("Producto",             back_populates="usuario", cascade="all, delete")
    categorias             = relationship("CategoriaProducto",    back_populates="usuario", cascade="all, delete")
    movimientos            = relationship("MovimientoInventario", back_populates="usuario")
    parametros             = relationship("ParametroSistema",     back_populates="usuario", cascade="all, delete")
    comprobantes_recibidos = relationship("ComprobanteRecibido",  back_populates="usuario", cascade="all, delete")
    notas_credito          = relationship("NotaCredito",          back_populates="usuario")
    notas_debito           = relationship("NotaDebito",           back_populates="usuario")
    retenciones            = relationship("ComprobanteRetencion",  back_populates="usuario")
    guias_remision         = relationship("GuiaRemision",           back_populates="usuario")
    proformas               = relationship("ProformaVenta",         back_populates="usuario")


class SesionUsuario(Base):
    __tablename__ = "sesiones_usuario"

    id_sesion  = Column(Integer, primary_key=True, index=True)
    id_usuario = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    token      = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=func.now())

    usuario = relationship("UsuarioSistema", back_populates="sesiones")


# ─── Personas Comerciales (Clientes / Proveedores) ────────
class PersonaComercial(Base):
    __tablename__ = "personas_comerciales"

    id_persona_comercial = Column(Integer, primary_key=True, index=True)
    id_usuario           = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    flag_cliente         = Column(Boolean, default=False)
    flag_proveedor       = Column(Boolean, default=False)
    tipo_identificacion  = Column(Enum(TipoIdentificacionEnum), nullable=False)
    identificacion       = Column(String(20), nullable=False)
    razon_social         = Column(String(200), nullable=True)
    nombres_apellidos    = Column(String(200), nullable=False)
    direccion            = Column(Text, nullable=True)
    telefono             = Column(String(15), nullable=True)
    email                = Column(String(150), nullable=True)
    created_at           = Column(DateTime, default=func.now())

    usuario                = relationship("UsuarioSistema",       back_populates="personas_comerciales")
    facturas               = relationship("FacturaVenta",         back_populates="cliente")
    movimientos            = relationship("MovimientoInventario", back_populates="persona_comercial")
    comprobantes_recibidos = relationship("ComprobanteRecibido",  back_populates="proveedor")
    notas_credito          = relationship("NotaCredito",          back_populates="cliente")
    notas_debito           = relationship("NotaDebito",           back_populates="cliente")
    retenciones            = relationship("ComprobanteRetencion",  back_populates="proveedor")
    guias_remision         = relationship("GuiaRemision",           back_populates="destinatario")
    proformas               = relationship("ProformaVenta",         back_populates="cliente")


# ─── Categorías de Productos ──────────────────────────────
class CategoriaProducto(Base):
    __tablename__ = "categorias_productos"

    id_categoria = Column(Integer, primary_key=True, index=True)
    id_usuario   = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    nombre       = Column(String(100), nullable=False)
    descripcion  = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=func.now())

    usuario   = relationship("UsuarioSistema",  back_populates="categorias")
    productos = relationship("Producto",        back_populates="categoria")


# ─── Productos ────────────────────────────────────────────
class Producto(Base):
    __tablename__ = "productos"

    id_producto     = Column(Integer, primary_key=True, index=True)
    id_usuario      = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    id_categoria    = Column(Integer, ForeignKey("categorias_productos.id_categoria", ondelete="SET NULL"), nullable=True)
    codigo          = Column(String(30), nullable=False)
    nombre          = Column(String(200), nullable=False)
    descripcion     = Column(Text, nullable=True)
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    porcentaje_iva  = Column(DECIMAL(5, 2), default=15.00)
    stock           = Column(Integer, default=0)
    stock_minimo    = Column(Integer, default=5)
    costo_promedio  = Column(DECIMAL(10, 2), default=0.00)
    activo          = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=func.now())

    usuario   = relationship("UsuarioSistema",      back_populates="productos")
    categoria = relationship("CategoriaProducto",   back_populates="productos")
    detalles  = relationship("DetalleFacturaVenta", back_populates="producto")
    detalles_proforma = relationship("DetalleProformaVenta", back_populates="producto")
    kardex    = relationship("KardexInventario",    back_populates="producto", cascade="all, delete")


# ─── Facturas ─────────────────────────────────────────────
class FacturaVenta(Base):
    __tablename__ = "facturas_venta"

    id_factura           = Column(Integer, primary_key=True, index=True)
    id_usuario           = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    id_persona_comercial = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial"), nullable=False)
    numero_comprobante   = Column(String(30), unique=True, nullable=False)
    fecha_emision        = Column(Date, nullable=False)
    subtotal_0           = Column(DECIMAL(10, 2), default=0.00)
    subtotal_iva         = Column(DECIMAL(10, 2), default=0.00)
    porcentaje_iva       = Column(DECIMAL(5, 2), nullable=False)
    iva                  = Column(DECIMAL(10, 2), default=0.00)
    descuento            = Column(DECIMAL(10, 2), default=0.00)
    total                = Column(DECIMAL(10, 2), nullable=False)
    estado               = Column(Enum(EstadoFacturaEnum), default=EstadoFacturaEnum.borrador)
    observaciones        = Column(Text, nullable=True)
    created_at           = Column(DateTime, default=func.now())

    usuario       = relationship("UsuarioSistema",       back_populates="facturas")
    cliente       = relationship("PersonaComercial",     back_populates="facturas")
    detalles      = relationship("DetalleFacturaVenta",  back_populates="factura", cascade="all, delete")
    movimientos   = relationship("MovimientoInventario", back_populates="factura")
    notas_credito  = relationship("NotaCredito",          back_populates="factura")
    notas_debito   = relationship("NotaDebito",           back_populates="factura")
    guias_remision = relationship("GuiaRemision",         back_populates="factura")


# ─── Detalle de Facturas ──────────────────────────────────
class DetalleFacturaVenta(Base):
    __tablename__ = "detalle_factura_venta"

    id_detalle      = Column(Integer, primary_key=True, index=True)
    id_factura      = Column(Integer, ForeignKey("facturas_venta.id_factura", ondelete="CASCADE"), nullable=False)
    id_producto     = Column(Integer, ForeignKey("productos.id_producto"), nullable=False)
    cantidad        = Column(Integer, nullable=False)
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    porcentaje_iva  = Column(DECIMAL(5, 2), nullable=False)
    subtotal        = Column(DECIMAL(10, 2), nullable=False)
    descuento       = Column(DECIMAL(10, 2), default=0.00)
    iva             = Column(DECIMAL(10, 2), default=0.00)
    total           = Column(DECIMAL(10, 2), nullable=False)

    factura  = relationship("FacturaVenta", back_populates="detalles")
    producto = relationship("Producto",     back_populates="detalles")


# ─── Movimientos de Inventario ────────────────────────────
class MovimientoInventario(Base):
    __tablename__ = "movimientos_inventario"

    id_movimiento        = Column(Integer, primary_key=True, index=True)
    id_usuario           = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    tipo_movimiento      = Column(Enum(TipoMovimientoEnum), nullable=False)
    fecha_movimiento     = Column(DateTime, default=func.now())
    descripcion          = Column(Text, nullable=True)
    id_persona_comercial = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial", ondelete="SET NULL"), nullable=True)
    id_factura           = Column(Integer, ForeignKey("facturas_venta.id_factura", ondelete="SET NULL"), nullable=True)

    usuario           = relationship("UsuarioSistema",   back_populates="movimientos")
    persona_comercial = relationship("PersonaComercial", back_populates="movimientos")
    factura           = relationship("FacturaVenta",     back_populates="movimientos")
    kardex            = relationship("KardexInventario", back_populates="movimiento", cascade="all, delete")


# ─── Kardex ───────────────────────────────────────────────
class KardexInventario(Base):
    __tablename__ = "kardex_inventario"

    id_kardex            = Column(Integer, primary_key=True, index=True)
    id_movimiento        = Column(Integer, ForeignKey("movimientos_inventario.id_movimiento", ondelete="CASCADE"), nullable=False)
    id_producto          = Column(Integer, ForeignKey("productos.id_producto", ondelete="CASCADE"), nullable=False)
    cantidad             = Column(Integer, nullable=False)
    costo_unitario       = Column(DECIMAL(10, 2), nullable=False)
    total_costo          = Column(DECIMAL(10, 2), nullable=False)
    saldo_cantidad       = Column(Integer, nullable=False)
    saldo_costo_unitario = Column(DECIMAL(10, 2), nullable=False)
    saldo_costo_total    = Column(DECIMAL(10, 2), nullable=False)

    movimiento = relationship("MovimientoInventario", back_populates="kardex")
    producto   = relationship("Producto",            back_populates="kardex")


# ─── Parámetros del Sistema ───────────────────────────────
class ParametroSistema(Base):
    __tablename__ = "parametros_sistema"

    id_parametro = Column(Integer, primary_key=True, index=True)
    id_usuario   = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=True, default=None)
    clave        = Column(String(100), nullable=False)
    valor        = Column(Text, nullable=False)
    descripcion  = Column(Text, nullable=True)
    updated_at   = Column(DateTime, default=func.now(), onupdate=func.now())

    usuario = relationship("UsuarioSistema", back_populates="parametros")


# ─── Comprobantes Recibidos ───────────────────────────────
class ComprobanteRecibido(Base):
    __tablename__ = "comprobantes_recibidos"

    id_comprobante       = Column(Integer, primary_key=True, index=True)
    id_usuario           = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    id_persona_comercial = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial", ondelete="RESTRICT"), nullable=False)
    tipo                 = Column(Enum(TipoComprobanteEnum), nullable=False, default=TipoComprobanteEnum.factura)
    numero_comprobante   = Column(String(50), nullable=False)
    clave_acceso         = Column(String(49), nullable=True)
    fecha_emision        = Column(Date, nullable=False)
    fecha_recepcion      = Column(Date, nullable=True)
    subtotal_0           = Column(DECIMAL(10, 2), default=0.00)
    subtotal_iva         = Column(DECIMAL(10, 2), default=0.00)
    porcentaje_iva       = Column(DECIMAL(5, 2),  default=15.00)
    iva                  = Column(DECIMAL(10, 2), default=0.00)
    descuento            = Column(DECIMAL(10, 2), default=0.00)
    total                = Column(DECIMAL(10, 2), nullable=False)
    estado               = Column(Enum(EstadoComprobanteRecibidoEnum), default=EstadoComprobanteRecibidoEnum.pendiente)
    observaciones        = Column(Text, nullable=True)
    created_at           = Column(DateTime, default=func.now())

    usuario   = relationship("UsuarioSistema",  back_populates="comprobantes_recibidos")
    proveedor = relationship("PersonaComercial", back_populates="comprobantes_recibidos")
    detalles    = relationship("DetalleComprobanteRecibido", back_populates="comprobante", cascade="all, delete")
    retenciones = relationship("ComprobanteRetencion",          back_populates="comprobante_origen")


class DetalleComprobanteRecibido(Base):
    __tablename__ = "detalle_comprobante_recibido"

    id_detalle      = Column(Integer, primary_key=True, index=True)
    id_comprobante  = Column(Integer, ForeignKey("comprobantes_recibidos.id_comprobante", ondelete="CASCADE"), nullable=False)
    descripcion     = Column(String(300), nullable=False)
    cantidad        = Column(DECIMAL(10, 3), nullable=False)
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    porcentaje_iva  = Column(DECIMAL(5, 2),  nullable=False)
    subtotal        = Column(DECIMAL(10, 2), nullable=False)
    descuento       = Column(DECIMAL(10, 2), default=0.00)
    iva             = Column(DECIMAL(10, 2), default=0.00)
    total           = Column(DECIMAL(10, 2), nullable=False)

    comprobante = relationship("ComprobanteRecibido", back_populates="detalles")


# ─── Notas de Crédito ─────────────────────────────────────
class NotaCredito(Base):
    __tablename__ = "notas_credito"

    id_nota_credito      = Column(Integer, primary_key=True, index=True)
    id_usuario           = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    id_factura           = Column(Integer, ForeignKey("facturas_venta.id_factura"), nullable=False)
    id_persona_comercial = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial"), nullable=False)
    numero_comprobante   = Column(String(30), unique=True, nullable=False)
    fecha_emision        = Column(Date, nullable=False)
    motivo               = Column(Enum(MotivoNotaCreditoEnum), nullable=False)
    subtotal_0           = Column(DECIMAL(10, 2), default=0.00)
    subtotal_iva         = Column(DECIMAL(10, 2), default=0.00)
    porcentaje_iva       = Column(DECIMAL(5, 2),  default=15.00)
    iva                  = Column(DECIMAL(10, 2), default=0.00)
    total                = Column(DECIMAL(10, 2), nullable=False)
    estado               = Column(Enum(EstadoNotaCreditoEnum), default=EstadoNotaCreditoEnum.emitida)
    observaciones        = Column(Text, nullable=True)
    created_at           = Column(DateTime, default=func.now())

    usuario  = relationship("UsuarioSistema",    back_populates="notas_credito")
    factura  = relationship("FacturaVenta",      back_populates="notas_credito")
    cliente  = relationship("PersonaComercial",  back_populates="notas_credito")
    detalles = relationship("DetalleNotaCredito", back_populates="nota_credito", cascade="all, delete")


class DetalleNotaCredito(Base):
    __tablename__ = "detalle_nota_credito"

    id_detalle      = Column(Integer, primary_key=True, index=True)
    id_nota_credito = Column(Integer, ForeignKey("notas_credito.id_nota_credito", ondelete="CASCADE"), nullable=False)
    id_producto     = Column(Integer, ForeignKey("productos.id_producto"), nullable=False)
    descripcion     = Column(String(255), nullable=False)
    cantidad        = Column(Integer, nullable=False)
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    porcentaje_iva  = Column(DECIMAL(5, 2),  nullable=False)
    subtotal        = Column(DECIMAL(10, 2), nullable=False)
    iva             = Column(DECIMAL(10, 2), default=0.00)
    total           = Column(DECIMAL(10, 2), nullable=False)

    nota_credito = relationship("NotaCredito", back_populates="detalles")
    producto     = relationship("Producto")


# ─── Notas de Débito ──────────────────────────────────────
class NotaDebito(Base):
    __tablename__ = "notas_debito"

    id_nota_debito       = Column(Integer, primary_key=True, index=True)
    id_usuario           = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    id_factura           = Column(Integer, ForeignKey("facturas_venta.id_factura"), nullable=False)
    id_persona_comercial = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial"), nullable=False)
    numero_comprobante   = Column(String(30), unique=True, nullable=False)
    fecha_emision        = Column(Date, nullable=False)
    motivo               = Column(Enum(MotivoNotaDebitoEnum), nullable=False)
    subtotal_0           = Column(DECIMAL(10, 2), default=0.00)
    subtotal_iva         = Column(DECIMAL(10, 2), default=0.00)
    porcentaje_iva       = Column(DECIMAL(5, 2),  default=15.00)
    iva                  = Column(DECIMAL(10, 2), default=0.00)
    total                = Column(DECIMAL(10, 2), nullable=False)
    estado               = Column(Enum(EstadoNotaDebitoEnum), default=EstadoNotaDebitoEnum.emitida)
    observaciones        = Column(Text, nullable=True)
    created_at           = Column(DateTime, default=func.now())

    usuario  = relationship("UsuarioSistema",   back_populates="notas_debito")
    factura  = relationship("FacturaVenta",     back_populates="notas_debito")
    cliente  = relationship("PersonaComercial", back_populates="notas_debito")
    detalles = relationship("DetalleNotaDebito", back_populates="nota_debito", cascade="all, delete")


class DetalleNotaDebito(Base):
    __tablename__ = "detalle_nota_debito"

    id_detalle     = Column(Integer, primary_key=True, index=True)
    id_nota_debito = Column(Integer, ForeignKey("notas_debito.id_nota_debito", ondelete="CASCADE"), nullable=False)
    descripcion    = Column(String(255), nullable=False)
    valor          = Column(DECIMAL(10, 2), nullable=False)
    porcentaje_iva = Column(DECIMAL(5, 2),  nullable=False)
    iva            = Column(DECIMAL(10, 2), default=0.00)
    total          = Column(DECIMAL(10, 2), nullable=False)

    nota_debito = relationship("NotaDebito", back_populates="detalles")

# ─── Comprobantes de Retención ────────────────────────────
class ComprobanteRetencion(Base):
    __tablename__ = "comprobantes_retencion"

    id_retencion            = Column(Integer, primary_key=True, index=True)
    id_usuario              = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    id_persona_comercial    = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial"), nullable=False)
    id_comprobante_origen   = Column(Integer, ForeignKey("comprobantes_recibidos.id_comprobante"), nullable=True)
    numero_comprobante      = Column(String(30), unique=True, nullable=False)
    numero_autorizacion     = Column(String(49), nullable=True)
    fecha_emision           = Column(Date, nullable=False)
    ejercicio_fiscal        = Column(String(4), nullable=False)
    # Totales
    total_retenido_renta    = Column(DECIMAL(10, 2), default=0.00)
    total_retenido_iva      = Column(DECIMAL(10, 2), default=0.00)
    total_retenido          = Column(DECIMAL(10, 2), nullable=False)
    estado                  = Column(Enum(EstadoRetencionEnum), default=EstadoRetencionEnum.emitida)
    observaciones           = Column(Text, nullable=True)
    created_at              = Column(DateTime, default=func.now())

    usuario             = relationship("UsuarioSistema",       back_populates="retenciones")
    proveedor           = relationship("PersonaComercial",     back_populates="retenciones")
    comprobante_origen  = relationship("ComprobanteRecibido",  back_populates="retenciones")
    detalles            = relationship("DetalleRetencion",     back_populates="retencion", cascade="all, delete")


class DetalleRetencion(Base):
    __tablename__ = "detalle_retencion"

    id_detalle       = Column(Integer, primary_key=True, index=True)
    id_retencion     = Column(Integer, ForeignKey("comprobantes_retencion.id_retencion", ondelete="CASCADE"), nullable=False)
    tipo             = Column(Enum(TipoRetencionEnum), nullable=False)   # renta | iva
    codigo_sri       = Column(String(10), nullable=False)                # ej: "303", "721"
    descripcion      = Column(String(255), nullable=False)
    base_imponible   = Column(DECIMAL(10, 2), nullable=False)
    porcentaje       = Column(DECIMAL(5, 2), nullable=False)             # 1, 2, 8, 10, 30, 70, 100...
    valor_retenido   = Column(DECIMAL(10, 2), nullable=False)

    retencion = relationship("ComprobanteRetencion", back_populates="detalles")

# ─── Guía de Remisión ─────────────────────────────────────
class GuiaRemision(Base):
    __tablename__ = "guias_remision"

    id_guia                  = Column(Integer, primary_key=True, index=True)
    id_usuario               = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    id_factura               = Column(Integer, ForeignKey("facturas_venta.id_factura"), nullable=True)
    id_destinatario          = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial"), nullable=False)
    numero_comprobante       = Column(String(30), unique=True, nullable=False)
    numero_autorizacion      = Column(String(49), nullable=True)
    fecha_emision            = Column(Date, nullable=False)
    fecha_inicio_transporte  = Column(Date, nullable=False)
    fecha_fin_transporte     = Column(Date, nullable=False)
    # Transportista
    razon_social_transportista   = Column(String(200), nullable=False)
    tipo_id_transportista        = Column(Enum(TipoIdentificacionTransportistaEnum), nullable=False)
    ruc_transportista            = Column(String(20), nullable=False)
    placa_vehiculo               = Column(String(20), nullable=True)
    # Direcciones
    direccion_partida            = Column(Text, nullable=False)
    direccion_destino            = Column(Text, nullable=False)
    # Estado
    estado                       = Column(Enum(EstadoGuiaEnum), default=EstadoGuiaEnum.emitida)
    observaciones                = Column(Text, nullable=True)
    created_at                   = Column(DateTime, default=func.now())

    usuario      = relationship("UsuarioSistema",  back_populates="guias_remision")
    factura      = relationship("FacturaVenta",    back_populates="guias_remision")
    destinatario = relationship("PersonaComercial", back_populates="guias_remision")
    detalles     = relationship("DetalleGuiaRemision", back_populates="guia", cascade="all, delete")


class DetalleGuiaRemision(Base):
    __tablename__ = "detalle_guia_remision"

    id_detalle   = Column(Integer, primary_key=True, index=True)
    id_guia      = Column(Integer, ForeignKey("guias_remision.id_guia", ondelete="CASCADE"), nullable=False)
    id_producto  = Column(Integer, ForeignKey("productos.id_producto"), nullable=True)
    codigo       = Column(String(30), nullable=True)
    descripcion  = Column(String(300), nullable=False)
    cantidad     = Column(DECIMAL(10, 3), nullable=False)
    unidad       = Column(String(30), nullable=False, default="UNIDAD")

    guia     = relationship("GuiaRemision", back_populates="detalles")
    producto = relationship("Producto")
# ─── Liquidaciones de Compras ─────────────────────────────
class LiquidacionCompra(Base):
    __tablename__ = "liquidaciones_compras"

    id_liquidacion       = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario           = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    id_persona_comercial = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial"), nullable=False)
    numero_comprobante   = Column(String(30), nullable=False)
    fecha_emision        = Column(Date, nullable=False)
    subtotal_0           = Column(DECIMAL(10, 2), default=0.00)
    subtotal_iva         = Column(DECIMAL(10, 2), default=0.00)
    porcentaje_iva       = Column(DECIMAL(5, 2),  default=15.00)
    iva                  = Column(DECIMAL(10, 2), default=0.00)
    descuento            = Column(DECIMAL(10, 2), default=0.00)
    total                = Column(DECIMAL(10, 2), nullable=False)
    estado               = Column(String(10), default="emitida")
    observaciones        = Column(Text, nullable=True)
    created_at           = Column(DateTime, default=func.now())

    proveedor = relationship("PersonaComercial", foreign_keys=[id_persona_comercial])
    detalles  = relationship("DetalleLiquidacionCompra", back_populates="liquidacion", cascade="all, delete-orphan")


class DetalleLiquidacionCompra(Base):
    __tablename__ = "detalle_liquidacion_compras"

    id_detalle      = Column(Integer, primary_key=True, autoincrement=True)
    id_liquidacion  = Column(Integer, ForeignKey("liquidaciones_compras.id_liquidacion"), nullable=False)
    descripcion     = Column(String(255), nullable=False)
    cantidad        = Column(DECIMAL(10, 3), default=1.000)
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    porcentaje_iva  = Column(DECIMAL(5, 2),  default=0.00)
    subtotal        = Column(DECIMAL(10, 2), nullable=False)
    descuento       = Column(DECIMAL(10, 2), default=0.00)
    iva             = Column(DECIMAL(10, 2), default=0.00)
    total           = Column(DECIMAL(10, 2), nullable=False)

    liquidacion = relationship("LiquidacionCompra", back_populates="detalles")


# ─── Proformas (Cotizaciones) ─────────────────────────────
class ProformaVenta(Base):
    __tablename__ = "proformas_venta"

    id_proforma           = Column(Integer, primary_key=True, index=True)
    id_usuario            = Column(Integer, ForeignKey("usuarios_sistema.id_usuario"), nullable=False)
    id_persona_comercial  = Column(Integer, ForeignKey("personas_comerciales.id_persona_comercial"), nullable=False)
    numero_comprobante    = Column(String(30), unique=True, nullable=False)
    fecha_emision         = Column(Date, nullable=False)
    fecha_validez         = Column(Date, nullable=True)
    subtotal_0            = Column(DECIMAL(10, 2), default=0.00)
    subtotal_iva          = Column(DECIMAL(10, 2), default=0.00)
    porcentaje_iva        = Column(DECIMAL(5, 2), nullable=False, default=15.00)
    iva                   = Column(DECIMAL(10, 2), default=0.00)
    descuento             = Column(DECIMAL(10, 2), default=0.00)
    total                 = Column(DECIMAL(10, 2), nullable=False)
    estado                = Column(Enum(EstadoProformaEnum), default=EstadoProformaEnum.cotizada)
    observaciones         = Column(Text, nullable=True)
    created_at            = Column(DateTime, default=func.now())

    usuario  = relationship("UsuarioSistema", back_populates="proformas")
    cliente  = relationship("PersonaComercial", back_populates="proformas")
    detalles = relationship("DetalleProformaVenta", back_populates="proforma", cascade="all, delete")


class DetalleProformaVenta(Base):
    __tablename__ = "detalle_proforma_venta"

    id_detalle     = Column(Integer, primary_key=True, index=True)
    id_proforma    = Column(Integer, ForeignKey("proformas_venta.id_proforma", ondelete="CASCADE"), nullable=False)
    id_producto    = Column(Integer, ForeignKey("productos.id_producto"), nullable=False)
    cantidad       = Column(Integer, nullable=False)
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    porcentaje_iva = Column(DECIMAL(5, 2), nullable=False)
    subtotal       = Column(DECIMAL(10, 2), nullable=False)
    descuento      = Column(DECIMAL(10, 2), default=0.00)
    iva            = Column(DECIMAL(10, 2), default=0.00)
    total          = Column(DECIMAL(10, 2), nullable=False)

    proforma  = relationship("ProformaVenta", back_populates="detalles")
    producto  = relationship("Producto", back_populates="detalles_proforma")
# ─── Tickets de Soporte ──────────────────────────────────────────────
class TicketSoporte(Base):
    __tablename__ = "tickets_soporte"
 
    id_ticket        = Column(Integer, primary_key=True, index=True)
    id_estudiante    = Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    categoria        = Column(String(50), nullable=False)   # error_tecnico, duda_modulo, etc.
    modulo           = Column(String(100), nullable=True)
    asunto           = Column(String(120), nullable=False)
    descripcion      = Column(Text, nullable=False)
    estado           = Column(String(20), default="pendiente")  # pendiente | visto | resuelto
    respuesta_docente= Column(Text, nullable=True)
    created_at       = Column(DateTime, default=func.now())
    updated_at       = Column(DateTime, default=func.now(), onupdate=func.now())
 
    estudiante = relationship("UsuarioSistema", foreign_keys=[id_estudiante])
 
 
# ─── Permisos de Módulos por Estudiante ─────────────────────────────
class PermisoModulo(Base):
    __tablename__ = "permisos_modulos"
 
    id_permiso   = Column(Integer, primary_key=True, index=True)
    id_estudiante= Column(Integer, ForeignKey("usuarios_sistema.id_usuario", ondelete="CASCADE"), nullable=False)
    modulo       = Column(String(50), nullable=False)  # inicio, comprobantes_emitidos, etc.
    activo       = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=func.now())
 
    estudiante = relationship("UsuarioSistema", foreign_keys=[id_estudiante])
 

# ═══════════════════════════════════════════════════════════
# TARIFAS IVA — Gestionadas por el docente desde Configuración
# ═══════════════════════════════════════════════════════════
class TarifaIVA(Base):
    """
    Tarifas de IVA configurables por el docente.
    Permite agregar nuevas tarifas sin tocar código.
    Ej: si en 2027 el IVA sube a 17%, el docente crea IVA_17 y lo activa.
    """
    __tablename__ = "tarifas_iva"

    id_tarifa   = Column(Integer, primary_key=True, autoincrement=True)
    codigo      = Column(String(20),  nullable=False, unique=True)
    porcentaje  = Column(DECIMAL(5, 2), nullable=False)
    descripcion = Column(String(150), nullable=False)
    etiqueta    = Column(String(10),  nullable=False)          # "15%"
    activa      = Column(Boolean, default=True,  nullable=False)
    es_default  = Column(Boolean, default=False, nullable=False)
    nota        = Column(Text, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, onupdate=func.now())
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { authService } from '../services/api';

const API      = 'http://localhost:8000/api';
const getToken = () => localStorage.getItem('token');
const getTourKey = (userId) => `ayuda_tour_visto_${userId || 'default'}`;
const EDU_BG     = '#f0f7ff';
const EDU_BORDER = '#bfdbfe';

const FAQS = [
  { categoria: 'Facturación', color: '#2563eb', bg: '#eff6ff', icono: '🧾', preguntas: [
    { q: '¿Cómo crear una factura?', a: 'Ve a "Comprobantes Emitidos" → haz clic en "Crear" → selecciona "Factura". Completa los datos del cliente, agrega los productos y elige si guardar como borrador o finalizar directamente.' },
    { q: '¿Cuál es la diferencia entre borrador y finalizada?', a: 'Un borrador puede editarse o eliminarse. Una factura finalizada descuenta el stock automáticamente y ya no puede modificarse, solo anularse mediante una Nota de Crédito.' },
    { q: '¿Puedo anular una factura finalizada?', a: 'Sí. En Comprobantes Emitidos, abre la factura y usa el botón "Anular". Esto revierte el stock descontado y marca el comprobante como anulado.' },
    { q: '¿Cómo se genera el número de comprobante?', a: 'Se genera automáticamente en formato 001-001-XXXXXXXXX usando la serie configurada en "Configuración del Negocio".' },
  ]},
  { categoria: 'Comprobantes Recibidos', color: '#0d9488', bg: '#f0fdf4', icono: '📥', preguntas: [
    { q: '¿Qué son los comprobantes recibidos?', a: 'Son documentos que recibes de tus proveedores: facturas de compra, notas de crédito, retenciones, etc. Los registras aquí para tener control de tus gastos.' },
    { q: '¿Cómo registro un comprobante recibido?', a: 'Ve a "Comprobantes Recibidos" → botón "Nuevo". Selecciona el proveedor, ingresa el número de comprobante, fecha y los detalles del documento.' },
    { q: '¿Qué es la clave de acceso?', a: 'Es el código de 49 dígitos que aparece en el RIDE de los documentos electrónicos del SRI. Es opcional pero ayuda a verificar la autenticidad del comprobante.' },
  ]},
  { categoria: 'Productos y Stock', color: '#7c3aed', bg: '#f5f3ff', icono: '📦', preguntas: [
    { q: '¿Cómo agrego un producto?', a: 'Ve a "Productos y Servicios" → botón "Nuevo Producto". Ingresa código, nombre, precio, IVA y stock inicial. El código debe ser único.' },
    { q: '¿Por qué no puedo eliminar un producto?', a: 'Si el producto tiene facturas asociadas, solo se desactiva para preservar el historial contable. Productos sin facturas se eliminan físicamente.' },
    { q: '¿Qué pasa con el stock al finalizar una factura?', a: 'Al finalizar, el sistema descuenta automáticamente las cantidades del stock. Si no hay stock suficiente, la finalización será bloqueada.' },
  ]},
  { categoria: 'ATS y Reportes', color: '#b45309', bg: '#fffbeb', icono: '📊', preguntas: [
    { q: '¿Qué es el ATS?', a: 'El Anexo Transaccional Simplificado es una declaración mensual que se presenta al SRI con el detalle de compras y ventas. FactuStock genera el XML listo para subirlo.' },
    { q: '¿Cómo genero el ATS?', a: 'Ve a "Generar ATS", selecciona el mes y año, revisa el resumen y usa el botón "Descargar XML". El archivo descargado se sube directamente al portal del SRI.' },
    { q: '¿Qué reportes están disponibles?', a: 'Resumen general de ventas, ventas por mes, top clientes, top productos, libro de ventas e IVA detallado. Todos con filtros de fecha.' },
  ]},
];

const GUIA_PASOS = [
  { paso: 1, titulo: 'Configura tu negocio',     desc: 'Ingresa RUC, razón social, dirección y serie de facturación en Configuración.',  icono: '⚙️', color: '#2563eb' },
  { paso: 2, titulo: 'Registra tus clientes',    desc: 'Agrega los datos de cada cliente con su tipo y número de identificación.',         icono: '👥', color: '#0d9488' },
  { paso: 3, titulo: 'Carga tu inventario',      desc: 'Crea cada producto con precio, porcentaje de IVA y stock inicial disponible.',     icono: '📦', color: '#7c3aed' },
  { paso: 4, titulo: 'Emite tu primera factura', desc: 'Ve a Comprobantes Emitidos → Crear → Factura. Selecciona cliente y productos.',    icono: '🧾', color: '#f59e0b' },
  { paso: 5, titulo: 'Registra tus compras',     desc: 'En Comprobantes Recibidos registra los documentos recibidos de proveedores.',      icono: '📥', color: '#ef4444' },
  { paso: 6, titulo: 'Genera el ATS mensual',    desc: 'En Generar ATS selecciona mes/año y descarga el XML para subirlo al SRI.',         icono: '📊', color: '#10b981' },
];

const RECURSOS = [
  { tipo: 'Portal SRI',  desc: 'Consultas tributarias, validación de comprobantes y presentación de declaraciones oficiales.', icono: '🏛️', color: '#0d9488', bg: '#f0fdf4', link: 'https://www.sri.gob.ec' },
  { tipo: 'Guía RUC',    desc: 'Información oficial sobre tipos de RUC, obligaciones tributarias y contribuyentes en Ecuador.', icono: '📑', color: '#7c3aed', bg: '#f5f3ff', link: 'https://www.sri.gob.ec/web/guest/registro-unico-de-contribuyentes-ruc' },
  { tipo: 'Portal ULEAM',desc: 'Accede al campus virtual, consulta notas y recursos académicos de la universidad.', icono: '🎓', color: '#b45309', bg: '#fffbeb', link: 'https://www.uleam.edu.ec' },
];

const EDU_CONCEPTOS = [
  { emoji: '🧾', titulo: '¿Qué es una factura electrónica?', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', texto: 'Es un comprobante de venta autorizado por el SRI en formato XML. A diferencia del papel, se valida digitalmente y se puede verificar en sri.gob.ec con la clave de acceso.' },
  { emoji: '📋', titulo: '¿Qué es el RUC?', color: '#0d9488', bg: '#f0fdf4', border: '#6ee7b7', texto: 'El Registro Único de Contribuyentes es el número de identificación tributaria en Ecuador. Personas naturales usan 13 dígitos (cédula + 001). Sociedades tienen RUC propio.' },
  { emoji: '💰', titulo: '¿Cómo funciona el IVA?', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', texto: 'El IVA (Impuesto al Valor Agregado) es del 15% en Ecuador desde 2024. Al facturar, el vendedor lo cobra al cliente y luego lo declara al SRI. Algunos bienes y servicios están exentos (0%).' },
  { emoji: '📊', titulo: '¿Qué es el ATS?', color: '#b45309', bg: '#fffbeb', border: '#fcd34d', texto: 'El Anexo Transaccional Simplificado es una declaración mensual al SRI con todas tus compras y ventas. Se sube como XML antes del día 28 del mes siguiente. FactuStock lo genera automáticamente.' },
  { emoji: '🏢', titulo: 'Ambientes SRI: Pruebas vs Producción', color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0', texto: 'El ambiente "Pruebas" sirve para aprender y probar sin consecuencias legales. "Producción" emite facturas reales con validez tributaria. Este sistema usa "Pruebas" para fines educativos.' },
  { emoji: '📝', titulo: 'Nota de Crédito vs Anulación', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', texto: 'Una anulación es posible dentro de cierto plazo. Pasado ese plazo, la corrección legal se hace con una Nota de Crédito que referencia la factura original (Art. 10 RLCV Ecuador).' },
];

/* ── TOUR DE BIENVENIDA ─────────────────────────────────── */
const TourBienvenida = ({ onCerrar, userName }) => {
  const pasos = [
    { emoji: '👋', titulo: `¡Bienvenido${userName ? ', ' + userName.split(' ')[0] : ''}!`, texto: 'Este módulo tiene dos grandes secciones: Ayuda (guías, FAQs y conceptos tributarios) y Soporte (para reportar problemas o enviar consultas al docente a cargo).' },
    { emoji: '📚', titulo: 'Sección Ayuda', texto: 'Encontrarás una guía paso a paso para usar FactuStock, preguntas frecuentes organizadas por categoría y una biblioteca de conceptos tributarios clave para el curso.' },
    { emoji: '🎓', titulo: 'Conceptos Educativos', texto: 'Como este sistema está orientado al aprendizaje, incluye tarjetas explicativas sobre facturación electrónica, IVA, RUC, ATS y más. ¡Úsalas para repasar antes del examen!' },
    { emoji: '🛠️', titulo: 'Sección Soporte', texto: 'Si algo no funciona como esperas o tienes una duda técnica, usa el formulario de soporte. Tu consulta queda registrada y el docente puede revisarla.' },
    { emoji: '🏫', titulo: 'Sistema Educativo ULEAM', texto: 'FactuStock es un sistema de práctica. Los datos que ingreses son de aprendizaje y no tienen efecto real ante el SRI. ¡Explora todos los módulos sin miedo!' },
  ];
  const [paso, setPaso] = useState(0);
  const actual = pasos[paso];
  const esUltimo = paso === pasos.length - 1;

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(10,18,40,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'tourFadeIn 0.25s ease' }}>
      <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 40px 100px rgba(0,0,0,0.4)', overflow: 'hidden', animation: 'tourPopIn 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#1d4ed8)', padding: '1.6rem 1.8rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '30px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(96,165,250,0.12)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>AYUDA Y SOPORTE</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            Centro de Ayuda<br /><span style={{ color: '#93c5fd' }}>FactuStock</span>
          </p>
          <button onClick={onCerrar} style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', width: '32px', height: '32px', borderRadius: '9px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', padding: '0.9rem 1.8rem 0' }}>
          {pasos.map((_, i) => <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= paso ? '#2563eb' : '#e2e8f0', transition: 'background 0.3s' }} />)}
        </div>
        <div style={{ padding: '1.4rem 1.8rem', minHeight: '160px' }}>
          <div style={{ display: 'flex', gap: '1.1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', flexShrink: 0 }}>{actual.emoji}</div>
            <div>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '1rem', color: '#0f172a' }}>{actual.titulo}</p>
              <p style={{ margin: '0.45rem 0 0', fontSize: '0.84rem', color: '#475569', lineHeight: 1.7 }}>{actual.texto}</p>
            </div>
          </div>
        </div>
        <div style={{ padding: '0.9rem 1.8rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: '700' }}>{paso + 1} de {pasos.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {paso > 0 && <button onClick={() => setPaso(p => p - 1)} style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>← Atrás</button>}
            {!esUltimo
              ? <button onClick={() => setPaso(p => p + 1)} style={{ padding: '0.55rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#15389a,#2563eb)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(15,31,75,0.35)' }}>Siguiente →</button>
              : <button onClick={onCerrar} style={{ padding: '0.55rem 1.6rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>¡Entendido! Empezar 🚀</button>
            }
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ── TARJETA EDUCATIVA ──────────────────────────────────── */
const EduCard = ({ emoji, titulo, texto, color, bg, border }) => (
  <div style={{ background: bg, borderRadius: '14px', padding: '1.1rem 1.2rem', border: `1.5px solid ${border}`, display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'white', border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{emoji}</div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontWeight: '900', fontSize: '0.85rem', color, marginBottom: '0.3rem' }}>{titulo}</p>
      <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569', lineHeight: 1.65 }}>{texto}</p>
    </div>
  </div>
);

/* ── CARD CONTENEDOR ────────────────────────────────────── */
const Card = ({ titulo, icono, acento, children, badge }) => (
  <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', marginBottom: '1.1rem', overflow: 'hidden' }}>
    <div style={{ padding: '0.8rem 1.3rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
      <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: acento, flexShrink: 0 }} />
      <span style={{ fontSize: '1rem' }}>{icono}</span>
      <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', flex: 1 }}>{titulo}</h3>
      {badge && <span style={{ fontSize: '0.67rem', fontWeight: '800', color: '#2563eb', background: '#eff6ff', borderRadius: '99px', padding: '0.18rem 0.6rem', border: '1px solid #bfdbfe' }}>{badge}</span>}
    </div>
    <div style={{ padding: '1.2rem 1.3rem' }}>{children}</div>
  </div>
);

/* ── FORMULARIO SOPORTE ─────────────────────────────────── */
const CATEGORIAS_SOPORTE = [
  { value: 'error_tecnico',   label: 'Error técnico del sistema',  icono: '🐛', color: '#ef4444' },
  { value: 'duda_modulo',     label: 'Duda sobre un módulo',       icono: '❓', color: '#2563eb' },
  { value: 'dato_incorrecto', label: 'Dato incorrecto o perdido',  icono: '⚠️', color: '#f59e0b' },
  { value: 'sugerencia',      label: 'Sugerencia de mejora',       icono: '💡', color: '#10b981' },
  { value: 'otro',            label: 'Otro',                       icono: '📌', color: '#7c3aed' },
];
const MODULOS_LISTA = ['Inicio / Dashboard','Comprobantes Emitidos','Comprobantes Recibidos','Pendientes de Emitir','Clientes','Productos y Servicios','Reportes','Generar ATS','Configuración del Negocio','Mi Perfil','Otro / No aplica'];

const FormularioSoporte = ({ usuario }) => {
  const [categoria, setCategoria] = useState('');
  const [modulo, setModulo] = useState('');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const valido = categoria && modulo && asunto.trim().length >= 5 && descripcion.trim().length >= 15;

  const handleEnviar = async () => {
    if (!valido) return;
    setEnviando(true); setError('');
    try {
      const r = await fetch(`${API}/docente/tickets`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ categoria, modulo, asunto: asunto.trim(), descripcion: descripcion.trim() }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'No se pudo enviar la consulta.'); }
      setEnviado(true);
      setCategoria(''); setModulo(''); setAsunto(''); setDescripcion('');
      setTimeout(() => setEnviado(false), 8000);
    } catch (err) { setError(err.message); } finally { setEnviando(false); }
  };

  if (enviado) return (
    <div style={{ padding: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <p style={{ margin: 0, fontWeight: '900', fontSize: '1rem', color: '#065f46' }}>¡Consulta enviada!</p>
      <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.6, maxWidth: '340px' }}>Tu consulta fue registrada correctamente. El docente a cargo podrá revisarla y responderte.</p>
      <div style={{ padding: '0.65rem 1.2rem', background: '#f0fdf4', border: '1.5px solid #6ee7b7', borderRadius: '10px', fontSize: '0.77rem', color: '#047857', fontWeight: '700' }}>Mientras tanto, revisa si tu duda ya está resuelta en las FAQs ↑</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ background: EDU_BG, border: `1.5px solid ${EDU_BORDER}`, borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>🎓</span>
        <p style={{ margin: 0, fontSize: '0.79rem', color: '#1e40af', lineHeight: 1.6 }}>Este formulario envía tu consulta al <strong>docente a cargo</strong> del curso. Úsalo para reportar errores del sistema, dudas técnicas sobre un módulo o sugerencias de mejora.</p>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.5rem' }}>Tipo de consulta <span style={{ color: '#ef4444' }}>*</span></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {CATEGORIAS_SOPORTE.map(c => { const sel = categoria === c.value; return (
            <button key={c.value} onClick={() => setCategoria(c.value)} style={{ padding: '0.65rem 0.5rem', borderRadius: '10px', border: `1.5px solid ${sel ? c.color : '#e2e8f0'}`, background: sel ? c.color + '14' : 'white', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
              <span style={{ fontSize: '1.1rem' }}>{c.icono}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: '700', color: sel ? c.color : '#64748b', textAlign: 'center', lineHeight: 1.3 }}>{c.label}</span>
            </button>
          ); })}
        </div>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.5rem' }}>Módulo afectado <span style={{ color: '#ef4444' }}>*</span></label>
        <select value={modulo} onChange={e => setModulo(e.target.value)} style={{ width: '100%', padding: '0.68rem 0.9rem', border: `1.5px solid ${modulo ? '#2563eb' : '#e2e8f0'}`, borderRadius: '10px', fontSize: '0.86rem', color: modulo ? '#0f172a' : '#94a3b8', background: 'white', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          <option value="">Selecciona un módulo...</option>
          {MODULOS_LISTA.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.5rem' }}>Asunto <span style={{ color: '#ef4444' }}>*</span></label>
        <input type="text" value={asunto} onChange={e => setAsunto(e.target.value)} maxLength={120} placeholder="Ej: No puedo finalizar una factura con IVA 0%" style={{ width: '100%', padding: '0.68rem 0.9rem', border: `1.5px solid ${asunto.trim().length >= 5 ? '#2563eb' : '#e2e8f0'}`, borderRadius: '10px', fontSize: '0.86rem', color: '#0f172a', background: 'white', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'} onBlur={e => e.target.style.boxShadow = 'none'} />
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right' }}>{asunto.length}/120</p>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.5rem' }}>Descripción detallada <span style={{ color: '#ef4444' }}>*</span></label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={4} maxLength={800} placeholder="Describe el problema o duda con el mayor detalle posible. ¿Qué pasos seguiste? ¿Qué mensaje de error apareció? ¿Qué esperabas que pasara?" style={{ width: '100%', padding: '0.68rem 0.9rem', border: `1.5px solid ${descripcion.trim().length >= 15 ? '#2563eb' : '#e2e8f0'}`, borderRadius: '10px', fontSize: '0.84rem', color: '#0f172a', background: 'white', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} onFocus={e => e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'} onBlur={e => e.target.style.boxShadow = 'none'} />
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right' }}>{descripcion.length}/800</p>
      </div>
      {(usuario?.email || usuario?.nombres) && (
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid #f1f5f9', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <div><span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600' }}>Se enviará como: </span><span style={{ fontSize: '0.74rem', color: '#0f172a', fontWeight: '800' }}>{usuario.nombres} {usuario.apellidos}</span>{usuario.email && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}> — {usuario.email}</span>}</div>
        </div>
      )}
      {error && <div style={{ padding: '0.7rem 1rem', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '10px', fontSize: '0.82rem', color: '#dc2626', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
      <button onClick={handleEnviar} disabled={!valido || enviando} style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: 'none', background: valido && !enviando ? 'linear-gradient(135deg,#15389a,#2563eb)' : '#e2e8f0', color: valido && !enviando ? 'white' : '#94a3b8', fontWeight: '800', fontSize: '0.88rem', fontFamily: 'inherit', cursor: valido && !enviando ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: valido && !enviando ? '0 4px 14px rgba(21,56,154,0.3)' : 'none' }} onMouseEnter={e => { if (valido && !enviando) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(21,56,154,0.4)'; } }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = valido && !enviando ? '0 4px 14px rgba(21,56,154,0.3)' : 'none'; }}>
        {enviando ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Enviando...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Enviar consulta</>}
      </button>
      {!valido && <p style={{ margin: '-0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>Completa todos los campos para habilitar el envío</p>}
    </div>
  );
};

/* ── COMPONENTE PRINCIPAL ───────────────────────────────── */
const AyudaSoporte = () => {
  const usuario = authService.getCurrentUser();
  const userName = usuario ? `${usuario.nombres} ${usuario.apellidos}` : '';
  const TOUR_KEY = getTourKey(usuario?.id || usuario?.email || usuario?.username);

  const [faqAbierta,      setFaqAbierta]      = useState(null);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [tabActiva,       setTabActiva]       = useState('ayuda');
  const [misTickets,      setMisTickets]      = useState([]);
  const [cargandoTickets, setCargandoTickets] = useState(false);
  const [tourVisto,       setTourVisto]       = useState(true);

  useEffect(() => {
    const visto = localStorage.getItem(TOUR_KEY);
    if (!visto) setTourVisto(false);
  }, [TOUR_KEY]);

  const cerrarTour = () => { localStorage.setItem(TOUR_KEY, '1'); setTourVisto(true); };
  const verTutorial = () => { localStorage.removeItem(TOUR_KEY); setTourVisto(false); };
  const cargarMisTickets = React.useCallback(async () => {
    setCargandoTickets(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch('http://localhost:8000/api/docente/mis-tickets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) { const d = await r.json(); setMisTickets(d.tickets || []); }
    } catch { /* silencioso */ } finally { setCargandoTickets(false); }
  }, []);

  React.useEffect(() => {
    if (tabActiva === 'mis_consultas') cargarMisTickets();
  }, [tabActiva, cargarMisTickets]);

  const toggleFaq = (key) => setFaqAbierta(prev => prev === key ? null : key);
  const faqsFiltradas = FAQS.filter(cat => !categoriaActiva || cat.categoria === categoriaActiva);

  return (
    <div style={{ padding: '1.8rem 2rem 2.5rem', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
      {!tourVisto && <TourBienvenida onCerrar={cerrarTour} userName={userName} />}

      {/* Barra modo educativo — siempre visible */}
      <div style={{ background: 'linear-gradient(90deg,#fffbeb,#fef3c7)', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ fontSize: '0.95rem' }}>🏫</span>
        <p style={{ margin: 0, fontSize: '0.77rem', color: '#92400e', fontWeight: '700', flex: 1 }}>Modo Educativo — Los datos son de práctica. Explora sin miedo.</p>
        <button onClick={verTutorial} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: '1.5px solid #fbbf24', background: 'white', color: '#92400e', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>📖 Ver tutorial</button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '0.83rem', color: '#64748b', margin: '0 0 1rem' }}>Guías, preguntas frecuentes, conceptos educativos y soporte técnico para FactuStock.</p>
        <div style={{ display: 'flex', gap: '0.3rem', background: '#f1f5f9', borderRadius: '12px', padding: '0.3rem', width: 'fit-content' }}>
          {[{ id: 'ayuda', label: '📚 Ayuda' }, { id: 'soporte', label: '✉️ Soporte' }, { id: 'mis_consultas', label: '💬 Mis consultas' }].map(t => (
            <button key={t.id} onClick={() => setTabActiva(t.id)} style={{ padding: '0.55rem 1.3rem', borderRadius: '9px', border: 'none', background: tabActiva === t.id ? 'white' : 'transparent', color: tabActiva === t.id ? '#0f172a' : '#64748b', fontWeight: tabActiva === t.id ? '800' : '600', fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: tabActiva === t.id ? '0 1px 6px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.18s' }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tabActiva === 'ayuda' && (<>
        <Card titulo="Guía de Inicio Rápido" icono="🚀" acento="#15389a">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {GUIA_PASOS.map(p => (
              <div key={p.paso} style={{ background: '#f8fafc', borderRadius: '12px', padding: '0.9rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid #f1f5f9' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '900', color: 'white', flexShrink: 0 }}>{p.paso}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}><span style={{ fontSize: '0.9rem' }}>{p.icono}</span><span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0f172a' }}>{p.titulo}</span></div>
                  <p style={{ margin: 0, fontSize: '0.77rem', color: '#64748b', lineHeight: 1.55 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card titulo="Conceptos Tributarios" icono="🎓" acento="#2563eb" badge="EDUCATIVO">
          <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>Definiciones y explicaciones clave sobre el sistema tributario ecuatoriano aplicadas al uso de FactuStock.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
            {EDU_CONCEPTOS.map(c => <EduCard key={c.titulo} emoji={c.emoji} titulo={c.titulo} texto={c.texto} color={c.color} bg={c.bg} border={c.border} />)}
          </div>
        </Card>

        <Card titulo="Preguntas Frecuentes" icono="❓" acento="#f59e0b">
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1.1rem' }}>
            {[{ label: 'Todas', value: null, bg: '#0f172a' }, ...FAQS.map(c => ({ label: `${c.icono} ${c.categoria}`, value: c.categoria, bg: c.color }))].map(f => {
              const activo = categoriaActiva === f.value;
              return <button key={f.label} onClick={() => setCategoriaActiva(f.value)} style={{ padding: '0.32rem 0.9rem', borderRadius: '99px', border: 'none', cursor: 'pointer', fontSize: '0.74rem', fontWeight: '700', fontFamily: 'inherit', background: activo ? f.bg : '#f1f5f9', color: activo ? 'white' : '#64748b', transition: 'all 0.15s' }}>{f.label}</button>;
            })}
          </div>
          {faqsFiltradas.map(cat => (
            <div key={cat.categoria} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.45rem' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.7rem', fontWeight: '900', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{cat.categoria}</span>
              </div>
              {cat.preguntas.map((item, i) => {
                const key = `${cat.categoria}-${i}`;
                const abierta = faqAbierta === key;
                return (
                  <div key={key} style={{ border: `1.5px solid ${abierta ? cat.color + '44' : '#f1f5f9'}`, borderRadius: '10px', marginBottom: '0.4rem', overflow: 'hidden' }}>
                    <button onClick={() => toggleFaq(key)} style={{ width: '100%', padding: '0.78rem 1rem', background: abierta ? cat.bg : 'white', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', textAlign: 'left', fontFamily: 'inherit' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{item.q}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {abierta && <div style={{ padding: '0.75rem 1rem', background: cat.bg, borderTop: `1px solid ${cat.color}22` }}><p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.7 }}>{item.a}</p></div>}
                  </div>
                );
              })}
            </div>
          ))}
        </Card>

        <Card titulo="Recursos Externos" icono="🔗" acento="#10b981">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
            {RECURSOS.map(r => (
              <div key={r.tipo} style={{ background: r.bg, borderRadius: '12px', padding: '1.1rem', border: `1.5px solid ${r.color}22`, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{r.icono}</span>
                <div style={{ fontSize: '0.83rem', fontWeight: '800', color: r.color }}>{r.tipo}</div>
                <p style={{ margin: 0, fontSize: '0.76rem', color: '#475569', lineHeight: 1.55, flex: 1 }}>{r.desc}</p>
                <a href={r.link} target="_blank" rel="noreferrer" style={{ fontSize: '0.74rem', fontWeight: '700', color: r.color, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>Visitar sitio <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></a>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.71rem', color: '#94a3b8' }}>FactuStock v1.0 — Sistema de Facturación Electrónica Educativo</span>
            <span style={{ fontSize: '0.71rem', color: '#94a3b8' }}>Proyecto Integrador — ULEAM</span>
          </div>
        </Card>
      </>)}

      {tabActiva === 'mis_consultas' && (
        <div>
          <div style={{ marginBottom: '1.2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>Mis consultas enviadas</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>Aquí puedes ver el estado y la respuesta del docente a tus consultas.</p>
          </div>
          {cargandoTickets ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Cargando consultas...</div>
          ) : misTickets.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '3rem', textAlign: 'center', color: '#94a3b8', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem' }}>Aún no has enviado ninguna consulta</p>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem' }}>Usa la pestaña "Soporte" para contactar al docente.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {misTickets.map(t => {
                const estadoInfo = {
                  pendiente: { label: 'Pendiente', color: '#d97706', bg: '#fffbeb' },
                  visto:     { label: 'Visto',     color: '#2563eb', bg: '#eff6ff' },
                  resuelto:  { label: 'Resuelto',  color: '#059669', bg: '#ecfdf5' },
                }[t.estado] || { label: t.estado, color: '#64748b', bg: '#f1f5f9' };
                return (
                  <div key={t.id_ticket} style={{ background: 'white', borderRadius: '14px', border: `1px solid ${t.respuesta_docente ? '#bfdbfe' : '#f1f5f9'}`, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '0.85rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.asunto}</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })} {t.modulo && `· ${t.modulo}`}</p>
                      </div>
                      <span style={{ padding: '0.2rem 0.65rem', borderRadius: '99px', fontSize: '0.71rem', fontWeight: '800', color: estadoInfo.color, background: estadoInfo.bg, flexShrink: 0 }}>{estadoInfo.label}</span>
                    </div>
                    <div style={{ padding: '0 1.2rem 0.85rem' }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.6 }}>{t.descripcion}</p>
                    </div>
                    {t.respuesta_docente ? (
                      <div style={{ margin: '0 1.2rem 1rem', padding: '0.85rem 1rem', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', borderRadius: '10px', borderLeft: '4px solid #2563eb' }}>
                        <p style={{ margin: '0 0 0.3rem', fontSize: '0.72rem', fontWeight: '800', color: '#15389a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>👨‍🏫 Respuesta del docente</p>
                        <p style={{ margin: 0, fontSize: '0.83rem', color: '#1e3a8a', lineHeight: 1.65 }}>{t.respuesta_docente}</p>
                      </div>
                    ) : (
                      <div style={{ margin: '0 1.2rem 1rem', padding: '0.65rem 1rem', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                        <p style={{ margin: 0, fontSize: '0.77rem', color: '#92400e', fontWeight: '600' }}>⏳ El docente aún no ha respondido esta consulta.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tabActiva === 'soporte' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.1rem', alignItems: 'flex-start' }}>
          <Card titulo="Enviar Consulta al Docente" icono="✉️" acento="#2563eb">
            <FormularioSoporte usuario={usuario} />
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.1rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '4px', height: '18px', borderRadius: '2px', background: '#f59e0b' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0f172a' }}>Antes de escribir</span>
              </div>
              <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[{ icono: '❓', texto: '¿Revisaste las Preguntas Frecuentes? Muchas dudas ya están resueltas allí.' }, { icono: '🎓', texto: '¿Leíste los Conceptos Tributarios? Están en la pestaña Ayuda.' }, { icono: '🔄', texto: '¿Intentaste recargar la página o volver a iniciar sesión?' }].map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>{tip.icono}</span>
                    <p style={{ margin: 0, fontSize: '0.77rem', color: '#475569', lineHeight: 1.55 }}>{tip.texto}</p>
                  </div>
                ))}
                <button onClick={() => setTabActiva('ayuda')} style={{ marginTop: '0.2rem', padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1.5px solid #bfdbfe', background: EDU_BG, color: '#2563eb', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }} onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'} onMouseLeave={e => e.currentTarget.style.background = EDU_BG}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>Ir a Ayuda / FAQs
                </button>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.1rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: '4px', height: '18px', borderRadius: '2px', background: '#10b981' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0f172a' }}>Consulta útil incluye</span>
              </div>
              <div style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {['El módulo exacto donde ocurrió el problema','Los pasos que seguiste antes del error','El mensaje de error (si aparece alguno)','Qué resultado esperabas obtener'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.77rem', color: '#475569', lineHeight: 1.5 }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AyudaSoporte;
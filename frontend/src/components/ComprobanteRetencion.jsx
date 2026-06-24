import React, { useState, useEffect, useCallback } from 'react';
import { retencionesService, comprobantesRecibidosService, clientesService } from '../services/api';
import ReactDOM from 'react-dom';
import { useIsMobile } from '../hooks/useIsMobile';

/* ════════════════════════════════════════════════════════
   TOUR BIENVENIDA — Comprobante de Retención
   localStorage key: ret_tour
════════════════════════════════════════════════════════ */
const getTOUR_KEY_RET = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `tour-key-ret-${uid}`;
  } catch { return 'tour-key-ret'; }
};
const TOUR_KEY_RET = getTOUR_KEY_RET();

const AZUL = {
  primary: '#15389a',
  mid: '#2563eb',
  light: '#dbeafe',
  lighter: '#eff6ff',
  border: '#93c5fd',
};

const AMARILLO = {
  primary: '#f59e0b',
  dark: '#d97706',
  darker: '#92400e',
  light: '#fef3c7',
  lighter: '#fffbeb',
  border: '#fcd34d',
  text: '#78350f',
};

const CODIGOS_RENTA = [
  { codigo: '303', descripcion: 'Honorarios profesionales y dietas' },
  { codigo: '304', descripcion: 'Servicios predomina el intelecto' },
  { codigo: '307', descripcion: 'Servicios predomina mano de obra' },
  { codigo: '308', descripcion: 'Servicios entre sociedades' },
  { codigo: '309', descripcion: 'Servicios publicidad y comunicación' },
  { codigo: '310', descripcion: 'Transporte privado de pasajeros' },
  { codigo: '312', descripcion: 'Transferencia bienes muebles de naturaleza corporal' },
  { codigo: '319', descripcion: 'Arrendamiento bienes inmuebles' },
  { codigo: '322', descripcion: 'Seguros y reaseguros' },
  { codigo: '323', descripcion: 'Por rendimientos financieros' },
  { codigo: '332', descripcion: 'Pago a través liquidación de compras' },
  { codigo: '340', descripcion: 'Otras retenciones aplicables' },
  { codigo: '403', descripcion: 'Intereses entre sociedades' },
];

const CODIGOS_IVA = [
  { codigo: '721', descripcion: 'Retención del 10% del IVA' },
  { codigo: '723', descripcion: 'Retención del 20% del IVA' },
  { codigo: '725', descripcion: 'Retención del 30% del IVA' },
  { codigo: '727', descripcion: 'Retención del 70% del IVA' },
  { codigo: '729', descripcion: 'Retención del 100% del IVA' },
];

const PORCENTAJES_RENTA = [0.10, 0.15, 0.20, 0.25, 0.35, 1, 1.75, 2, 2.75, 5, 8, 10, 15, 22, 25];
const PORCENTAJES_IVA   = [10, 20, 30, 70, 100];

const fmtMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (s) => { if (!s) return '—'; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }); };
const today    = () => new Date().toISOString().split('T')[0];
const thisYear = () => String(new Date().getFullYear());

const PASOS_RET = [
  { n: 1, label: 'Proveedor' },
  { n: 2, label: 'Retenciones' },
  { n: 3, label: 'Emitir' },
];

/* ════════════════════════════════════════════════════════
   COMPONENTES DE TOUR / BANNER / BARRA
════════════════════════════════════════════════════════ */
const TourBienvenida_RET = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📋', titulo: '¿Qué es un Comprobante de Retención?', texto: 'Es el documento que emite el agente de retención al momento de comprar. Indica cuánto se retiene del pago al proveedor por concepto de Impuesto a la Renta o IVA.' },
    { emoji: '👤', titulo: 'Paso 1 — Proveedor', texto: 'Busca y selecciona el proveedor al que realizas la retención. Opcionalmente elige la factura de origen recibida a la que corresponde.' },
    { emoji: '🔢', titulo: 'Paso 2 — Detalle de Retenciones', texto: 'Agrega las líneas: tipo (Renta o IVA), código SRI, base imponible y porcentaje. El valor retenido se calcula automáticamente.' },
    { emoji: '📝', titulo: 'Paso 3 — Emitir', texto: 'Ingresa número de comprobante, fecha y número de autorización. Al emitir queda registrado formalmente en el sistema.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Sistema de práctica. Los comprobantes son referenciales y no tienen efecto real ante el SRI.' },
  ];
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', animation: 'tourFadeIn 0.22s ease',
    }}>
      <div style={{
        background: 'white', borderRadius: '22px', width: '100%', maxWidth: '460px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden',
        animation: 'tourPopIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a)', padding: '1.3rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>RETENCIÓN</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: '#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', paddingRight: '2rem' }}>Comprobante de Retención</p>
          <p style={{ margin: '0.18rem 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.65)' }}>Te explicamos cómo funciona este módulo</p>
          <button onClick={onCerrar}
            style={{ position: 'absolute', top: '1rem', right: '1rem', width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Barra de progreso */}
        <div style={{ display: 'flex', gap: '0.35rem', padding: '0.85rem 1.5rem 0' }}>
          {pasos.map((_, i) => (
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= paso ? '#15389a' : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
        </div>
        {/* Contenido */}
        <div style={{ padding: '1.2rem 1.5rem', minHeight: '150px' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#f0f7ff', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>{actual.emoji}</div>
            <div>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '0.94rem', color: '#0f172a' }}>{actual.titulo}</p>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.65 }}>{actual.texto}</p>
            </div>
          </div>
        </div>
        {/* Navegación */}
        <div style={{ padding: '0.85rem 1.5rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: '700' }}>{paso + 1} de {pasos.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {paso > 0 && (
              <button onClick={() => setPaso(p => p - 1)}
                style={{ padding: '0.52rem 1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Atrás
              </button>
            )}
            {paso < pasos.length - 1 ? (
              <button onClick={() => setPaso(p => p + 1)}
                style={{ padding: '0.52rem 1.2rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#0f1f4b,#15389a)', color: 'white', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(15,31,75,0.3)' }}>
                Siguiente →
              </button>
            ) : (
              <button onClick={onCerrar}
                style={{ padding: '0.52rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}>
                ¡Entendido! Empezar 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const BannerEdu_RET = ({ onClose, onVerTutorial }) => (
  <div style={{
    marginBottom: '1rem', background: 'linear-gradient(135deg,#f0f7ff,#e0f2fe)',
    border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '0.85rem 1.2rem',
    display: 'flex', alignItems: 'center', gap: '0.85rem', animation: 'tourFadeIn 0.3s ease',
  }}>
    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🎓</div>
    <div style={{ flex: 1 }}>
      <p style={{ margin: 0, fontWeight: '900', fontSize: '0.82rem', color: '#1d4ed8' }}>Modo Educativo Activo</p>
      <p style={{ margin: '0.1rem 0 0', fontSize: '0.76rem', color: '#3b82f6', lineHeight: 1.4 }}>Primera visita al módulo. Los datos son de práctica, ¡explora sin miedo!</p>
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.2rem', display: 'flex', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
);

const BarraModoEdu_RET = ({ onVerTutorial }) => (
  <div style={{
    background: 'linear-gradient(90deg,#fffbeb,#fef3c7)', border: '1.5px solid #fde68a',
    borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.1rem',
    display: 'flex', alignItems: 'center', gap: '0.65rem',
  }}>
    <span style={{ fontSize: '0.95rem' }}>🏫</span>
    <p style={{ margin: 0, fontSize: '0.77rem', color: '#92400e', fontWeight: '700', flex: 1 }}>
      Modo Educativo — Los datos son de práctica. Explora sin miedo.
    </p>
    <button onClick={onVerTutorial}
      style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: '1.5px solid #fbbf24', background: 'white', color: '#92400e', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      📖 Ver tutorial
    </button>
  </div>
);

/* ════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════════════════════════ */
const ComprobanteRetencion = ({ onVolver }) => {
  const isMobile = useIsMobile();

  // ── Tour educativo — primera visita ──────────────────────────────
  const [tourVisto_RET, setTourVisto_RET] = useState(
    () => !!localStorage.getItem(TOUR_KEY_RET)
  );
  const [mostrarEdu_RET, setMostrarEdu_RET] = useState(false);

  const cerrarTour_RET = () => {
    localStorage.setItem(TOUR_KEY_RET, '1');
    setTourVisto_RET(true);
    setMostrarEdu_RET(true);
    setTimeout(() => setMostrarEdu_RET(false), 30000);
  };

  const verTutorial_RET = () => {
    localStorage.removeItem(TOUR_KEY_RET);
    setTourVisto_RET(false);
    setMostrarEdu_RET(false);
  };

  const [paso,       setPaso]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [exito,      setExito]      = useState(null);

  const [busquedaProv,     setBusquedaProv]     = useState('');
  const [proveedores,      setProveedores]      = useState([]);
  const [provSeleccionado, setProvSeleccionado] = useState(null);
  const [comprobantes,     setComprobantes]     = useState([]);
  const [compSeleccionado, setCompSeleccionado] = useState(null);
  const [cargandoProv,     setCargandoProv]     = useState(false);
  const [cargandoComp,     setCargandoComp]     = useState(false);

  const [detalles, setDetalles] = useState([
    { id: Date.now(), tipo: 'renta', codigo_sri: '', descripcion: '', base_imponible: '', porcentaje: '', valor_retenido: 0 },
  ]);

  const [form, setForm] = useState({
    numero_comprobante: '', numero_autorizacion: '',
    fecha_emision: today(), ejercicio_fiscal: thisYear(), observaciones: '',
  });

  const buscarProveedores = useCallback(async (q) => {
    if (!q || q.length < 2) { setProveedores([]); return; }
    setCargandoProv(true);
    try {
      const res = await clientesService.listar({ buscar: q, porPagina: 20 });
      setProveedores((res.items || res).filter(p => p.flag_proveedor));
    } catch { setProveedores([]); }
    finally { setCargandoProv(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscarProveedores(busquedaProv), 350);
    return () => clearTimeout(t);
  }, [busquedaProv, buscarProveedores]);

  const seleccionarProveedor = async (prov) => {
    setProvSeleccionado(prov);
    setProveedores([]);
    setBusquedaProv('');
    setCompSeleccionado(null);
    setCargandoComp(true);
    try {
      const res = await comprobantesRecibidosService.listar({ porPagina: 50 });
      const items = (res.items || res).filter(c => c.id_persona_comercial === prov.id_persona_comercial || c.proveedor?.id_persona_comercial === prov.id_persona_comercial);
      setComprobantes(items);
    } catch { setComprobantes([]); }
    finally { setCargandoComp(false); }
  };

  const agregarDetalle = () => {
    setDetalles(prev => [...prev, { id: Date.now(), tipo: 'renta', codigo_sri: '', descripcion: '', base_imponible: '', porcentaje: '', valor_retenido: 0 }]);
  };

  const eliminarDetalle = (id) => {
    if (detalles.length === 1) return;
    setDetalles(prev => prev.filter(d => d.id !== id));
  };

  const updateDetalle = (id, campo, valor) => {
    setDetalles(prev => prev.map(d => {
      if (d.id !== id) return d;
      const nuevo = { ...d, [campo]: valor };
      if (campo === 'codigo_sri') {
        const cat = nuevo.tipo === 'iva' ? CODIGOS_IVA : CODIGOS_RENTA;
        const found = cat.find(c => c.codigo === valor);
        if (found) nuevo.descripcion = found.descripcion;
        if (nuevo.tipo === 'iva') {
          const pct = { '721': 10, '723': 20, '725': 30, '727': 70, '729': 100 }[valor];
          if (pct) nuevo.porcentaje = pct;
        }
      }
      const base = parseFloat(nuevo.base_imponible) || 0;
      const pct  = parseFloat(nuevo.porcentaje) || 0;
      nuevo.valor_retenido = parseFloat((base * pct / 100).toFixed(2));
      return nuevo;
    }));
  };

  const totalRenta = detalles.filter(d => d.tipo === 'renta').reduce((s, d) => s + (d.valor_retenido || 0), 0);
  const totalIva   = detalles.filter(d => d.tipo === 'iva').reduce((s, d) => s + (d.valor_retenido || 0), 0);
  const totalGral  = totalRenta + totalIva;

  const puedeAvanzar1 = !!provSeleccionado;
  const puedeAvanzar2 = detalles.every(d =>
    d.codigo_sri && d.descripcion && parseFloat(d.base_imponible) > 0 && parseFloat(d.porcentaje) > 0
  ) && detalles.length > 0;

  const emitir = async () => {
    if (!form.numero_comprobante.trim()) { setError('Ingresa el número del comprobante.'); return; }
    setLoading(true); setError('');
    try {
      const payload = {
        id_persona_comercial:  provSeleccionado.id_persona_comercial,
        id_comprobante_origen: compSeleccionado?.id_comprobante || null,
        numero_comprobante:    form.numero_comprobante.trim(),
        numero_autorizacion:   form.numero_autorizacion.trim() || null,
        fecha_emision:         form.fecha_emision,
        ejercicio_fiscal:      form.ejercicio_fiscal,
        observaciones:         form.observaciones.trim() || null,
        detalles: detalles.map(d => ({
          tipo: d.tipo, codigo_sri: d.codigo_sri, descripcion: d.descripcion,
          base_imponible: parseFloat(d.base_imponible), porcentaje: parseFloat(d.porcentaje),
          valor_retenido: d.valor_retenido,
        })),
      };
      const resultado = await retencionesService.crear(payload);
      setExito(resultado);
    } catch (e) {
      setError(e?.detail || e?.message || 'Error al emitir la retención.');
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setExito(null);
    setPaso(1);
    setProvSeleccionado(null);
    setCompSeleccionado(null);
    setComprobantes([]);
    setDetalles([{ id: Date.now(), tipo: 'renta', codigo_sri: '', descripcion: '', base_imponible: '', porcentaje: '', valor_retenido: 0 }]);
    setForm({ numero_comprobante: '', numero_autorizacion: '', fecha_emision: today(), ejercicio_fiscal: thisYear(), observaciones: '' });
  };

  // ── Pantalla de éxito ──
  if (exito) {
    return (
      <div style={{ padding: isMobile ? '1rem 0.85rem' : '2rem', animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '2.5rem', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: AMARILLO.light, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={AMARILLO.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.4rem' }}>¡Retención emitida!</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1.5rem' }}>Comprobante <strong>{exito.numero_comprobante}</strong></p>
          <div style={{ background: AZUL.lighter, borderRadius: '12px', padding: '1rem 1.4rem', marginBottom: '1.5rem', textAlign: 'left', border: `1px solid ${AZUL.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '0.8rem' }}>
              {[
                { label: 'Proveedor',        value: exito.proveedor?.nombre },
                { label: 'Fecha',            value: fmtFecha(exito.fecha_emision) },
                { label: 'Ejercicio Fiscal', value: exito.ejercicio_fiscal },
                { label: 'Ret. Renta',       value: fmtMoney(exito.total_retenido_renta) },
                { label: 'Ret. IVA',         value: fmtMoney(exito.total_retenido_iva) },
                { label: 'Total Retenido',   value: fmtMoney(exito.total_retenido) },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={resetForm}
              style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: `2px solid ${AZUL.border}`, background: AZUL.lighter, color: AZUL.primary, fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>
              Nueva Retención
            </button>
            <button onClick={onVolver}
              style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${AZUL.primary}, ${AZUL.mid})`, color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', boxShadow: `0 4px 14px ${AZUL.primary}55` }}>
              Volver a Documentos
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Barra de contexto (stepper) ──
  const BarraContexto = () => (
    <div style={{ background: 'white', borderRadius: '16px', padding: '0.9rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `linear-gradient(135deg,${AMARILLO.primary},${AMARILLO.dark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 13 10 15 16 9"/></svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo de documento</p>
          <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: '900', color: '#0f172a' }}>Comprobante de Retención</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {PASOS_RET.map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800', background: paso >= s.n ? `linear-gradient(135deg,${AMARILLO.primary},${AMARILLO.dark})` : '#e2e8f0', color: paso >= s.n ? 'white' : '#94a3b8', flexShrink: 0 }}>
                {paso > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: paso === s.n ? '800' : '500', color: paso >= s.n ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < 2 && <div style={{ width: '36px', height: '2px', background: paso > s.n ? AMARILLO.primary : '#e2e8f0', margin: '0 0.5rem' }} />}
          </React.Fragment>
        ))}
      </div>
      <button onClick={onVolver}
        style={{ background: AZUL.lighter, border: `1.5px solid ${AZUL.border}`, borderRadius: '8px', padding: '0.42rem 0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: '700', color: AZUL.primary, fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = AZUL.light; e.currentTarget.style.borderColor = AZUL.mid; }}
        onMouseLeave={e => { e.currentTarget.style.background = AZUL.lighter; e.currentTarget.style.borderColor = AZUL.border; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
    </div>
  );

  return (
    <div style={{ padding: isMobile ? '1rem 0.85rem' : '1.4rem 2rem', animation: 'fadeUp 0.3s ease both' }}>
      {/* ── Tour educativo ── */}
      {!tourVisto_RET && <TourBienvenida_RET onCerrar={cerrarTour_RET} />}
      {mostrarEdu_RET && <BannerEdu_RET onClose={() => setMostrarEdu_RET(false)} onVerTutorial={verTutorial_RET} />}
      <BarraModoEdu_RET onVerTutorial={verTutorial_RET} />
      <BarraContexto />

      {/* PASO 1 — PROVEEDOR */}
      {paso === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease both' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMARILLO.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Proveedor / Agente Retenido
            </h3>
            {!provSeleccionado ? (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <input value={busquedaProv} onChange={e => setBusquedaProv(e.target.value)}
                    placeholder="Buscar por nombre, RUC o cédula..."
                    style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.5rem', border: `1.5px solid ${busquedaProv ? AMARILLO.border : '#e2e8f0'}`, borderRadius: '10px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = AZUL.mid}
                    onBlur={e => e.target.style.borderColor = busquedaProv ? AMARILLO.border : '#e2e8f0'} />
                  <svg style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {cargandoProv && <div style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: `2px solid ${AZUL.border}`, borderTopColor: AZUL.mid, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                </div>
                {proveedores.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'white', borderRadius: '10px', border: '1.5px solid #e2e8f0', boxShadow: '0 8px 28px rgba(0,0,0,0.10)', marginTop: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                    {proveedores.map(p => (
                      <div key={p.id_persona_comercial} onClick={() => seleccionarProveedor(p)}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = AZUL.lighter}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>{p.razon_social || p.nombres_apellidos}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.tipo_identificacion}: {p.identificacion}</div>
                      </div>
                    ))}
                  </div>
                )}
                {busquedaProv.length >= 2 && !cargandoProv && proveedores.length === 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#94a3b8', padding: '0.5rem' }}>No se encontraron proveedores.</div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem', background: AZUL.lighter, borderRadius: '10px', border: `1.5px solid ${AZUL.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: '800', color: 'white' }}>
                    {(provSeleccionado.razon_social || provSeleccionado.nombres_apellidos || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>{provSeleccionado.razon_social || provSeleccionado.nombres_apellidos}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{provSeleccionado.tipo_identificacion}: {provSeleccionado.identificacion}</div>
                  </div>
                </div>
                <button onClick={() => { setProvSeleccionado(null); setCompSeleccionado(null); setComprobantes([]); }}
                  style={{ background: 'white', border: `1.5px solid ${AZUL.border}`, borderRadius: '8px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', color: AZUL.primary, fontFamily: 'inherit' }}>
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {provSeleccionado && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.4rem' }}>
                Comprobante de Origen <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8' }}>(opcional)</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem' }}>Selecciona la factura recibida a la que corresponde esta retención</p>
              {cargandoComp ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <div style={{ width: '16px', height: '16px', border: `2px solid ${AZUL.border}`, borderTopColor: AZUL.mid, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Cargando...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                  <div onClick={() => setCompSeleccionado(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.65rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${!compSeleccionado ? AZUL.mid : '#e2e8f0'}`, background: !compSeleccionado ? AZUL.lighter : 'white', cursor: 'pointer' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${!compSeleccionado ? AZUL.mid : '#cbd5e1'}`, background: !compSeleccionado ? AZUL.mid : 'white', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.83rem', color: '#64748b', fontWeight: '500' }}>Sin comprobante de origen</span>
                  </div>
                  {comprobantes.map(c => (
                    <div key={c.id_comprobante} onClick={() => setCompSeleccionado(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.65rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${compSeleccionado?.id_comprobante === c.id_comprobante ? AZUL.mid : '#e2e8f0'}`, background: compSeleccionado?.id_comprobante === c.id_comprobante ? AZUL.lighter : 'white', cursor: 'pointer' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${compSeleccionado?.id_comprobante === c.id_comprobante ? AZUL.mid : '#cbd5e1'}`, background: compSeleccionado?.id_comprobante === c.id_comprobante ? AZUL.mid : 'white', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>{c.numero_comprobante}</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '0.8rem' }}>{fmtFecha(c.fecha_emision)}</span>
                      </div>
                      <span style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a' }}>{fmtMoney(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => puedeAvanzar1 && setPaso(2)} disabled={!puedeAvanzar1}
              style={{ padding: '0.7rem 1.8rem', borderRadius: '10px', border: 'none', background: puedeAvanzar1 ? `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})` : '#e2e8f0', color: puedeAvanzar1 ? 'white' : '#94a3b8', fontWeight: '700', fontSize: '0.88rem', cursor: puedeAvanzar1 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: puedeAvanzar1 ? `0 4px 14px ${AZUL.primary}55` : 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Siguiente
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* PASO 2 — RETENCIONES */}
      {paso === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease both' }}>
          <div style={{ background: AZUL.lighter, borderRadius: '12px', padding: '0.8rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', border: `1px solid ${AZUL.border}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={AZUL.mid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <span style={{ fontSize: '0.83rem', fontWeight: '700', color: AZUL.primary }}>{provSeleccionado?.razon_social || provSeleccionado?.nombres_apellidos}</span>
            {compSeleccionado && <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '0.5rem' }}>· {compSeleccionado.numero_comprobante} · {fmtMoney(compSeleccionado.total)}</span>}
          </div>

          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Detalle de Retenciones</h3>
              <button onClick={agregarDetalle}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${AZUL.border}`, background: AZUL.lighter, color: AZUL.primary, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar línea
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '90px 120px 1fr 110px 90px 90px 36px', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '2px solid #f1f5f9', marginBottom: '0.5rem', minWidth: '700px' }}>
                {['Tipo', 'Código SRI', 'Descripción', 'Base Imponible', 'Porcentaje', 'Retenido', ''].map(col => (
                  <span key={col} style={{ fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{col}</span>
                ))}
              </div>
              {detalles.map((d, idx) => (
                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '90px 120px 1fr 110px 90px 90px 36px', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: idx < detalles.length - 1 ? '1px solid #f8fafc' : 'none', minWidth: '700px' }}>
                  <select value={d.tipo} onChange={e => updateDetalle(d.id, 'tipo', e.target.value)}
                    style={{ padding: '0.45rem 0.4rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: d.tipo === 'renta' ? '#fef3c7' : '#dbeafe', color: d.tipo === 'renta' ? '#92400e' : '#1e40af', fontWeight: '700' }}>
                    <option value="renta">Renta</option>
                    <option value="iva">IVA</option>
                  </select>
                  <select value={d.codigo_sri} onChange={e => updateDetalle(d.id, 'codigo_sri', e.target.value)}
                    style={{ padding: '0.45rem 0.4rem', border: `1.5px solid ${d.codigo_sri ? AZUL.border : '#e2e8f0'}`, borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                    <option value="">— Código —</option>
                    {(d.tipo === 'iva' ? CODIGOS_IVA : CODIGOS_RENTA).map(c => (
                      <option key={c.codigo} value={c.codigo}>{c.codigo}</option>
                    ))}
                  </select>
                  <input value={d.descripcion} onChange={e => updateDetalle(d.id, 'descripcion', e.target.value)}
                    placeholder="Descripción"
                    style={{ padding: '0.45rem 0.6rem', border: `1.5px solid ${d.descripcion ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = AZUL.mid}
                    onBlur={e => e.target.style.borderColor = d.descripcion ? '#e2e8f0' : '#fca5a5'} />
                  <input type="number" min="0" step="0.01" value={d.base_imponible} onChange={e => updateDetalle(d.id, 'base_imponible', e.target.value)}
                    placeholder="0.00"
                    style={{ padding: '0.45rem 0.6rem', border: `1.5px solid ${parseFloat(d.base_imponible) > 0 ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', textAlign: 'right' }}
                    onFocus={e => e.target.style.borderColor = AZUL.mid}
                    onBlur={e => e.target.style.borderColor = parseFloat(d.base_imponible) > 0 ? '#e2e8f0' : '#fca5a5'} />
                  <select value={d.porcentaje} onChange={e => updateDetalle(d.id, 'porcentaje', e.target.value)}
                    style={{ padding: '0.45rem 0.4rem', border: `1.5px solid ${d.porcentaje ? AZUL.border : '#e2e8f0'}`, borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                    <option value="">%</option>
                    {(d.tipo === 'iva' ? PORCENTAJES_IVA : PORCENTAJES_RENTA).map(p => <option key={p} value={p}>{p}%</option>)}
                  </select>
                  <div style={{ padding: '0.45rem 0.6rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', textAlign: 'right' }}>
                    ${d.valor_retenido.toFixed(2)}
                  </div>
                  <button onClick={() => eliminarDetalle(d.id)} disabled={detalles.length === 1}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: detalles.length === 1 ? '#f8fafc' : '#fee2e2', color: detalles.length === 1 ? '#cbd5e1' : '#ef4444', cursor: detalles.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ret. Renta</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#92400e' }}>{fmtMoney(totalRenta)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ret. IVA</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e40af' }}>{fmtMoney(totalIva)}</div>
            </div>
            <div style={{ textAlign: 'right', paddingLeft: '2rem', borderLeft: '2px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Retenido</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }}>{fmtMoney(totalGral)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setPaso(1)}
              style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Anterior
            </button>
            <button onClick={() => puedeAvanzar2 && setPaso(3)} disabled={!puedeAvanzar2}
              style={{ padding: '0.65rem 1.6rem', borderRadius: '10px', border: 'none', background: puedeAvanzar2 ? `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})` : '#e2e8f0', color: puedeAvanzar2 ? 'white' : '#94a3b8', fontWeight: '700', fontSize: '0.85rem', cursor: puedeAvanzar2 ? 'pointer' : 'not-allowed', fontFamily: 'inherit', boxShadow: puedeAvanzar2 ? `0 4px 14px ${AZUL.primary}55` : 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Siguiente
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* PASO 3 — CONFIRMAR */}
      {paso === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease both' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.2rem' }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.1rem' }}>Datos del Comprobante</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {[
                  { label: 'Número de Comprobante *', key: 'numero_comprobante',  placeholder: 'Ej: 001-001-000000001', required: true },
                  { label: 'N° Autorización SRI',     key: 'numero_autorizacion', placeholder: 'Número de 49 dígitos',   required: false },
                  { label: 'Ejercicio Fiscal *',      key: 'ejercicio_fiscal',    placeholder: 'Año',                    required: true, maxLength: 4 },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>{field.label}</label>
                    <input value={form[field.key]} onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder} maxLength={field.maxLength}
                      style={{ width: '100%', padding: '0.6rem 0.8rem', border: `1.5px solid ${form[field.key] || !field.required ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = AZUL.mid}
                      onBlur={e => e.target.style.borderColor = form[field.key] || !field.required ? '#e2e8f0' : '#fca5a5'} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Fecha de Emisión *</label>
                  <input type="date" value={form.fecha_emision} onChange={e => setForm(prev => ({ ...prev, fecha_emision: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = AZUL.mid}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Observaciones</label>
                  <textarea value={form.observaciones} onChange={e => setForm(prev => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Notas adicionales (opcional)" rows={2}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = AZUL.mid}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '1.3rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.6rem' }}>Proveedor</div>
                <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>{provSeleccionado?.razon_social || provSeleccionado?.nombres_apellidos}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>{provSeleccionado?.tipo_identificacion}: {provSeleccionado?.identificacion}</div>
                {compSeleccionado && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>Factura: <strong>{compSeleccionado.numero_comprobante}</strong></div>}
              </div>
              <div style={{ background: 'white', borderRadius: '16px', padding: '1.3rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', flex: 1 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.8rem' }}>Retenciones ({detalles.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {detalles.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f8fafc' }}>
                      <div>
                        <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '99px', fontSize: '0.67rem', fontWeight: '700', background: d.tipo === 'renta' ? '#fef3c7' : '#dbeafe', color: d.tipo === 'renta' ? '#92400e' : '#1e40af', marginRight: '0.4rem' }}>{d.tipo.toUpperCase()}</span>
                        <span style={{ fontSize: '0.8rem', color: '#475569' }}>{d.codigo_sri} · {d.porcentaje}%</span>
                      </div>
                      <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>${d.valor_retenido.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: `2px solid ${AZUL.light}` }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>Total Retenido</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: '900', color: AZUL.mid }}>{fmtMoney(totalGral)}</span>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.85rem 1.1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setPaso(2)}
              style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Anterior
            </button>
            <button onClick={emitir} disabled={loading}
              style={{ padding: '0.75rem 2rem', borderRadius: '10px', border: 'none', background: loading ? '#e2e8f0' : `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, color: loading ? '#94a3b8' : 'white', fontWeight: '800', fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : `0 4px 18px ${AZUL.primary}66`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {loading
                ? <><div style={{ width: '16px', height: '16px', border: '2px solid #fff5', borderTopColor: '#94a3b8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Procesando...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Emitir Comprobante</>
              }
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tourFadeIn{ from{opacity:0} to{opacity:1} }
        @keyframes tourPopIn { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
};

export default ComprobanteRetencion;
import React, { useState, useEffect, useCallback } from 'react';
import { facturasService } from '../services/api';
import api from '../services/api';
import ReactDOM from 'react-dom';
import { useIsMobile } from '../hooks/useIsMobile';

/* ════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — Nota de Crédito
   localStorage key: nc_tour_<userId>
════════════════════════════════════════════════════════ */
const getTOUR_KEY_NC = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `nc-tour-${uid}`;
  } catch { return 'nc-tour'; }
};
const TOUR_KEY_NC = getTOUR_KEY_NC();

const getTourKey_NC = (uid) => `${TOUR_KEY_NC}_${uid || 'default'}`;

const MOTIVOS = [
  { value: 'devolucion_total',   label: 'Devolución total de mercadería' },
  { value: 'devolucion_parcial', label: 'Devolución parcial de mercadería' },
  { value: 'descuento',          label: 'Descuento / rebaja en precio' },
  { value: 'error_facturacion',  label: 'Error en facturación' },
  { value: 'anulacion',          label: 'Anulación de venta' },
];

const fmt = (v) =>
  '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (s) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

const hoy = () => new Date().toISOString().split('T')[0];

const AZUL = {
  primary: '#15389a',
  mid: '#2563eb',
  light: '#dbeafe',
  lighter: '#eff6ff',
  border: '#93c5fd',
};

const VERDE = {
  primary: '#059669',
  mid: '#10b981',
  light: '#d1fae5',
  lighter: '#ecfdf5',
  border: '#a7f3d0',
};

const inputStyle = {
  width: '100%', padding: '0.62rem 0.9rem', border: '1.5px solid #e2e8f0',
  borderRadius: '10px', fontSize: '0.85rem', color: '#1e293b', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: 'white',
};

const lblStyle = {
  fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase',
  letterSpacing: '0.4px', display: 'block', marginBottom: '0.35rem',
};

const ResumenFila = ({ label, valor }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</span>
    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{valor}</span>
  </div>
);

const PASOS = [
  { n: 1, label: 'Seleccionar Factura' },
  { n: 2, label: 'Detalles' },
  { n: 3, label: 'Emitida' },
];

/* ══════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — componente modal
══════════════════════════════════════════════════════════ */
const TourBienvenida_NC = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📋', titulo: '¿Qué es una Nota de Crédito?', texto: 'Documento para reversar total o parcialmente el efecto tributario de una factura ya finalizada. Se usa por devoluciones, descuentos posteriores o errores en la facturación original.' },
    { emoji: '🔍', titulo: 'Paso 1 — Seleccionar Factura', texto: 'Busca la factura finalizada a la que quieres aplicar la nota. Solo se referencian facturas en estado Finalizada.' },
    { emoji: '📝', titulo: 'Paso 2 — Detalles', texto: 'Indica el motivo, fecha de emisión y cantidades a devolver por ítem. Los totales se calculan automáticamente.' },
    { emoji: '✅', titulo: 'Emitir la Nota de Crédito', texto: 'Al emitir, los montos se revierten y la nota aparece en el ATS como ajuste de ventas del período.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Según Art. 10 RLCV Ecuador, si venció el plazo de anulación directa, la Nota de Crédito es el mecanismo legal correcto.' },
  ];
  const [pasoActual, setPasoActual] = React.useState(0);
  const actual = pasos[pasoActual];

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
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>NOTA DE CRÉDITO</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: '#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', paddingRight: '2rem' }}>Nota de Crédito</p>
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
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= pasoActual ? '#15389a' : '#e2e8f0', transition: 'background 0.3s' }} />
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
          <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: '700' }}>{pasoActual + 1} de {pasos.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pasoActual > 0 && (
              <button onClick={() => setPasoActual(p => p - 1)}
                style={{ padding: '0.52rem 1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Atrás
              </button>
            )}
            {pasoActual < pasos.length - 1 ? (
              <button onClick={() => setPasoActual(p => p + 1)}
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

/* ══════════════════════════════════════════════════════════
   BANNER POST-TOUR (se muestra 30 s tras cerrar el tour)
══════════════════════════════════════════════════════════ */
const BannerEdu_NC = ({ onClose, onVerTutorial }) => (
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

/* ══════════════════════════════════════════════════════════
   BARRA MODO EDUCATIVO (siempre visible en el form)
══════════════════════════════════════════════════════════ */
const BarraModoEdu_NC = ({ onVerTutorial }) => (
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

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
const NotaCredito = ({ onVolver }) => {
  const isMobile = useIsMobile();

  // ── Obtener userId una sola vez ───────────────────────────
  const tourKey = React.useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return getTourKey_NC(u?.id || u?.email || 'default');
    } catch {
      return getTourKey_NC('default');
    }
  }, []);

  // ── Estado del tour (un único sistema) ───────────────────
  const [tourVisto, setTourVisto] = useState(() => !!localStorage.getItem(tourKey));
  const [mostrarBanner, setMostrarBanner] = useState(false);

  const cerrarTour = () => {
    localStorage.setItem(tourKey, '1');
    setTourVisto(true);
    setMostrarBanner(true);
    setTimeout(() => setMostrarBanner(false), 30000);
  };

  const verTutorial = () => {
    localStorage.removeItem(tourKey);
    setTourVisto(false);
    setMostrarBanner(false);
  };

  // ── Estado del formulario ─────────────────────────────────
  const [paso,          setPaso]          = useState(1);
  const [busqueda,      setBusqueda]      = useState('');
  const [facturas,      setFacturas]      = useState([]);
  const [cargando,      setCargando]      = useState(false);
  const [facturaSelec,  setFacturaSelec]  = useState(null);
  const [detalles,      setDetalles]      = useState([]);
  const [motivo,        setMotivo]        = useState('devolucion_parcial');
  const [fecha,         setFecha]         = useState(hoy());
  const [observaciones, setObservaciones] = useState('');
  const [guardando,     setGuardando]     = useState(false);
  const [error,         setError]         = useState('');
  const [resultado,     setResultado]     = useState(null);

  const buscarFacturas = useCallback(async () => {
    setCargando(true);
    try {
      const data = await facturasService.listar({ estado: 'finalizada', buscar: busqueda, porPagina: 20 });
      setFacturas(data.items || []);
    } catch {
      setFacturas([]);
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => { buscarFacturas(); }, []);

  const seleccionarFactura = async (factura) => {
    try {
      const full = await facturasService.obtener(factura.id_factura);
      setFacturaSelec(full);
      setDetalles(full.detalles.map(d => ({
        id_producto:     d.id_producto,
        nombre:          d.producto?.nombre || '—',
        codigo:          d.producto?.codigo || '',
        precio_unitario: parseFloat(d.precio_unitario),
        porcentaje_iva:  parseFloat(d.porcentaje_iva),
        cantidad_max:    d.cantidad,
        cantidad:        0,
        incluir:         false,
      })));
      setPaso(2);
    } catch {
      setError('No se pudo cargar la factura.');
    }
  };

  const toggleDetalle = (i) => {
    setDetalles(prev => prev.map((d, idx) => idx === i
      ? { ...d, incluir: !d.incluir, cantidad: !d.incluir ? d.cantidad_max : 0 }
      : d
    ));
  };

  const setCantidad = (i, val) => {
    const num = Math.max(0, Math.min(parseInt(val) || 0, detalles[i].cantidad_max));
    setDetalles(prev => prev.map((d, idx) => idx === i ? { ...d, cantidad: num } : d));
  };

  const itemsActivos  = detalles.filter(d => d.incluir && d.cantidad > 0);
  const subtotal0     = itemsActivos.filter(d => d.porcentaje_iva === 0).reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
  const subtotalIva   = itemsActivos.filter(d => d.porcentaje_iva > 0).reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
  const iva           = itemsActivos.filter(d => d.porcentaje_iva > 0).reduce((s, d) => s + d.cantidad * d.precio_unitario * (d.porcentaje_iva / 100), 0);
  const total         = subtotal0 + subtotalIva + iva;

  const seleccionarTodo = () => {
    setDetalles(prev => prev.map(d => ({ ...d, incluir: true, cantidad: d.cantidad_max })));
    setMotivo('devolucion_total');
  };

  const emitir = async () => {
    setError('');
    if (itemsActivos.length === 0) {
      setError('Selecciona al menos un producto con cantidad mayor a 0.');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        id_factura:     facturaSelec.id_factura,
        fecha_emision:  fecha,
        motivo,
        porcentaje_iva: facturaSelec.porcentaje_iva,
        observaciones,
        detalles: itemsActivos.map(d => ({
          id_producto:     d.id_producto,
          cantidad:        d.cantidad,
          precio_unitario: d.precio_unitario,
          porcentaje_iva:  d.porcentaje_iva,
        })),
      };
      const res = await api.post('/notas-credito/', payload);
      setResultado(res.data);
      setPaso(3);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error al emitir la nota de crédito.');
    } finally {
      setGuardando(false);
    }
  };

  // ── Barra de contexto (stepper + botón volver) ────────────
  const BarraContexto = () => (
    <div style={{ background: 'white', borderRadius: '16px', padding: '0.9rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `linear-gradient(135deg,${VERDE.primary},${VERDE.mid})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo de documento</p>
          <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: '900', color: '#0f172a' }}>Nota de Crédito</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {PASOS.map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800', background: paso >= s.n ? `linear-gradient(135deg,${VERDE.primary},${VERDE.mid})` : '#e2e8f0', color: paso >= s.n ? 'white' : '#94a3b8', flexShrink: 0 }}>
                {paso > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: paso === s.n ? '800' : '500', color: paso >= s.n ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < 2 && <div style={{ width: '36px', height: '2px', background: paso > s.n ? VERDE.mid : '#e2e8f0', margin: '0 0.5rem' }} />}
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

  // ── Pantalla de éxito ─────────────────────────────────────
  if (paso === 3 && resultado) {
    return (
      <div style={{ padding: isMobile ? '1rem 0.85rem' : '1.4rem 2rem', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
        {!tourVisto && <TourBienvenida_NC onCerrar={cerrarTour} />}
        {mostrarBanner && <BannerEdu_NC onClose={() => setMostrarBanner(false)} onVerTutorial={verTutorial} />}
        <BarraContexto />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center', gap: '1rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: `linear-gradient(135deg,${VERDE.primary},${VERDE.mid})`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>¡Nota de Crédito emitida!</h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>El documento ha sido registrado correctamente.</p>
          <div style={{ background: VERDE.lighter, border: `1.5px solid ${VERDE.border}`, borderRadius: '14px', padding: '1.2rem 2rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: VERDE.primary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Número de comprobante</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>{resultado.numero_comprobante}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: VERDE.mid, marginTop: '0.4rem' }}>{fmt(resultado.total)}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button onClick={() => { setPaso(1); setFacturaSelec(null); setDetalles([]); setResultado(null); setBusqueda(''); buscarFacturas(); }}
              style={{ padding: '0.7rem 1.4rem', background: VERDE.lighter, border: `1.5px solid ${VERDE.border}`, borderRadius: '10px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: '700', color: VERDE.primary, fontFamily: 'inherit' }}>
              Nueva Nota de Crédito
            </button>
            <button onClick={onVolver}
              style={{ padding: '0.7rem 1.4rem', background: `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: '700', color: 'white', fontFamily: 'inherit', boxShadow: `0 4px 14px ${AZUL.primary}55` }}>
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ──────────────────────────────────
  return (
    <div style={{ padding: isMobile ? '1rem 0.85rem' : '1.4rem 2rem', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
      {/* Tour modal (primera visita) */}
      {!tourVisto && <TourBienvenida_NC onCerrar={cerrarTour} />}

      {/* Banner post-tour (30 s) */}
      {mostrarBanner && <BannerEdu_NC onClose={() => setMostrarBanner(false)} onVerTutorial={verTutorial} />}

      {/* Barra amarilla de modo educativo */}
      <BarraModoEdu_NC onVerTutorial={verTutorial} />

      <BarraContexto />

      {error && (
        <div style={{ padding: '0.8rem 1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '0.83rem', marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── PASO 1: Seleccionar factura ── */}
      {paso === 1 && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: VERDE.mid }} />
            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>Selecciona la factura de referencia</h3>
          </div>
          <div style={{ padding: '1.2rem 1.4rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.2rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscarFacturas()}
                  placeholder="Buscar por número de factura o cliente..."
                  style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = AZUL.mid}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <button onClick={buscarFacturas}
                style={{ padding: '0.6rem 1.2rem', background: `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: '700', fontFamily: 'inherit' }}>
                Buscar
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
            <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden', minWidth: '530px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 110px 110px 90px', padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                {['N° Factura', 'Cliente', 'Fecha', 'Total', 'Acción'].map(c => (
                  <span key={c} style={{ fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c}</span>
                ))}
              </div>
              {cargando ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>Buscando facturas...</div>
              ) : facturas.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem' }}>No se encontraron facturas finalizadas.</div>
              ) : (
                facturas.map((f, i) => {
                  const nombre = f.cliente?.nombres_apellidos || f.cliente?.razon_social || '—';
                  return (
                    <div key={f.id_factura}
                      style={{ display: 'grid', gridTemplateColumns: '140px 1fr 110px 110px 90px', padding: '0.75rem 1rem', alignItems: 'center', borderBottom: i < facturas.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', fontFamily: 'monospace' }}>{f.numero_comprobante}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{fmtFecha(f.fecha_emision)}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>{fmt(f.total)}</span>
                      <button onClick={() => seleccionarFactura(f)}
                        style={{ padding: '0.38rem 0.8rem', background: AZUL.lighter, border: `1.5px solid ${AZUL.border}`, color: AZUL.primary, borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = AZUL.mid; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = AZUL.lighter; e.currentTarget.style.color = AZUL.primary; }}>
                        Seleccionar
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            </div>{/* cierre overflowX */}
          </div>
        </div>
      )}

      {/* ── PASO 2: Detalles ── */}
      {paso === 2 && facturaSelec && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '1.2rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Tarjeta factura seleccionada */}
            <div style={{ background: AZUL.lighter, border: `1.5px solid ${AZUL.border}`, borderRadius: '14px', padding: '1rem 1.2rem', display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: '800', color: AZUL.primary, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.2rem' }}>Factura de referencia</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>{facturaSelec.numero_comprobante}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: '800', color: AZUL.primary, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.2rem' }}>Cliente</div>
                <div style={{ fontSize: '0.87rem', fontWeight: '700', color: '#0f172a' }}>{facturaSelec.cliente?.nombres_apellidos || facturaSelec.cliente?.razon_social}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: '800', color: AZUL.primary, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.2rem' }}>Total</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#0f172a' }}>{fmt(facturaSelec.total)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: '800', color: AZUL.primary, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.2rem' }}>Fecha</div>
                <div style={{ fontSize: '0.84rem', fontWeight: '600', color: '#0f172a' }}>{fmtFecha(facturaSelec.fecha_emision)}</div>
              </div>
              <button onClick={() => { setPaso(1); setFacturaSelec(null); setDetalles([]); }}
                style={{ marginLeft: 'auto', padding: '0.35rem 0.8rem', background: 'white', border: `1px solid ${AZUL.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: '700', color: '#64748b', fontFamily: 'inherit' }}>
                Cambiar
              </button>
            </div>

            {/* Tabla de productos */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.2rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: AZUL.mid }} />
                  <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>Productos a incluir</h3>
                </div>
                <button onClick={seleccionarTodo}
                  style={{ fontSize: '0.74rem', fontWeight: '700', color: AZUL.primary, background: AZUL.lighter, border: `1px solid ${AZUL.border}`, borderRadius: '8px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Seleccionar todo
                </button>
              </div>
              <div style={{ padding: '1rem 1.2rem', overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px 120px 100px', gap: '0.5rem', padding: '0 0 0.5rem', borderBottom: '1px solid #f8fafc', marginBottom: '0.5rem', minWidth: '460px' }}>
                  {['', 'Producto', 'P. Unit.', 'Cantidad', 'Subtotal'].map(c => (
                    <span key={c} style={{ fontSize: '0.67rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c}</span>
                  ))}
                </div>
                {detalles.map((d, i) => {
                  const sub = d.cantidad * d.precio_unitario;
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 90px 120px 100px', gap: '0.5rem', alignItems: 'center', padding: '0.55rem 0', borderBottom: i < detalles.length - 1 ? '1px solid #f8fafc' : 'none', opacity: d.incluir ? 1 : 0.5, minWidth: '460px' }}>
                      <input type="checkbox" checked={d.incluir} onChange={() => toggleDetalle(i)}
                        style={{ width: '16px', height: '16px', accentColor: AZUL.mid, cursor: 'pointer' }} />
                      <div>
                        <div style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{d.nombre}</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{d.codigo} · Facturado: {d.cantidad_max} u.</div>
                      </div>
                      <span style={{ fontSize: '0.83rem', color: '#64748b' }}>{fmt(d.precio_unitario)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button onClick={() => setCantidad(i, d.cantidad - 1)} disabled={!d.incluir}
                          style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: d.incluir ? 'pointer' : 'not-allowed', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', lineHeight: 1 }}>−</button>
                        <input type="number" value={d.cantidad} min={0} max={d.cantidad_max}
                          onChange={e => setCantidad(i, e.target.value)} disabled={!d.incluir}
                          style={{ width: '46px', textAlign: 'center', border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.25rem', fontSize: '0.83rem', fontFamily: 'inherit', outline: 'none' }} />
                        <button onClick={() => setCantidad(i, d.cantidad + 1)} disabled={!d.incluir}
                          style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: d.incluir ? 'pointer' : 'not-allowed', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', lineHeight: 1 }}>+</button>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: d.incluir && d.cantidad > 0 ? AZUL.mid : '#94a3b8' }}>{fmt(sub)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Motivo, fecha, observaciones */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', padding: '1.2rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={lblStyle}>Motivo *</label>
                <select value={motivo} onChange={e => setMotivo(e.target.value)} style={inputStyle}>
                  {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>Fecha de Emisión *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={lblStyle}>Observaciones (opcional)</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  placeholder="Detalla el motivo de la devolución o ajuste..."
                  rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            </div>
          </div>

          {/* Resumen lateral */}
          <div style={{ position: 'sticky', top: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <div style={{ padding: '0.85rem 1.2rem', background: `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})` }}>
                <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: 'white' }}>Resumen de la NC</h3>
              </div>
              <div style={{ padding: '1.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1rem' }}>
                  <ResumenFila label="Subtotal sin IVA" valor={fmt(subtotal0)} />
                  <ResumenFila label="Subtotal con IVA" valor={fmt(subtotalIva)} />
                  <ResumenFila label={`IVA (${facturaSelec?.porcentaje_iva || 15}%)`} valor={fmt(iva)} />
                  <div style={{ height: '1px', background: '#f1f5f9', margin: '0.25rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '900', color: '#0f172a' }}>TOTAL NC</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '900', color: AZUL.mid }}>{fmt(total)}</span>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.76rem', color: '#64748b', lineHeight: 1.6 }}>
                  <strong style={{ color: '#0f172a' }}>Al emitir esta nota de crédito:</strong>
                  <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                    <li>Se devolverá el stock de los productos seleccionados</li>
                    <li>La factura original no se modifica</li>
                    <li>El documento quedará registrado como emitido</li>
                  </ul>
                </div>
                <button onClick={emitir} disabled={guardando || itemsActivos.length === 0}
                  style={{ width: '100%', padding: '0.9rem', background: guardando || itemsActivos.length === 0 ? AZUL.border : `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, color: 'white', border: 'none', borderRadius: '12px', cursor: guardando || itemsActivos.length === 0 ? 'not-allowed' : 'pointer', fontSize: '0.88rem', fontWeight: '800', fontFamily: 'inherit', boxShadow: `0 4px 14px ${AZUL.primary}55` }}>
                  {guardando ? 'Emitiendo...' : '✓ Emitir Nota de Crédito'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotaCredito;
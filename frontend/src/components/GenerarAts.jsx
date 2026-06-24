import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import api from '../services/api';

/* ─── UTILIDADES ─────────────────────────────────────────────────────── */
const fmtMoney = (v) =>
  '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (s) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const TIPO_LABEL = {
  factura:'Factura', nota_credito:'N. Crédito',
  nota_debito:'N. Débito', retencion:'Retención',
  liquidacion:'Liquidación', guia:'Guía',
};

const ACCENT  = '#15389a';
const ACCENT2 = '#2563eb';
const EDU_BG  = '#f0f7ff';
const EDU_BORDER = '#bfdbfe';

/* ─── SKELETON ───────────────────────────────────────────────────────── */
const Skeleton = ({ w = '100%', h = '16px', radius = '6px' }) => (
  <div style={{
    width: w, height: h, borderRadius: radius,
    background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
  }} />
);

/* ─── TOOLTIP EDUCATIVO ──────────────────────────────────────────────── */
const EduTooltip = ({ children, tip, visible }) => {
  if (!visible) return children;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <div style={{
        position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
        transform: 'translateX(-50%)',
        background: '#1e3a8a', color: 'white', borderRadius: '10px',
        padding: '0.6rem 0.85rem', fontSize: '0.74rem', fontWeight: '600',
        lineHeight: 1.45, maxWidth: '260px',
        whiteSpace: 'normal', zIndex: 100,
        boxShadow: '0 8px 24px rgba(21,56,154,0.35)',
        animation: 'fadeUp 0.3s ease both',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: '0.8rem', marginRight: '0.3rem' }}>💡</span>{tip}
        <div style={{
          position: 'absolute', bottom: '-5px', left: '50%',
          transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid #1e3a8a',
        }} />
      </div>
    </div>
  );
};

/* ─── TARJETA EDUCATIVA ──────────────────────────────────────────────── */
const EduCard = ({ emoji, titulo, texto, color = ACCENT }) => (
  <div style={{
    background: EDU_BG, border: `1.5px solid ${EDU_BORDER}`,
    borderLeft: `4px solid ${color}`,
    borderRadius: '12px', padding: '0.85rem 1rem',
    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    animation: 'fadeUp 0.35s ease both',
  }}>
    <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{emoji}</span>
    <div>
      <p style={{ margin: 0, fontWeight: '800', fontSize: '0.82rem', color }}>{titulo}</p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: 1.55 }}>
        {texto}
      </p>
    </div>
  </div>
);

/* ─── TOUR DE BIENVENIDA (primera visita) ────────────────────────────── */
const getTOUR_KEY = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `ats-tour-${uid}`;
  } catch { return 'ats-tour'; }
};
const TOUR_KEY = getTOUR_KEY();

const TourBienvenida = ({ onCerrar }) => {
  const pasos = [
    {
      emoji: '📋',
      titulo: '¿Qué es el ATS?',
      texto: 'El Anexo Transaccional Simplificado (ATS) es un reporte mensual obligatorio que los contribuyentes presentan al SRI de Ecuador. Incluye todas las ventas y compras del mes, con detalle de IVA y retenciones.',
    },
    {
      emoji: '📤',
      titulo: 'Sección Ventas',
      texto: 'Aquí verás las facturas, notas de crédito, notas de débito y retenciones que TÚ emitiste durante el mes seleccionado. Solo aparecen comprobantes en estado Finalizado.',
    },
    {
      emoji: '📥',
      titulo: 'Sección Compras',
      texto: 'Aquí aparecen los comprobantes que tus proveedores te emitieron a ti: facturas, notas de crédito, notas de débito y liquidaciones donde tú eres el cliente o destinatario.',
    },
    {
      emoji: '📄',
      titulo: '¿Por qué se descarga en XML?',
      texto: 'El SRI Ecuador exige el ATS en formato XML con una estructura definida en su ficha técnica oficial (esquema XSD). El portal sri.gob.ec solo acepta este formato — no hay opción PDF ni Excel para la declaración real. El XML generado aquí sigue ese estándar.',
    },
    {
      emoji: '📅',
      titulo: '¿Cuándo se presenta?',
      texto: 'El ATS del mes anterior se presenta hasta el día 28 del mes siguiente, según el noveno dígito del RUC. Por ejemplo: el ATS de enero se presenta en febrero. Las multas por no presentarlo son de hasta $1.500.',
    },
    {
      emoji: '🏫',
      titulo: 'Modo Educativo',
      texto: 'Los datos son de práctica y el XML generado es referencial — no se envía al SRI real. Genera el ATS de distintos meses para entender cómo cambia según las transacciones registradas. ¡Explora sin miedo!',
    },
  ];

  const [paso, setPaso] = useState(0);
  const actual = pasos[paso];

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(10,18,40,0.78)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', animation: 'tourFadeIn 0.25s ease',
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px',
        boxShadow: '0 40px 100px rgba(0,0,0,0.4)', overflow: 'hidden',
        animation: 'tourPopIn 0.32s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#1d4ed8)', padding: '1.6rem 1.8rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '30px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(96,165,250,0.12)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>MÓDULO ATS</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            Generador de ATS<br />
            <span style={{ color: '#93c5fd' }}>Anexo Transaccional Simplificado</span>
          </p>
          <button onClick={onCerrar}
            style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', width: '32px', height: '32px', borderRadius: '9px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Barra de progreso */}
        <div style={{ display: 'flex', gap: '0.3rem', padding: '0.9rem 1.8rem 0' }}>
          {pasos.map((_, i) => (
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= paso ? '#2563eb' : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
        </div>
        {/* Contenido */}
        <div style={{ padding: '1.4rem 1.8rem', minHeight: '160px' }}>
          <div style={{ display: 'flex', gap: '1.1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', flexShrink: 0 }}>
              {actual.emoji}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '1rem', color: '#0f172a' }}>{actual.titulo}</p>
              <p style={{ margin: '0.45rem 0 0', fontSize: '0.84rem', color: '#475569', lineHeight: 1.7 }}>{actual.texto}</p>
            </div>
          </div>
        </div>
        {/* Navegación */}
        <div style={{ padding: '0.9rem 1.8rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: '700' }}>{paso + 1} de {pasos.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {paso > 0 && (
              <button onClick={() => setPaso(p => p - 1)}
                style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.82rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Atrás
              </button>
            )}
            {paso < pasos.length - 1 ? (
              <button onClick={() => setPaso(p => p + 1)}
                style={{ padding: '0.55rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#15389a,#2563eb)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(15,31,75,0.35)' }}>
                Siguiente →
              </button>
            ) : (
              <button onClick={onCerrar}
                style={{ padding: '0.55rem 1.6rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>
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

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════════════ */
const GenerarAts = () => {
  const hoy = new Date();
  const [anio,       setAnio]       = useState(hoy.getFullYear());
  const [mes,        setMes]        = useState(hoy.getMonth() + 1);
  const [tab,        setTab]        = useState('resumen');
  const [loading,    setLoading]    = useState(false);
  const [loadingXml, setLoadingXml] = useState(false);
  const [resumen,    setResumen]    = useState(null);
  const [ventas,     setVentas]     = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [error,      setError]      = useState('');
  const [tourVisto,  setTourVisto]  = useState(true);
  const [mostrarEdu, setMostrarEdu] = useState(false);

  useEffect(() => {
    const visto = localStorage.getItem(TOUR_KEY);
    if (!visto) setTourVisto(false);
  }, []);

  const cerrarTour = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setTourVisto(true);
    setMostrarEdu(true);
    setTimeout(() => setMostrarEdu(false), 30000);
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [r, v, c] = await Promise.all([
        api.get(`/ats/resumen?anio=${anio}&mes=${mes}`).then(r => r.data),
        api.get(`/ats/ventas-detalle?anio=${anio}&mes=${mes}`).then(r => r.data),
        api.get(`/ats/compras-detalle?anio=${anio}&mes=${mes}`).then(r => r.data),
      ]);
      setResumen(r);
      setVentas(v.items || []);
      setCompras(c.items || []);
    } catch {
      setError('No se pudieron cargar los datos del período.');
    } finally {
      setLoading(false);
    }
  }, [anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  const descargarXML = async () => {
    setLoadingXml(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const resp = await fetch(
        `https://factustock-efdi.onrender.com/api/ats/generar-xml?anio=${anio}&mes=${mes}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) throw new Error('Error al generar XML');
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `ATS_${resumen?.negocio?.ruc || 'ats'}_${anio}${String(mes).padStart(2, '0')}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Error al generar el XML. Verifica los datos e intenta nuevamente.');
    } finally {
      setLoadingXml(false);
    }
  };

  const TABS = [
    { id: 'resumen', label: 'Resumen',                      icon: '📊' },
    { id: 'ventas',  label: `Ventas (${ventas.length})`,    icon: '📤' },
    { id: 'compras', label: `Compras (${compras.length})`,  icon: '📥' },
    { id: 'ayuda',   label: 'Guía SRI',                     icon: '📖' },
  ];

  return (
    <div style={{ padding: '1.4rem 1.5rem', fontFamily: "'Nunito','Segoe UI',system-ui,sans-serif", animation: 'fadeUp 0.3s ease both' }}>

      {!tourVisto && <TourBienvenida onCerrar={cerrarTour} />}

      {mostrarEdu && (
        <div style={{
          background: 'linear-gradient(90deg,#eff6ff,#dbeafe)',
          border: `1.5px solid ${EDU_BORDER}`,
          borderRadius: '14px', padding: '0.75rem 1.1rem',
          marginBottom: '1rem', display: 'flex', alignItems: 'center',
          gap: '0.75rem', animation: 'fadeUp 0.3s ease',
        }}>
          <span style={{ fontSize: '1.2rem' }}>🎓</span>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e3a8a', fontWeight: '700' }}>
            Las etiquetas explicativas están activas por 30 segundos. ¡Pasa el cursor sobre cada sección!
          </p>
          <button onClick={() => setMostrarEdu(false)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1rem' }}>
            ✕
          </button>
        </div>
      )}

      {/* ── HEADER SELECTOR ── */}
      <div style={{
        background: 'white', borderRadius: '16px',
        padding: '1rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        marginBottom: '1.2rem', display: 'flex', alignItems: 'center',
        gap: '1.2rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Período ATS
          </span>
          {mostrarEdu && (
            <div style={{
              background: EDU_BG, border: `1px solid ${EDU_BORDER}`,
              borderRadius: '8px', padding: '0.4rem 0.65rem',
              fontSize: '0.72rem', color: '#1e3a8a', fontWeight: '600',
              marginBottom: '0.3rem', maxWidth: '280px',
            }}>
              📅 Selecciona el mes y año que quieres declarar al SRI
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <select value={mes} onChange={e => setMes(Number(e.target.value))}
              style={{ padding: '0.45rem 0.8rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.84rem', color: '#334155', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={anio} onChange={e => setAnio(Number(e.target.value))}
              style={{ padding: '0.45rem 0.8rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.84rem', color: '#334155', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: '#f8fafc' }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={cargar}
              style={{ padding: '0.45rem 1rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, color: 'white', fontSize: '0.8rem', fontWeight: '700', fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 12px rgba(21,56,154,0.3)' }}>
              Cargar
            </button>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {resumen && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>{resumen.negocio?.razon_social}</p>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>RUC: {resumen.negocio?.ruc}</p>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            {mostrarEdu && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
                background: '#1e3a8a', color: 'white', borderRadius: '10px',
                padding: '0.55rem 0.8rem', fontSize: '0.73rem', fontWeight: '600',
                lineHeight: 1.45, width: '220px', zIndex: 100,
                boxShadow: '0 8px 24px rgba(21,56,154,0.35)',
                animation: 'fadeUp 0.3s ease',
              }}>
                📄 Genera el archivo XML oficial del SRI con todos los datos del período
                <div style={{ position: 'absolute', bottom: '-5px', right: '20px', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #1e3a8a' }} />
              </div>
            )}
            <button onClick={descargarXML} disabled={loadingXml || loading || !resumen}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 1.2rem', borderRadius: '12px', border: 'none',
                cursor: loadingXml ? 'not-allowed' : 'pointer',
                background: loadingXml ? '#94a3b8' : 'linear-gradient(135deg,#059669,#10b981)',
                color: 'white', fontWeight: '800', fontSize: '0.85rem',
                fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { if (!loadingXml) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(5,150,105,0.45)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(5,150,105,0.35)'; }}>
              {loadingXml
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Generando...</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> Descargar XML</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── AVISO EDUCATIVO GLOBAL ── */}
      <div style={{
        background: 'linear-gradient(90deg,#fffbeb,#fef3c7)',
        border: '1.5px solid #fde68a', borderRadius: '12px',
        padding: '0.7rem 1rem', marginBottom: '1.2rem',
        display: 'flex', alignItems: 'center', gap: '0.7rem',
      }}>
        <span style={{ fontSize: '1rem' }}>🏫</span>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', fontWeight: '700' }}>
          Modo Educativo — Los datos son de práctica. En la vida real el ATS se presenta al SRI antes del día 28 del mes siguiente.
        </p>
        <button
          onClick={() => { localStorage.removeItem(TOUR_KEY); setTourVisto(false); }}
          title="Ver tutorial de nuevo"
          style={{
            marginLeft: 'auto', padding: '0.3rem 0.7rem', borderRadius: '8px',
            border: '1.5px solid #fbbf24', background: 'white',
            color: '#92400e', fontSize: '0.72rem', fontWeight: '800',
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>
          📖 Ver tutorial
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.9rem 1.2rem', background: '#fef2f2', borderRadius: '12px', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{
        background: 'white', borderBottom: '2px solid #f1f5f9',
        margin: '0 0 1.2rem', padding: '0 1.2rem',
        display: 'flex', alignItems: 'flex-end', gap: '0.1rem',
        overflowX: 'auto', scrollbarWidth: 'none',
        borderRadius: '16px 16px 0 0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>
        {TABS.map(t => {
          const activo = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '0.85rem 1.1rem 0.75rem', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.8rem', whiteSpace: 'nowrap',
                transition: 'all 0.18s', background: 'transparent', marginBottom: '-2px',
                fontWeight: activo ? '800' : '600',
                color: activo ? ACCENT : '#94a3b8',
                borderBottom: activo ? `2.5px solid ${ACCENT}` : '2.5px solid transparent',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.color = '#94a3b8'; }}>
              <span>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {/* ══ TAB: RESUMEN ══ */}
      {tab === 'resumen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease' }}>

          {mostrarEdu && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <EduCard emoji="📤" titulo="¿Qué son las Ventas?" color={ACCENT}
                texto="Son las facturas que tú emitiste como vendedor. El IVA generado lo debes pagar al SRI." />
              <EduCard emoji="📥" titulo="¿Qué son las Compras?" color="#10b981"
                texto="Son los comprobantes que recibiste como comprador. El IVA soportado puedes descontarlo del IVA a pagar." />
            </div>
          )}

          {/* Banner período */}
          <div style={{
            background: `linear-gradient(135deg,#0f1f4b,${ACCENT})`,
            borderRadius: '16px', padding: '1.2rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white',
          }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: '800', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Anexo Transaccional Simplificado</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '1.3rem', fontWeight: '900' }}>{MESES[mes - 1]} {anio}</p>
              {resumen && <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', opacity: 0.7 }}>{resumen.negocio?.razon_social} · RUC {resumen.negocio?.ruc}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.6, fontWeight: '700' }}>TOTAL VENTAS</p>
              <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900' }}>{loading ? '...' : fmtMoney(resumen?.ventas?.total)}</p>
            </div>
          </div>

          {/* KPIs ventas/compras */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Ventas */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>Ventas del Período</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>Facturas finalizadas</p>
                </div>
              </div>

              {mostrarEdu && (
                <div style={{ background: EDU_BG, border: `1px solid ${EDU_BORDER}`, borderRadius: '8px', padding: '0.45rem 0.7rem', fontSize: '0.72rem', color: '#1e3a8a', fontWeight: '600', marginBottom: '0.7rem' }}>
                  💡 <strong>Base 0%</strong> = productos sin IVA (ej: alimentos básicos). <strong>Base IVA</strong> = productos con IVA.
                </div>
              )}

              {loading
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h="14px" />)}</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      { label: 'N° Comprobantes', value: resumen?.ventas?.cantidad, mono: true },
                      { label: 'Base 0%',          value: fmtMoney(resumen?.ventas?.base_0) },
                      { label: 'Base IVA',         value: fmtMoney(resumen?.ventas?.base_iva) },
                      { label: 'IVA Generado',     value: fmtMoney(resumen?.ventas?.iva), color: '#f59e0b' },
                      { label: 'Descuentos',       value: fmtMoney(resumen?.ventas?.descuento) },
                      { label: 'TOTAL VENTAS',     value: fmtMoney(resumen?.ventas?.total), bold: true, color: ACCENT },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: i < 5 ? '1px solid #f8fafc' : 'none' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: r.bold ? '800' : '600' }}>{r.label}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: r.bold ? '900' : '700', color: r.color || '#0f172a', fontFamily: r.mono ? 'monospace' : 'inherit' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            {/* Compras */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>Compras del Período</p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>Comprobantes recibidos</p>
                </div>
              </div>

              {mostrarEdu && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.45rem 0.7rem', fontSize: '0.72rem', color: '#065f46', fontWeight: '600', marginBottom: '0.7rem' }}>
                  💡 Incluye facturas, notas de crédito, notas de débito y liquidaciones que recibiste.
                </div>
              )}

              {loading
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h="14px" />)}</div>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      { label: 'N° Comprobantes', value: resumen?.compras?.cantidad, mono: true },
                      { label: 'Base 0%',         value: fmtMoney(resumen?.compras?.base_0) },
                      { label: 'Base IVA',        value: fmtMoney(resumen?.compras?.base_iva) },
                      { label: 'IVA Soportado',   value: fmtMoney(resumen?.compras?.iva), color: '#f59e0b' },
                      { label: 'TOTAL COMPRAS',   value: fmtMoney(resumen?.compras?.total), bold: true, color: '#10b981' },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: i < 4 ? '1px solid #f8fafc' : 'none' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: r.bold ? '800' : '600' }}>{r.label}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: r.bold ? '900' : '700', color: r.color || '#0f172a', fontFamily: r.mono ? 'monospace' : 'inherit' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Cálculo IVA a pagar — educativo */}
          {resumen && !loading && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: `1.5px solid ${EDU_BORDER}` }}>
              <p style={{ margin: '0 0 0.8rem', fontWeight: '800', fontSize: '0.85rem', color: ACCENT, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🧮 Cálculo educativo: IVA a pagar al SRI
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '0.5rem 0.9rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700' }}>IVA VENTAS</p>
                  <p style={{ margin: 0, fontWeight: '900', color: '#ef4444' }}>{fmtMoney(resumen.ventas?.iva)}</p>
                </div>
                <span style={{ fontSize: '1.2rem', color: '#94a3b8', fontWeight: '700' }}>−</span>
                <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '0.5rem 0.9rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700' }}>IVA COMPRAS</p>
                  <p style={{ margin: 0, fontWeight: '900', color: '#10b981' }}>{fmtMoney(resumen.compras?.iva)}</p>
                </div>
                <span style={{ fontSize: '1.2rem', color: '#94a3b8', fontWeight: '700' }}>=</span>
                <div style={{ background: ACCENT, borderRadius: '10px', padding: '0.5rem 0.9rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>A PAGAR AL SRI</p>
                  <p style={{ margin: 0, fontWeight: '900', color: 'white' }}>
                    {fmtMoney(Math.max(0, (resumen.ventas?.iva || 0) - (resumen.compras?.iva || 0)))}
                  </p>
                </div>
              </div>
              <p style={{ margin: '0.7rem 0 0', fontSize: '0.73rem', color: '#64748b', lineHeight: 1.5 }}>
                💡 <strong>IVA en ventas</strong> = lo que cobraste a tus clientes por concepto de IVA y que debes entregar al SRI. <strong>IVA en compras</strong> = lo que tú pagaste de IVA y puedes descontar. La diferencia es lo que efectivamente pagas al SRI.
              </p>
            </div>
          )}

          {/* Alerta informativa */}
          <div style={{ background: '#fffbeb', borderRadius: '12px', padding: '1rem 1.2rem', border: '1px solid #fde68a', display: 'flex', gap: '0.8rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <div>
              <p style={{ margin: 0, fontWeight: '800', fontSize: '0.82rem', color: '#92400e' }}>Importante — En la vida real</p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#78350f', lineHeight: 1.5 }}>
                El plazo de presentación del ATS al SRI es hasta el <strong>28 del mes siguiente</strong>. Se presenta en sri.gob.ec → Servicios en Línea → Declaraciones → ATS.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: VENTAS ══ */}
      {tab === 'ventas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeUp 0.3s ease' }}>
          {mostrarEdu && (
            <EduCard emoji="📤" titulo="Facturas emitidas por ti" color={ACCENT}
              texto="Estas son las facturas que TÚ generaste como vendedor durante el mes. Cada fila es un comprobante que emitiste a un cliente. El IVA de estas ventas debes pagarlo al SRI." />
          )}
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <p style={{ margin: '0 0 1rem', fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>
              Facturas Emitidas — {MESES[mes - 1]} {anio}
            </p>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h="40px" />)}</div>
            ) : ventas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>Sin facturas finalizadas en este período</div>
            ) : (
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 85px 1fr 110px 90px 90px 90px 100px', padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['Comprobante', 'Fecha', 'Cliente', 'Identificación', 'Base 0%', 'Base IVA', 'IVA', 'Total'].map(h => (
                    <span key={h} style={{ fontSize: '0.62rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</span>
                  ))}
                </div>
                {ventas.map((v, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 85px 1fr 110px 90px 90px 90px 100px', padding: '0.65rem 1rem', borderBottom: i < ventas.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', fontFamily: 'monospace' }}>{v.numero}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{fmtFecha(v.fecha)}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.cliente}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>{v.identificacion}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>{fmtMoney(v.base_0)}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>{fmtMoney(v.base_iva)}</span>
                    <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: '700', textAlign: 'right' }}>{fmtMoney(v.iva)}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0f172a', textAlign: 'right' }}>{fmtMoney(v.total)}</span>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '130px 85px 1fr 110px 90px 90px 90px 100px', padding: '0.7rem 1rem', background: '#f8faff', borderTop: '2px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '800', color: ACCENT, gridColumn: '1/5' }}>TOTALES ({ventas.length})</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155', textAlign: 'right' }}>{fmtMoney(ventas.reduce((s, v) => s + v.base_0, 0))}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155', textAlign: 'right' }}>{fmtMoney(ventas.reduce((s, v) => s + v.base_iva, 0))}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#f59e0b', textAlign: 'right' }}>{fmtMoney(ventas.reduce((s, v) => s + v.iva, 0))}</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: '900', color: ACCENT, textAlign: 'right' }}>{fmtMoney(ventas.reduce((s, v) => s + v.total, 0))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: COMPRAS ══ */}
      {tab === 'compras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeUp 0.3s ease' }}>
          {mostrarEdu && (
            <EduCard emoji="📥" titulo="Comprobantes que recibiste" color="#10b981"
              texto="Aquí aparecen las facturas, notas de crédito, notas de débito y liquidaciones que OTROS te emitieron a ti. El IVA de estas compras puedes usarlo como crédito tributario." />
          )}
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>
                Comprobantes Recibidos — {MESES[mes - 1]} {anio}
              </p>
              <span style={{ padding: '0.2rem 0.7rem', borderRadius: '99px', background: '#f0fdf4', color: '#10b981', fontSize: '0.72rem', fontWeight: '800' }}>
                {compras.length} comprobante{compras.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h="40px" />)}</div>
            ) : compras.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <span style={{ fontSize: '2.5rem' }}>📭</span>
                <p style={{ margin: '0.5rem 0 0', fontWeight: '800', color: '#64748b', fontSize: '0.9rem' }}>Sin comprobantes en este período</p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Aparecerán aquí cuando alguien te emita una factura, nota de crédito, nota de débito o liquidación.
                </p>
              </div>
            ) : (
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 80px 1fr 110px 85px 85px 90px 100px', padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {['Comprobante', 'Tipo', 'Fecha', 'Proveedor/Emisor', 'Identificación', 'Base 0%', 'Base IVA', 'IVA', 'Total'].map(h => (
                    <span key={h} style={{ fontSize: '0.62rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</span>
                  ))}
                </div>
                {compras.map((c, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 80px 80px 1fr 110px 85px 85px 90px 100px', padding: '0.65rem 1rem', borderBottom: i < compras.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', fontFamily: 'monospace' }}>{c.numero}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#6366f1', background: '#eef2ff', padding: '0.15rem 0.4rem', borderRadius: '4px', textAlign: 'center' }}>
                      {TIPO_LABEL[c.tipo] || c.tipo}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{fmtFecha(c.fecha)}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.proveedor}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>{c.identificacion}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>{fmtMoney(c.base_0)}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>{fmtMoney(c.base_iva)}</span>
                    <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: '700', textAlign: 'right' }}>{fmtMoney(c.iva)}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0f172a', textAlign: 'right' }}>{fmtMoney(c.total)}</span>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 80px 1fr 110px 85px 85px 90px 100px', padding: '0.7rem 1rem', background: '#f0fdf4', borderTop: '2px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '800', color: '#10b981', gridColumn: '1/6' }}>TOTALES ({compras.length})</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155', textAlign: 'right' }}>{fmtMoney(compras.reduce((s, c) => s + c.base_0, 0))}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#334155', textAlign: 'right' }}>{fmtMoney(compras.reduce((s, c) => s + c.base_iva, 0))}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#f59e0b', textAlign: 'right' }}>{fmtMoney(compras.reduce((s, c) => s + c.iva, 0))}</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: '900', color: '#10b981', textAlign: 'right' }}>{fmtMoney(compras.reduce((s, c) => s + c.total, 0))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: AYUDA ══ */}
      {tab === 'ayuda' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeUp 0.3s ease' }}>

          <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: `1.5px solid ${EDU_BORDER}` }}>
            <p style={{ margin: '0 0 0.9rem', fontWeight: '900', fontSize: '0.9rem', color: ACCENT, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              📚 Glosario — Términos del ATS
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              {[
                { t: 'ATS', d: 'Anexo Transaccional Simplificado. Declaración mensual de ventas y compras que se presenta al SRI.' },
                { t: 'SRI', d: 'Servicio de Rentas Internas. Es el organismo del Estado ecuatoriano que recauda impuestos.' },
                { t: 'IVA', d: 'Impuesto al Valor Agregado. En Ecuador es el 15% del precio de venta (productos gravados).' },
                { t: 'Base 0%', d: 'Valor de bienes o servicios que NO generan IVA (ej: alimentos de primera necesidad, medicamentos).' },
                { t: 'Base IVA', d: 'Valor sobre el que se calcula el IVA. Si vendes $100 con IVA, la base es $100 y el IVA $15.' },
                { t: 'Crédito Tributario', d: 'El IVA que pagaste en tus compras y que puedes restar del IVA de tus ventas.' },
                { t: 'Clave de Acceso', d: 'Código de 49 dígitos que identifica cada comprobante electrónico ante el SRI.' },
                { t: 'RUC', d: 'Registro Único de Contribuyentes. Número de 13 dígitos que identifica a una persona o empresa ante el SRI.' },
              ].map(({ t, d }) => (
                <div key={t} style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.7rem 0.85rem' }}>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '0.8rem', color: ACCENT }}>{t}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#475569', lineHeight: 1.5 }}>{d}</p>
                </div>
              ))}
            </div>
          </div>

          {[
            { titulo: '¿Qué es el ATS?', color: ACCENT, contenido: 'El Anexo Transaccional Simplificado (ATS) es una declaración informativa mensual que deben presentar los contribuyentes al SRI, detallando todas sus ventas y compras del período.' },
            { titulo: '¿Cuándo presentarlo?', color: '#10b981', contenido: 'El plazo es hasta el día 28 del mes siguiente al período declarado. Ejemplo: el ATS de enero se presenta hasta el 28 de febrero.' },
            { titulo: '¿Quiénes están obligados?', color: '#8b5cf6', contenido: 'Personas naturales obligadas a llevar contabilidad, sociedades, contribuyentes especiales y todos los que emitan comprobantes electrónicos.' },
            { titulo: 'Pasos para presentar al SRI', color: '#ef4444', contenido: '1. Genera el XML desde este módulo. 2. Ingresa a sri.gob.ec. 3. Ve a Servicios en Línea → Declaraciones. 4. Selecciona "ATS". 5. Sube el archivo XML. 6. Guarda el comprobante de envío.' },
          ].map((item, i) => (
            <div key={i} style={{ background: 'white', borderRadius: '14px', padding: '1rem 1.2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', borderLeft: `4px solid ${item.color}` }}>
              <p style={{ margin: '0 0 0.4rem', fontWeight: '800', fontSize: '0.88rem', color: item.color }}>{item.titulo}</p>
              <p style={{ margin: 0, fontSize: '0.83rem', color: '#475569', lineHeight: 1.6 }}>{item.contenido}</p>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes popIn    { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
        @keyframes tourFadeIn{ from{opacity:0} to{opacity:1} }
        @keyframes tourPopIn { from{opacity:0;transform:scale(0.93) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
};

export default GenerarAts;
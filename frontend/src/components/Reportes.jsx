import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { reportesService } from '../services/api';
import * as XLSX from 'xlsx';
import { useIsMobile } from '../hooks/useIsMobile';

const API      = 'https://factustock-efdi.onrender.com/api';
const getToken = () => localStorage.getItem('token');

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (s) => { if (!s) return '—'; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtMes   = (s) => { if (!s) return '—'; const [y, m] = s.split('-'); return new Date(y, m - 1).toLocaleDateString('es-EC', { month: 'short', year: 'numeric' }); };

const hoy        = new Date();
const inicioAnio = `${hoy.getFullYear()}-01-01`;
const finAnio    = `${hoy.getFullYear()}-12-31`;
const inicioMes  = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`;
const finMes     = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate()}`;

const Skeleton = ({ w = '100%', h = '16px', radius = '6px' }) => (
  <div style={{ width: w, height: h, borderRadius: radius, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
);

// ── Mini barra chart ─────────────────────────────────────────────────────────
const BarChart = ({ data, colorFn, labelKey, valueKey, fmtValue = v => v }) => {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', padding: '0 4px' }}>
      {data.map((d, i) => {
        const pct = Math.max((d[valueKey] / max) * 100, 2);
        const color = colorFn ? colorFn(i, d) : '#2563eb';
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}
            title={`${d[labelKey]}: ${fmtValue(d[valueKey])}`}>
            <div style={{ width: '100%', height: `${pct}%`, background: color, borderRadius: '4px 4px 0 0', transition: 'height 0.6s ease', minHeight: '4px' }} />
            <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: '700', textAlign: 'center', lineHeight: 1 }}>{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Donut chart SVG ──────────────────────────────────────────────────────────
const DonutChart = ({ segments, size = 110, stroke = 22 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ;
        const gap  = circ - dash;
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR XLSX
// ─────────────────────────────────────────────────────────────────────────────
const exportarXLSX = (rows, cols, filename, titulo) => {
  const headerRow = cols.map(c => c.label);
  const dataRows  = rows.map(r => cols.map(c => r[c.key] ?? ''));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  ws['!cols'] = cols.map(c => ({ wch: Math.max(c.label.length + 4, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, titulo || 'Reporte');
  XLSX.writeFile(wb, filename);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR PDF — CORREGIDO
// ─────────────────────────────────────────────────────────────────────────────
const exportarPDF = async (endpoint, filename) => {
  try {
    const token = getToken();

    // Validar token antes de continuar
    if (!token || token === 'null' || token === 'undefined') {
      alert('No hay sesión activa. Por favor, inicia sesión nuevamente.');
      return;
    }

    const url = `${API}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      },
    });

    // Capturar error con body descriptivo
    if (!response.ok) {
      let errorMsg = `Error ${response.status}`;
      try {
        const errorBody = await response.text();
        errorMsg += `: ${errorBody}`;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    // Verificar que la respuesta sea realmente un PDF
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('pdf')) {
      const text = await response.text();
      throw new Error(`Respuesta inesperada del servidor: ${text.substring(0, 200)}`);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error('El archivo PDF generado está vacío. Verifica los datos del período seleccionado.');
    }

    // Sanitizar nombre de archivo
    const safeFilename = filename.replace(/null|undefined/gi, 'sin-fecha');

    // Crear enlace de descarga
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);

  } catch (e) {
    console.error('[exportarPDF] Error:', e);
    alert(`No se pudo generar el PDF:\n${e.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BOTONES DE EXPORTACIÓN
// ─────────────────────────────────────────────────────────────────────────────
const BotonesExportar = ({ onXLSX, onPDF, loadingPDF }) => (
  <div style={{ display: 'flex', gap: '0.4rem' }}>
    <button onClick={onXLSX}
      style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 0.9rem', borderRadius:'10px', border:'1.5px solid #10b981', background:'white', color:'#059669', fontSize:'0.76rem', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
      onMouseEnter={e=>{e.currentTarget.style.background='#ecfdf5';}}
      onMouseLeave={e=>{e.currentTarget.style.background='white';}}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      Excel
    </button>
    <button onClick={onPDF} disabled={loadingPDF}
      style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.45rem 0.9rem', borderRadius:'10px', border:'1.5px solid #ef4444', background:'white', color:'#dc2626', fontSize:'0.76rem', fontWeight:'700', cursor: loadingPDF ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'all 0.15s', opacity: loadingPDF ? 0.6 : 1 }}
      onMouseEnter={e=>{ if(!loadingPDF) e.currentTarget.style.background='#fef2f2';}}
      onMouseLeave={e=>{e.currentTarget.style.background='white';}}>
      {loadingPDF
        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:'spin 1s linear infinite'}}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
      }
      {loadingPDF ? 'Generando…' : 'PDF'}
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/* ════════════════════════════════════════════════════════
   TOUR — Reportes y Estadísticas | key: rep_tour_visto
════════════════════════════════════════════════════════ */
const getTOUR_KEY_REP = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `rep-tour-${uid}`;
  } catch { return 'rep-tour'; }
};
const TOUR_KEY_REP = getTOUR_KEY_REP();

const TourBienvenida_REP = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📊', titulo: '¿Qué son los Reportes?', texto: 'Resúmenes y análisis de tus ventas, compras, clientes y productos. Te ayudan a entender el desempeño del negocio basado en los datos reales registrados en el sistema.' },
    { emoji: '📅', titulo: 'Filtros de Fecha', texto: 'Usa los selectores de período: hoy, esta semana, este mes, este año o rango personalizado. Los reportes se actualizan automáticamente al cambiar el filtro, sin recargar la página.' },
    { emoji: '📈', titulo: 'Tipos de Reporte', texto: 'Resumen general de ventas, ingresos por mes, top clientes, top productos más vendidos, libro de ventas y detalle de IVA por período fiscal. Cada pestaña muestra un análisis diferente.' },
    { emoji: '⬇️', titulo: 'Exportar a Excel', texto: 'Cada reporte tiene un botón de descarga que genera un archivo .xlsx con todos los datos del período seleccionado, listo para análisis externo o presentación al docente.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'En un negocio real, estos reportes son la base para la contabilidad, las declaraciones al SRI y la toma de decisiones. Aprende a leerlos e interpretarlos con datos de práctica.' },
  ];
  const [paso, setPaso] = React.useState(0);
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
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>REPORTES Y ESTADÍSTICAS</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            Análisis y reportes<br />
            <span style={{ color: '#93c5fd' }}>de tu negocio</span>
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
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', flexShrink: 0 }}>{actual.emoji}</div>
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


const BarraModoEdu_REP = ({ onVerTutorial }) => (
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
const BannerEdu_REP = ({ onClose, onVerTutorial }) => (
  <div style={{
    marginBottom: '1rem', background: 'linear-gradient(135deg,#f0f7ff,#e0f2fe)',
    border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '0.85rem 1.2rem',
    display: 'flex', alignItems: 'center', gap: '0.85rem', animation: 'tourFadeIn 0.3s ease',
  }}>
    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🎓</div>
    <div style={{ flex: 1 }}>
      <p style={{ margin: 0, fontWeight: '900', fontSize: '0.82rem', color: '#1d4ed8' }}>Modo Educativo Activo</p>
      <p style={{ margin: '0.1rem 0 0', fontSize: '0.76rem', color: '#3b82f6', lineHeight: 1.4 }}>Primera visita al módulo. Los datos son de práctica, explora sin miedo.</p>
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.2rem', display: 'flex', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
);

const Reportes = () => {
  const isMobile = useIsMobile();

  // ── Tour educativo primera visita ──────────────────────────────
  const [tourVisto_REP, setTourVisto_REP] = useState(
    () => !!localStorage.getItem(TOUR_KEY_REP)
  );
  const [mostrarEdu_REP, setMostrarEdu_REP] = useState(false);
  const cerrarTour_REP = () => {
    localStorage.setItem(TOUR_KEY_REP, '1');
    setTourVisto_REP(true);
    setMostrarEdu_REP(true);
    setTimeout(() => setMostrarEdu_REP(false), 30000);
  };
  const verTutorial_REP = () => {
    localStorage.removeItem(TOUR_KEY_REP);
    setTourVisto_REP(false);
    setMostrarEdu_REP(false);
  };
  const [tab,         setTab]         = useState('ventas');
  const [fechaDesde,  setFechaDesde]  = useState(inicioAnio);
  const [fechaHasta,  setFechaHasta]  = useState(finAnio);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [loadingPDF,  setLoadingPDF]  = useState(null);

  const [resumen,       setResumen]       = useState(null);
  const [porMes,        setPorMes]        = useState([]);
  const [topClientes,   setTopClientes]   = useState([]);
  const [topProductos,  setTopProductos]  = useState([]);
  const [facturasList,  setFacturasList]  = useState([]);
  const [estadosDist,   setEstadosDist]   = useState([]);
  const [ivaResumen,    setIvaResumen]    = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [resumenData, mesesData, clientesData, productosData, libroData, ivaData] = await Promise.all([
        reportesService.resumenGeneral({ fechaDesde, fechaHasta }),
        reportesService.ventasPorMes({ fechaDesde, fechaHasta }),
        reportesService.topClientes({ fechaDesde, fechaHasta }),
        reportesService.topProductos({ fechaDesde, fechaHasta }),
        reportesService.libroVentas({ fechaDesde, fechaHasta, porPagina: 200 }),
        reportesService.ivaDetalle({ fechaDesde, fechaHasta }),
      ]);

      setResumen({
        totalVentas:     resumenData.total_ventas,
        totalSub0:       resumenData.subtotal_0,
        totalSubIva:     resumenData.subtotal_iva,
        totalIva:        resumenData.iva_generado,
        ticketPromedio:  resumenData.ticket_promedio,
        cantFinalizadas: resumenData.finalizadas,
        cantBorradores:  resumenData.borradores,
        cantAnuladas:    resumenData.anuladas,
        cantTodas:       resumenData.total_comprobantes,
      });
      setEstadosDist([
        { label: 'Finalizadas', value: resumenData.finalizadas, color: '#10b981' },
        { label: 'Borradores',  value: resumenData.borradores,  color: '#f59e0b' },
        { label: 'Anuladas',    value: resumenData.anuladas,    color: '#ef4444' },
      ]);
      setPorMes((mesesData.items || []).map(m => ({ ...m, label: fmtMes(m.mes) })));
      setTopClientes(clientesData.items || []);
      setTopProductos(productosData.items || []);
      setFacturasList(libroData.items || []);
      const iv = ivaData.resumen || {};
      setIvaResumen({ totalSub0: iv.base_0, totalSubIva: iv.base_iva, totalIva: iv.iva_generado, totalVentas: iv.total_ventas });
    } catch {
      setError('No se pudieron cargar los datos. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const setPeriodo = (p) => {
    const h = new Date();
    if (p === 'mes')  { setFechaDesde(inicioMes); setFechaHasta(finMes); }
    if (p === 'anio') { setFechaDesde(inicioAnio); setFechaHasta(finAnio); }
    if (p === 'trim') {
      const t = Math.floor(h.getMonth() / 3);
      const desde = new Date(h.getFullYear(), t * 3, 1);
      const hasta  = new Date(h.getFullYear(), t * 3 + 3, 0);
      setFechaDesde(desde.toISOString().substring(0,10));
      setFechaHasta(hasta.toISOString().substring(0,10));
    }
    if (p === 'sem') {
      const s = new Date(h); s.setDate(h.getDate() - 182);
      setFechaDesde(s.toISOString().substring(0,10));
      setFechaHasta(h.toISOString().substring(0,10));
    }
  };

  // ── Handlers exportación ──────────────────────────────────────────────────
  const handleExportClientesXLSX = () => {
    exportarXLSX(
      topClientes.map((c, i) => ({ pos: i+1, nombre: c.nombre, identificacion: c.identificacion, facturas: c.facturas, total: parseFloat(c.total).toFixed(2) })),
      [{ key:'pos', label:'#' }, { key:'nombre', label:'Cliente' }, { key:'identificacion', label:'Identificación' }, { key:'facturas', label:'Facturas' }, { key:'total', label:'Total ($)' }],
      `clientes_${fechaDesde}_${fechaHasta}.xlsx`, 'Top Clientes'
    );
  };

  const handleExportClientesPDF = async () => {
    setLoadingPDF('clientes');
    await exportarPDF(
      `/reportes/exportar/clientes/pdf?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`,
      `clientes_${fechaDesde}_${fechaHasta}.pdf`
    );
    setLoadingPDF(null);
  };

  const handleExportProductosXLSX = () => {
    exportarXLSX(
      topProductos.map((p, i) => ({ pos: i+1, nombre: p.nombre, codigo: p.codigo, cantidad: parseFloat(p.cantidad_vendida || p.cantidad || 0).toFixed(0), facturas: `${p.num_facturas || p.facturas} fact.`, total: parseFloat(p.total).toFixed(2) })),
      [{ key:'pos', label:'#' }, { key:'nombre', label:'Producto/Servicio' }, { key:'codigo', label:'Código' }, { key:'cantidad', label:'Cant. Vendida' }, { key:'facturas', label:'Aparece en' }, { key:'total', label:'Total ($)' }],
      `productos_${fechaDesde}_${fechaHasta}.xlsx`, 'Top Productos'
    );
  };

  const handleExportProductosPDF = async () => {
    setLoadingPDF('productos');
    await exportarPDF(
      `/reportes/exportar/productos/pdf?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`,
      `productos_${fechaDesde}_${fechaHasta}.pdf`
    );
    setLoadingPDF(null);
  };

  const handleExportLibroXLSX = () => {
    exportarXLSX(
      facturasList.map(f => ({
        numero:  f.numero_comprobante || '—',
        fecha:   f.fecha_emision || '—',
        cliente: f.cliente?.nombres_apellidos || f.cliente?.razon_social || f.cliente_nombre || '—',
        ruc:     f.cliente?.identificacion || f.cliente_ruc || '—',
        sub0:    parseFloat(f.subtotal_0   || 0).toFixed(2),
        subiva:  parseFloat(f.subtotal_iva || 0).toFixed(2),
        iva:     parseFloat(f.iva          || 0).toFixed(2),
        total:   parseFloat(f.total        || 0).toFixed(2),
      })),
      [
        { key:'numero',  label:'Comprobante' },
        { key:'fecha',   label:'Fecha' },
        { key:'cliente', label:'Cliente' },
        { key:'ruc',     label:'RUC/Cédula' },
        { key:'sub0',    label:'Base 0% ($)' },
        { key:'subiva',  label:'Base IVA ($)' },
        { key:'iva',     label:'IVA ($)' },
        { key:'total',   label:'Total ($)' },
      ],
      `libro_ventas_${fechaDesde}_${fechaHasta}.xlsx`, 'Libro de Ventas'
    );
  };

  const handleExportLibroPDF = async () => {
    setLoadingPDF('libro');
    await exportarPDF(
      `/reportes/exportar/libro-ventas/pdf?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`,
      `libro_ventas_${fechaDesde}_${fechaHasta}.pdf`
    );
    setLoadingPDF(null);
  };

  const handleExportIvaXLSX = () => {
    exportarXLSX(
      [
        { casilla: '401', descripcion: 'Ventas locales tarifa 0%',        valor: parseFloat(ivaResumen?.totalSub0   || 0).toFixed(2) },
        { casilla: '411', descripcion: 'Ventas locales tarifa 15%',        valor: parseFloat(ivaResumen?.totalSubIva || 0).toFixed(2) },
        { casilla: '421', descripcion: 'IVA en ventas',                    valor: parseFloat(ivaResumen?.totalIva    || 0).toFixed(2) },
        { casilla: '499', descripcion: 'Total ventas y otras operaciones', valor: parseFloat(ivaResumen?.totalVentas || 0).toFixed(2) },
      ],
      [{ key:'casilla', label:'Casilla' }, { key:'descripcion', label:'Descripción' }, { key:'valor', label:'Valor ($)' }],
      `iva_${fechaDesde}_${fechaHasta}.xlsx`, 'Resumen IVA'
    );
  };

  const handleExportIvaPDF = async () => {
    setLoadingPDF('iva');
    await exportarPDF(
      `/reportes/exportar/iva/pdf?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`,
      `iva_${fechaDesde}_${fechaHasta}.pdf`
    );
    setLoadingPDF(null);
  };

  const TABS = [
    { id: 'ventas',    label: 'Ventas',          icon: '📈' },
    { id: 'iva',       label: 'IVA',             icon: '🧾' },
    { id: 'clientes',  label: 'Clientes',        icon: '👥' },
    { id: 'productos', label: 'Productos',       icon: '📦' },
    { id: 'facturas',  label: 'Libro de Ventas', icon: '📋' },
  ];

  const ACCENT  = '#15389a';
  const ACCENT2 = '#2563eb';

  return (
    <div style={{ padding: isMobile ? '1rem 0.85rem' : '1.4rem 1.5rem', fontFamily: "'Nunito','Segoe UI',system-ui,sans-serif", animation: 'fadeUp 0.3s ease both' }}>
      {!tourVisto_REP && <TourBienvenida_REP onCerrar={cerrarTour_REP} />}
      {mostrarEdu_REP && <BannerEdu_REP onClose={() => setMostrarEdu_REP(false)} onVerTutorial={verTutorial_REP} />}
      <BarraModoEdu_REP onVerTutorial={verTutorial_REP} />


      {/* ── FILTRO DE PERÍODO ── */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '1rem 1.2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>Período</span>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[{k:'mes',l:'Este mes'},{k:'trim',l:'Trimestre'},{k:'sem',l:'Semestre'},{k:'anio',l:'Este año'}].map(p => (
            <button key={p.k} onClick={() => setPeriodo(p.k)}
              style={{ padding: '0.35rem 0.8rem', borderRadius: '99px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.76rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(90deg,#15389a,#2563eb)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#2563eb'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
              {p.l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Desde</span>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
            style={{ padding: '0.4rem 0.7rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8rem', color: '#334155', fontFamily: 'inherit', outline: 'none' }} />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>Hasta</span>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
            style={{ padding: '0.4rem 0.7rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8rem', color: '#334155', fontFamily: 'inherit', outline: 'none' }} />
          <button
            onClick={() => {
              if (tab === 'iva')       handleExportIvaXLSX();
              else if (tab === 'clientes')  handleExportClientesXLSX();
              else if (tab === 'productos') handleExportProductosXLSX();
              else                         handleExportLibroXLSX();
            }}
            title="Exportar reporte actual a Excel"
            style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.4rem 0.85rem', borderRadius:'10px', border:'1.5px solid #10b981', background:'white', color:'#059669', fontSize:'0.76rem', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background='#ecfdf5'; e.currentTarget.style.borderColor='#059669'; }}
            onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='#10b981'; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Exportar período
          </button>

        </div>
      </div>

      {/* ── CALLOUT EDUCATIVO ── */}
      <div style={{ marginBottom: '1.2rem', padding: '0.75rem 1rem', background: 'linear-gradient(135deg,#f0f7ff,#eff6ff)', border: '1.5px solid #bfdbfe', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>🎓</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', color: '#1d4ed8' }}>¿Para qué sirven estos reportes en la práctica real?</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.73rem', color: '#3b82f6', lineHeight: 1.6 }}>
            <strong>IVA:</strong> base para el <strong>Formulario 104</strong> que se declara al SRI cada mes. &nbsp;
            <strong>Ventas:</strong> alimenta el <strong>ATS mensual</strong> (Anexo Transaccional Simplificado). &nbsp;
            <strong>Productos / Clientes:</strong> análisis de rentabilidad para la contabilidad. Los períodos cerrados no cambian — lo que ves es lo que se declara.
          </p>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ background: 'white', borderBottom: '2px solid #f1f5f9', margin: '0 0 1.4rem', padding: '0 1.2rem', display: 'flex', alignItems: 'flex-end', gap: '0.1rem', overflowX: 'auto', scrollbarWidth: 'none', borderRadius: '16px 16px 0 0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        {TABS.map(t => {
          const activo = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '0.85rem 1.1rem 0.75rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: activo ? '800' : '600', whiteSpace: 'nowrap', transition: 'all 0.18s', background: 'transparent', color: activo ? ACCENT : '#94a3b8', borderBottom: activo ? `2.5px solid ${ACCENT}` : '2.5px solid transparent', marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.color = '#94a3b8'; }}>
              <span>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>

      {error && <div style={{ padding: '1rem 1.2rem', background: '#fef2f2', borderRadius: '12px', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1.2rem' }}>⚠️ {error}</div>}

      {/* ══════════════════════════════════════════════════
          TAB: VENTAS
      ══════════════════════════════════════════════════ */}
      {tab === 'ventas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '1rem' }}>
            {loading ? Array.from({length:4}).map((_,i) => (
              <div key={i} style={{ background:'white', borderRadius:'16px', padding:'1rem 1.2rem', boxShadow:'0 2px 12px rgba(0,0,0,0.05)' }}><Skeleton h="14px" w="60%" /><div style={{marginTop:'0.5rem'}}><Skeleton h="28px" w="80%" /></div></div>
            )) : [
              { label: 'Total Facturado',   value: fmtMoney(resumen?.totalVentas),    color: ACCENT,    bg: '#eff6ff',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
              { label: 'Fact. Finalizadas', value: resumen?.cantFinalizadas,          color: '#10b981', bg: '#ecfdf5',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
              { label: 'Ticket Promedio',   value: fmtMoney(resumen?.ticketPromedio), color: '#8b5cf6', bg: '#f5f3ff',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> },
              { label: 'Total IVA',         value: fmtMoney(resumen?.totalIva),       color: '#f59e0b', bg: '#fffbeb',  icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
            ].map((s, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '1rem 1.2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0.9rem', animation: `fadeUp 0.4s ease ${i*0.07}s both` }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</p>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '1.2rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px' }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0 0 1rem', fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>Ventas por Mes</p>
              {loading ? <Skeleton h="120px" /> : porMes.length === 0
                ? <div style={{ textAlign:'center', padding:'2rem', color:'#94a3b8', fontSize:'0.85rem' }}>Sin datos en el período</div>
                : <BarChart data={porMes} labelKey="label" valueKey="total" fmtValue={fmtMoney} colorFn={(i) => `hsl(${220 + i * 8}, ${70 - i * 2}%, ${45 + i * 2}%)`} />
              }
            </div>
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0 0 1rem', fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>Distribución por Estado</p>
              {loading ? <Skeleton h="110px" radius="50%" w="110px" /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <DonutChart segments={estadosDist} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a' }}>{resumen?.cantTodas || 0}</span>
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: '700' }}>total</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                    {estadosDist.map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                          <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#475569' }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0f172a' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!loading && porMes.length > 0 && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0 0 1rem', fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>Cantidad de Facturas por Mes</p>
              <BarChart data={porMes} labelKey="label" valueKey="cantidad" fmtValue={v => `${v} facturas`}
                colorFn={(i) => i === porMes.length - 1 ? ACCENT : '#bfdbfe'} />
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: IVA
      ══════════════════════════════════════════════════ */}
      {tab === 'iva' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '1rem' }}>
            {loading ? Array.from({length:3}).map((_,i)=>(
              <div key={i} style={{background:'white',borderRadius:'16px',padding:'1rem 1.2rem',boxShadow:'0 2px 12px rgba(0,0,0,0.05)'}}><Skeleton h="14px" w="60%"/><div style={{marginTop:'0.5rem'}}><Skeleton h="28px" w="80%"/></div></div>
            )) : [
              { label: 'Base Imponible 0%',  value: fmtMoney(ivaResumen?.totalSub0),   color: '#64748b', bg: '#f8fafc', desc: 'Ventas gravadas con tarifa 0%' },
              { label: 'Base Imponible IVA', value: fmtMoney(ivaResumen?.totalSubIva), color: ACCENT,    bg: '#eff6ff', desc: 'Base para cálculo de IVA' },
              { label: 'IVA Generado',       value: fmtMoney(ivaResumen?.totalIva),    color: '#f59e0b', bg: '#fffbeb', desc: 'IVA cobrado en ventas' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '1.2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', borderLeft: `4px solid ${s.color}`, animation: `fadeUp 0.4s ease ${i*0.07}s both` }}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</p>
                <p style={{ margin: '0 0 0.3rem', fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>{s.value}</p>
                <p style={{ margin: 0, fontSize: '0.73rem', color: '#94a3b8' }}>{s.desc}</p>
              </div>
            ))}
          </div>

          {!loading && porMes.length > 0 && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0 0 1rem', fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>IVA Generado por Mes</p>
              <BarChart data={porMes} labelKey="label" valueKey="iva" fmtValue={fmtMoney} colorFn={() => '#f59e0b'} />
            </div>
          )}

          {!loading && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>Resumen para Declaración IVA</p>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.2rem 0.7rem', borderRadius: '99px', fontWeight: '700', display: 'inline-block', marginTop: '0.25rem' }}>Formulario 104 referencial</span>
                </div>
                <BotonesExportar onXLSX={handleExportIvaXLSX} onPDF={handleExportIvaPDF} loadingPDF={loadingPDF === 'iva'} />
              </div>
              <div style={{ overflowX: 'auto' }}>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden', minWidth: '420px' }}>
                {[
                  { casilla: '401', desc: 'Ventas locales (excluye activos fijos) tarifa 0%',  valor: ivaResumen?.totalSub0,   color: '#64748b' },
                  { casilla: '411', desc: 'Ventas locales (excluye activos fijos) tarifa 15%', valor: ivaResumen?.totalSubIva, color: ACCENT },
                  { casilla: '421', desc: 'IVA en ventas',                                      valor: ivaResumen?.totalIva,    color: '#f59e0b' },
                  { casilla: '499', desc: 'Total ventas y otras operaciones',                   valor: ivaResumen?.totalVentas, color: '#0f172a', bold: true },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px', padding: '0.75rem 1rem', borderBottom: i < 3 ? '1px solid #f8fafc' : 'none', alignItems: 'center', background: r.bold ? '#f8faff' : 'white' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', fontFamily: 'monospace' }}>{r.casilla}</span>
                    <span style={{ fontSize: '0.84rem', color: '#334155', fontWeight: r.bold ? '800' : '600' }}>{r.desc}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: '900', color: r.color, textAlign: 'right' }}>{fmtMoney(r.valor)}</span>
                  </div>
                ))}
              </div>
              </div>{/* cierre overflowX */}
              <p style={{ margin: '0.7rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>⚠️ Valores referenciales basados en facturas finalizadas. Consulta a tu contador para la declaración oficial.</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: CLIENTES
      ══════════════════════════════════════════════════ */}
      {tab === 'clientes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>Top Clientes por Facturación</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Basado en facturas finalizadas del período</p>
              </div>
              <BotonesExportar onXLSX={handleExportClientesXLSX} onPDF={handleExportClientesPDF} loadingPDF={loadingPDF === 'clientes'} />
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>{Array.from({length:5}).map((_,i)=><Skeleton key={i} h="44px" />)}</div>
            ) : topClientes.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#94a3b8', fontSize:'0.85rem' }}>Sin datos en el período</div>
            ) : (
              <>
                <div style={{ marginBottom: '1.2rem' }}>
                  {topClientes.slice(0,5).map((c, i) => {
                    const pct = (c.total / (topClientes[0]?.total || 1)) * 100;
                    const colors = [ACCENT, '#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa'];
                    return (
                      <div key={c.id_persona || i} style={{ marginBottom: '0.6rem' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.2rem' }}>
                          <span style={{ fontSize:'0.78rem', fontWeight:'700', color:'#0f172a' }}>{i+1}. {c.nombre}</span>
                          <span style={{ fontSize:'0.78rem', fontWeight:'800', color: colors[i] }}>{fmtMoney(c.total)}</span>
                        </div>
                        <div style={{ height:'6px', background:'#f1f5f9', borderRadius:'99px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: colors[i], borderRadius:'99px', transition:'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ overflowX: 'auto' }}>
                <div style={{ border:'1px solid #f1f5f9', borderRadius:'12px', overflow:'hidden', minWidth: '480px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'2rem 1fr 140px 80px 120px', padding:'0.5rem 1rem', background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                    {['#','Cliente','Identificación','Fact.','Total'].map(h=><span key={h} style={{fontSize:'0.66rem',fontWeight:'800',color:'#94a3b8',textTransform:'uppercase'}}>{h}</span>)}
                  </div>
                  {topClientes.map((c, i) => (
                    <div key={c.id_persona || i} style={{ display:'grid', gridTemplateColumns:'2rem 1fr 140px 80px 120px', padding:'0.7rem 1rem', borderBottom: i<topClientes.length-1?'1px solid #f8fafc':'none', background: i%2===0?'white':'#fafafa', alignItems:'center' }}>
                      <span style={{ fontSize:'0.75rem', fontWeight:'800', color:'#94a3b8' }}>{i+1}</span>
                      <span style={{ fontSize:'0.84rem', fontWeight:'700', color:'#0f172a' }}>{c.nombre}</span>
                      <span style={{ fontSize:'0.78rem', color:'#64748b', fontFamily:'monospace' }}>{c.identificacion}</span>
                      <span style={{ fontSize:'0.82rem', color:'#64748b', fontWeight:'600' }}>{c.facturas}</span>
                      <span style={{ fontSize:'0.88rem', fontWeight:'800', color: ACCENT }}>{fmtMoney(c.total)}</span>
                    </div>
                  ))}
                </div>
                </div>{/* cierre overflowX */}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: PRODUCTOS
      ══════════════════════════════════════════════════ */}
      {tab === 'productos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>Productos / Servicios más Vendidos</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Por monto total en facturas finalizadas</p>
              </div>
              <BotonesExportar onXLSX={handleExportProductosXLSX} onPDF={handleExportProductosPDF} loadingPDF={loadingPDF === 'productos'} />
            </div>

            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>{Array.from({length:5}).map((_,i)=><Skeleton key={i} h="44px"/>)}</div>
            ) : topProductos.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#94a3b8', fontSize:'0.85rem' }}>
                <p style={{ margin: 0, fontWeight: '800', color: '#64748b' }}>Sin datos de productos en este período</p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem' }}>Los productos aparecerán cuando las facturas tengan líneas de detalle.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1.2rem' }}>
                  {topProductos.slice(0,5).map((p, i) => {
                    const pct = (p.total / (topProductos[0]?.total || 1)) * 100;
                    const colors = ['#10b981','#0ea5e9','#6366f1','#f59e0b','#ec4899'];
                    return (
                      <div key={p.id_producto || i} style={{ marginBottom:'0.6rem' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.2rem' }}>
                          <span style={{ fontSize:'0.78rem', fontWeight:'700', color:'#0f172a' }}>{i+1}. {p.nombre}</span>
                          <span style={{ fontSize:'0.78rem', fontWeight:'800', color: colors[i] }}>{fmtMoney(p.total)}</span>
                        </div>
                        <div style={{ height:'6px', background:'#f1f5f9', borderRadius:'99px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:colors[i], borderRadius:'99px', transition:'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ overflowX: 'auto' }}>
                <div style={{ border:'1px solid #f1f5f9', borderRadius:'12px', overflow:'hidden', minWidth: '460px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'2rem 1fr 80px 100px 120px', padding:'0.5rem 1rem', background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                    {['#','Producto/Servicio','Cant.','En facturas','Total'].map(h=><span key={h} style={{fontSize:'0.66rem',fontWeight:'800',color:'#94a3b8',textTransform:'uppercase'}}>{h}</span>)}
                  </div>
                  {topProductos.map((p,i) => (
                    <div key={p.id_producto || i} style={{ display:'grid', gridTemplateColumns:'2rem 1fr 80px 100px 120px', padding:'0.7rem 1rem', borderBottom: i<topProductos.length-1?'1px solid #f8fafc':'none', background:i%2===0?'white':'#fafafa', alignItems:'center' }}>
                      <span style={{ fontSize:'0.75rem', fontWeight:'800', color:'#94a3b8' }}>{i+1}</span>
                      <span style={{ fontSize:'0.84rem', fontWeight:'700', color:'#0f172a' }}>{p.nombre}</span>
                      <span style={{ fontSize:'0.82rem', color:'#64748b', fontWeight:'600' }}>{parseFloat(p.cantidad_vendida || p.cantidad || 0).toFixed(0)}</span>
                      <span style={{ fontSize:'0.82rem', color:'#64748b' }}>{p.num_facturas || p.facturas} fact.</span>
                      <span style={{ fontSize:'0.88rem', fontWeight:'800', color:'#10b981' }}>{fmtMoney(p.total)}</span>
                    </div>
                  ))}
                </div>
                </div>{/* cierre overflowX */}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: LIBRO DE VENTAS
      ══════════════════════════════════════════════════ */}
      {tab === 'facturas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <p style={{ margin:0, fontWeight:'800', fontSize:'0.9rem', color:'#0f172a' }}>Libro de Ventas</p>
                <p style={{ margin:0, fontSize:'0.75rem', color:'#94a3b8' }}>{facturasList.length} facturas finalizadas en el período</p>
              </div>
              <BotonesExportar onXLSX={handleExportLibroXLSX} onPDF={handleExportLibroPDF} loadingPDF={loadingPDF === 'libro'} />
            </div>

            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>{Array.from({length:8}).map((_,i)=><Skeleton key={i} h="40px"/>)}</div>
            ) : facturasList.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#94a3b8', fontSize:'0.85rem' }}>Sin facturas finalizadas en el período seleccionado</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <div style={{ border:'1px solid #f1f5f9', borderRadius:'12px', overflow:'hidden', minWidth: '820px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'140px 90px 1fr 120px 100px 100px 100px 110px', padding:'0.55rem 1rem', background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                  {['Comprobante','Fecha','Cliente','RUC/Cédula','Base 0%','Base IVA','IVA','Total'].map(h=>(
                    <span key={h} style={{fontSize:'0.62rem',fontWeight:'800',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.4px'}}>{h}</span>
                  ))}
                </div>
                {facturasList.map((f, i) => (
                  <div key={f.id_factura} style={{ display:'grid', gridTemplateColumns:'140px 90px 1fr 120px 100px 100px 100px 110px', padding:'0.65rem 1rem', borderBottom: i<facturasList.length-1?'1px solid #f8fafc':'none', background:i%2===0?'white':'#fafafa', alignItems:'center' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:'700', color:'#64748b', fontFamily:'monospace' }}>{f.numero_comprobante||'—'}</span>
                    <span style={{ fontSize:'0.76rem', color:'#64748b' }}>{fmtFecha(f.fecha_emision)}</span>
                    <span style={{ fontSize:'0.82rem', fontWeight:'700', color:'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.cliente?.nombres_apellidos||f.cliente?.razon_social||f.cliente_nombre||'—'}</span>
                    <span style={{ fontSize:'0.72rem', color:'#94a3b8', fontFamily:'monospace' }}>{f.cliente?.identificacion||f.cliente_ruc||'—'}</span>
                    <span style={{ fontSize:'0.8rem', color:'#64748b', textAlign:'right' }}>{fmtMoney(f.subtotal_0)}</span>
                    <span style={{ fontSize:'0.8rem', color:'#64748b', textAlign:'right' }}>{fmtMoney(f.subtotal_iva)}</span>
                    <span style={{ fontSize:'0.8rem', color:'#f59e0b', fontWeight:'700', textAlign:'right' }}>{fmtMoney(f.iva)}</span>
                    <span style={{ fontSize:'0.85rem', fontWeight:'800', color:'#0f172a', textAlign:'right' }}>{fmtMoney(f.total)}</span>
                  </div>
                ))}
                <div style={{ display:'grid', gridTemplateColumns:'140px 90px 1fr 120px 100px 100px 100px 110px', padding:'0.75rem 1rem', background:'#f8faff', borderTop:'2px solid #e2e8f0' }}>
                  <span style={{ fontSize:'0.76rem', fontWeight:'800', color:ACCENT, gridColumn:'1/5' }}>TOTALES ({facturasList.length} facturas)</span>
                  <span style={{ fontSize:'0.85rem', fontWeight:'800', color:'#334155', textAlign:'right' }}>{fmtMoney(facturasList.reduce((s,f)=>s+parseFloat(f.subtotal_0||0),0))}</span>
                  <span style={{ fontSize:'0.85rem', fontWeight:'800', color:'#334155', textAlign:'right' }}>{fmtMoney(facturasList.reduce((s,f)=>s+parseFloat(f.subtotal_iva||0),0))}</span>
                  <span style={{ fontSize:'0.85rem', fontWeight:'800', color:'#f59e0b', textAlign:'right' }}>{fmtMoney(facturasList.reduce((s,f)=>s+parseFloat(f.iva||0),0))}</span>
                  <span style={{ fontSize:'0.9rem', fontWeight:'900', color:ACCENT, textAlign:'right' }}>{fmtMoney(facturasList.reduce((s,f)=>s+parseFloat(f.total||0),0))}</span>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
};

export default Reportes;
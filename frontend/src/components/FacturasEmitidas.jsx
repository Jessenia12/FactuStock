import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import ReactDOM from 'react-dom';
import { createPortal } from 'react-dom';
import { AppContext } from '../context/AppContext';

/* ════════════════════════════════════════════════════════
   CONSTANTES GLOBALES
════════════════════════════════════════════════════════ */
const API          = 'https://factustock-efdi.onrender.com';
const BLUE         = '#0f1f4b';
const BLUE_MID     = '#15389a';
const BLUE_LIGHTER = '#eff6ff';
const COLORS_AVATAR = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#14b8a6','#f97316'];

const getToken = () => localStorage.getItem('token');
const hdrs     = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

const buildLogoUrl = (src) => {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  return `${API}${src.startsWith('/') ? '' : '/'}${src}`;
};

const fmtMoney = (v) => {
  const n = Number(v) || 0;
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

const fmtFecha = (f) => {
  if (!f) return '—';
  try {
    const d = new Date(f + (f.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return f; }
};

/* ════════════════════════════════════════════════════════
   TABS CONFIG
════════════════════════════════════════════════════════ */
const TABS = [
  {
    id: 'factura',
    label: 'Facturas',
    endpoint: '/api/facturas/',
    textColor: '#2563eb',
    descargas: ['xml','pdf'],
    estadoMap: {
      finalizada: { label: 'Finalizada', color: '#059669', bg: '#ecfdf5' },
      borrador:   { label: 'Borrador',   color: '#d97706', bg: '#fffbeb' },
      anulada:    { label: 'Anulada',    color: '#dc2626', bg: '#fef2f2' },
      anulado:    { label: 'Anulada',    color: '#dc2626', bg: '#fef2f2' },
    },
  },
  {
    id: 'nota_credito',
    label: 'Notas de Crédito',
    endpoint: '/api/notas-credito/',
    textColor: '#059669',
    descargas: ['xml','pdf'],
    estadoMap: {
      emitida: { label: 'Emitida', color: '#059669', bg: '#ecfdf5' },
      anulada: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
      anulado: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
    },
  },
  {
    id: 'nota_debito',
    label: 'Notas de Débito',
    endpoint: '/api/notas-debito/',
    textColor: '#7c3aed',
    descargas: ['xml','pdf'],
    estadoMap: {
      emitida: { label: 'Emitida', color: '#059669', bg: '#ecfdf5' },
      anulada: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
      anulado: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
    },
  },
  {
    id: 'retencion',
    label: 'Retenciones',
    endpoint: '/api/retenciones/',
    textColor: '#d97706',
    descargas: ['xml','pdf'],
    estadoMap: {
      emitida: { label: 'Emitida', color: '#059669', bg: '#ecfdf5' },
      anulada: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
      anulado: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
    },
  },
  {
    id: 'liquidacion',
    label: 'Liquidaciones',
    endpoint: '/api/liquidaciones/',
    textColor: '#be185d',
    descargas: ['xml','pdf'],
    estadoMap: {
      emitida: { label: 'Emitida', color: '#059669', bg: '#ecfdf5' },
      anulada: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
      anulado: { label: 'Anulada', color: '#dc2626', bg: '#fef2f2' },
    },
  },
  {
    id: 'proforma',
    label: 'Proformas',
    endpoint: '/api/proformas/',
    textColor: '#4f46e5',
    descargas: ['pdf'],
    estadoMap: {
      cotizada:           { label: 'Cotizada',   color: '#6366f1', bg: '#e0e7ff' },
      aceptada:           { label: 'Aceptada',   color: '#059669', bg: '#ecfdf5' },
      rechazada:          { label: 'Rechazada',  color: '#dc2626', bg: '#fef2f2' },
      convertida_factura: { label: 'Convertida', color: '#0284c7', bg: '#e0f2fe' },
    },
  },
];

/* ════════════════════════════════════════════════════════
   SUBCOMPONENTES UI
════════════════════════════════════════════════════════ */

const Skeleton = ({ h = '14px', w = '100%', radius = '6px' }) => (
  <div style={{
    height: h, width: w, borderRadius: radius,
    background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    flexShrink: 0,
  }} />
);

const PaginBtn = ({ children, onClick, disabled, active }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid',
      borderColor: active ? BLUE_MID : disabled ? '#f1f5f9' : '#e2e8f0',
      background: active ? `linear-gradient(135deg,${BLUE},${BLUE_MID})` : disabled ? '#fafafa' : 'white',
      color: active ? 'white' : disabled ? '#cbd5e1' : '#64748b',
      fontSize: '0.78rem', fontWeight: '700', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', fontFamily: 'inherit',
    }}
  >{children}</button>
);

const RANGOS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes',    label: 'Este mes' },
  { key: 'custom', label: 'Personalizado' },
];

const calcRango = (key) => {
  const hoy = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  if (key === 'hoy')    return { desde: fmt(hoy), hasta: fmt(hoy) };
  if (key === 'semana') {
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
    return { desde: fmt(lunes), hasta: fmt(hoy) };
  }
  if (key === 'mes') {
    const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: fmt(ini), hasta: fmt(hoy) };
  }
  return { desde: '', hasta: '' };
};

const FiltroFechas = ({ filtro, onCambiar }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const seleccionar = (key) => {
    if (key === 'todos') { onCambiar({ rango: 'todos', desde: '', hasta: '' }); setOpen(false); return; }
    const { desde, hasta } = calcRango(key);
    onCambiar({ rango: key, desde, hasta });
    if (key !== 'custom') setOpen(false);
  };

  const label = filtro.rango === 'todos' ? 'Fecha' :
    filtro.rango === 'custom' && filtro.desde ? `${filtro.desde} → ${filtro.hasta || '...'}` :
    RANGOS.find(r => r.key === filtro.rango)?.label || 'Fecha';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.52rem 0.85rem', borderRadius: '10px',
          border: `1.5px solid ${filtro.rango !== 'todos' ? BLUE_MID : '#e2e8f0'}`,
          background: filtro.rango !== 'todos' ? BLUE_LIGHTER : 'white',
          color: filtro.rango !== 'todos' ? BLUE_MID : '#64748b',
          fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {label}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: 'white', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          border: '1px solid #f1f5f9', padding: '0.5rem', minWidth: '200px',
          animation: 'dropIn 0.18s ease',
        }}>
          <button onClick={() => seleccionar('todos')} style={menuBtnStyle(filtro.rango === 'todos')}>Todos los períodos</button>
          {RANGOS.map(r => (
            <button key={r.key} onClick={() => seleccionar(r.key)} style={menuBtnStyle(filtro.rango === r.key)}>{r.label}</button>
          ))}
          {filtro.rango === 'custom' && (
            <div style={{ padding: '0.4rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <input type="date" value={filtro.desde} onChange={e => onCambiar({ ...filtro, desde: e.target.value })}
                style={dateInputStyle} />
              <input type="date" value={filtro.hasta} onChange={e => onCambiar({ ...filtro, hasta: e.target.value })}
                style={dateInputStyle} />
              <button onClick={() => setOpen(false)}
                style={{ padding: '0.3rem', borderRadius: '7px', border: 'none', background: BLUE_MID, color: 'white', fontSize: '0.73rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                Aplicar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const menuBtnStyle = (activo) => ({
  display: 'block', width: '100%', textAlign: 'left', padding: '0.45rem 0.65rem',
  borderRadius: '8px', border: 'none', background: activo ? BLUE_LIGHTER : 'transparent',
  color: activo ? BLUE_MID : '#475569', fontSize: '0.79rem', fontWeight: activo ? '800' : '600',
  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
});

const dateInputStyle = {
  padding: '0.32rem 0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '7px',
  fontSize: '0.75rem', color: '#334155', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

/* ── Menú descarga CORREGIDO con portal ── */
const descMenuBtn = {
  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
  padding: '0.45rem 0.65rem', borderRadius: '8px', border: 'none', background: 'transparent',
  fontSize: '0.77rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
};

const DescargaMenu = ({ item, tabConfig, getId }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, left: 0 });
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top:  rect.bottom + window.scrollY + 4,
        left: rect.right  + window.scrollX - 140,
      });
    }
    setOpen(o => !o);
  };

  const descargar = async (fmt) => {
    setOpen(false);
    try {
      const id  = getId(item);
      const url = `${API}${tabConfig.endpoint}${id}/${fmt}/`;
      const r   = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${item.numero_comprobante || id}.${fmt}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch { alert(`No se pudo descargar el ${fmt.toUpperCase()}.`); }
  };

  const descargas = tabConfig.descargas || ['xml', 'pdf'];

  return (
    <>
      <button
        ref={btnRef}
        title="Descargar"
        onClick={handleOpen}
        style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1.5px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', transition:'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background=BLUE_LIGHTER; e.currentTarget.style.borderColor=BLUE_MID; e.currentTarget.style.color=BLUE_MID; }}
        onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b'; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>

      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top:  pos.top,
            left: pos.left,
            zIndex: 99999,
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
            border: '1px solid #f1f5f9',
            padding: '0.4rem',
            minWidth: '140px',
            animation: 'dropIn 0.15s ease',
          }}
        >
          {descargas.includes('xml') && (
            <button onClick={() => descargar('xml')} style={{ ...descMenuBtn, color: '#0d9488' }}
              onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Descargar XML
            </button>
          )}
          {descargas.includes('pdf') && (
            <button onClick={() => descargar('pdf')} style={{ ...descMenuBtn, color: '#dc2626' }}
              onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
              Descargar PDF
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

/* ── Selector de documento ── */
const TIPOS_DOC = [
  { id: 'factura',      label: 'Factura',               descripcion: 'Factura electrónica estándar',             color: '#15389a', colorBg: '#dbeafe', colorAccent: '#3b82f6', icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#3b82f6" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#bfdbfe" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#bfdbfe" /><rect x="10" y="22" width="7" height="1.8" rx="0.9" fill="#bfdbfe" /><circle cx="31" cy="31" r="9" fill="#15389a" /><text x="31" y="35.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="800">$</text></svg> },
  { id: 'nota_credito', label: 'Nota de Crédito',       descripcion: 'Devolución o descuento aplicado',          color: '#059669', colorBg: '#d1fae5', colorAccent: '#10b981', icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#10b981" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#6ee7b7" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#6ee7b7" /><circle cx="31" cy="31" r="9" fill="#059669" /><path d="M26.5 31h9M31 26.5v9" stroke="white" strokeWidth="2.2" strokeLinecap="round" /></svg> },
  { id: 'nota_debito',  label: 'Nota de Débito',        descripcion: 'Ajuste de cobro adicional',                color: '#dc2626', colorBg: '#fee2e2', colorAccent: '#ef4444', icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#ef4444" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#fca5a5" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#fca5a5" /><circle cx="31" cy="31" r="9" fill="#dc2626" /><path d="M26.5 31h9" stroke="white" strokeWidth="2.2" strokeLinecap="round" /></svg> },
  { id: 'retencion',    label: 'Comp. de Retención',    descripcion: 'Retención en la fuente o IVA',             color: '#d97706', colorBg: '#fef3c7', colorAccent: '#f59e0b', icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#f59e0b" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#fcd34d" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#fcd34d" /><circle cx="31" cy="31" r="9" fill="#d97706" /><path d="M27 31l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { id: 'liquidacion',  label: 'Liquidación de Compras', descripcion: 'Compras a no obligados a facturar',       color: '#be185d', colorBg: '#fce7f3', colorAccent: '#ec4899', icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#fce7f3" stroke="#f9a8d4" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#ec4899" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#f9a8d4" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#f9a8d4" /><circle cx="31" cy="31" r="9" fill="#be185d" /><text x="31" y="35" textAnchor="middle" fill="white" fontSize="8" fontWeight="800">LC</text></svg> },
  { id: 'proforma',     label: 'Proforma',              descripcion: 'Cotización o presupuesto previo',          color: '#7c3aed', colorBg: '#ede9fe', colorAccent: '#8b5cf6', icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#8b5cf6" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#c4b5fd" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#c4b5fd" /><circle cx="31" cy="31" r="9" fill="#7c3aed" /><path d="M27 27l8 8M35 27l-8 8" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg> },
];

const SelectorDocumentos = ({ onSeleccionar, onCerrar }) => {
  const [hovered, setHovered] = React.useState(null);
  return ReactDOM.createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'backdropIn 0.22s ease both' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '28px', boxShadow: '0 32px 80px rgba(15,23,42,0.25)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', animation: 'modalIn 0.3s cubic-bezier(0.34,1.3,0.64,1) both' }}>
        <div style={{ padding: '2.5rem 3rem', animation: 'fadeUp 0.3s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.55rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.3rem', letterSpacing: '-0.4px' }}>Nuevo Documento</h2>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0, fontWeight: '500' }}>Selecciona el tipo de comprobante que deseas emitir</p>
            </div>
            <button onClick={onCerrar} style={{ background: '#f1f5f9', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.2rem' }}>
            {TIPOS_DOC.map((doc, i) => {
              const isHov = hovered === doc.id;
              return (
                <div key={doc.id}
                  onMouseEnter={() => setHovered(doc.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSeleccionar(doc.id)}
                  style={{ background: isHov ? `linear-gradient(150deg,#fff,${doc.colorBg})` : '#fff', borderRadius: '20px', padding: '2rem 1.75rem 1.8rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer', border: `1.5px solid ${isHov ? doc.colorAccent + '55' : '#e8edf3'}`, boxShadow: isHov ? `0 20px 48px ${doc.color}1a` : '0 2px 8px rgba(15,23,42,0.05)', transform: isHov ? 'translateY(-7px) scale(1.015)' : 'translateY(0) scale(1)', transition: 'all 0.26s cubic-bezier(0.34,1.45,0.64,1)', position: 'relative', overflow: 'hidden', animation: `fadeUp 0.45s ease ${i * 0.06}s both`, minHeight: '200px' }}>
                  <div style={{ position: 'absolute', top: '-28px', right: '-28px', width: '110px', height: '110px', borderRadius: '50%', background: isHov ? doc.colorBg : '#f8fafc', opacity: isHov ? 0.6 : 0.4, transition: 'all 0.3s', pointerEvents: 'none' }} />
                  <div style={{ width: '74px', height: '74px', borderRadius: '18px', background: isHov ? doc.colorBg : '#f4f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', flexShrink: 0, transform: isHov ? 'scale(1.1) rotate(-2deg)' : 'scale(1)', transition: 'all 0.28s cubic-bezier(0.34,1.45,0.64,1)', position: 'relative', zIndex: 1 }}>{doc.icon}</div>
                  <div style={{ position: 'relative', zIndex: 1, flex: 1, width: '100%' }}>
                    <div style={{ fontSize: '1.02rem', fontWeight: '800', lineHeight: 1.25, color: isHov ? doc.color : '#0f172a', marginBottom: '0.4rem', transition: 'color 0.2s' }}>{doc.label}</div>
                    <div style={{ fontSize: '0.79rem', fontWeight: '500', color: '#94a3b8', lineHeight: 1.5 }}>{doc.descripcion}</div>
                  </div>
                  <div style={{ position: 'absolute', bottom: '1.4rem', right: '1.4rem', width: '34px', height: '34px', borderRadius: '50%', background: doc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isHov ? 1 : 0, transform: isHov ? 'scale(1)' : 'scale(0.6)', transition: 'all 0.24s cubic-bezier(0.34,1.45,0.64,1)', zIndex: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ── Modal error SRI ── */
const ModalErrorSRI = ({ mensaje, onCerrar }) =>
  ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', zIndex: 9995, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div style={{ background: 'white', borderRadius: '20px', maxWidth: '440px', width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'tourPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: 'linear-gradient(135deg,#7f1d1d,#dc2626)', padding: '1.2rem 1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: '900', fontSize: '0.9rem', color: 'white' }}>Operación no permitida</p>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>Validación del SRI</p>
          </div>
        </div>
        <div style={{ padding: '1.3rem 1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151', lineHeight: 1.6 }}>{mensaje}</p>
          <button onClick={onCerrar}
            style={{ marginTop: '1.2rem', width: '100%', padding: '0.65rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${BLUE},${BLUE_MID})`, color: 'white', fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit' }}>
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

/* ── Modal confirmar anulación ── */
const ModalConfirmarAnulacion = ({ item, getNombre, getNumero, getFecha, onConfirmar, onCerrar, cargando }) =>
  ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', zIndex: 9995, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget && !cargando) onCerrar(); }}>
      <div style={{ background: 'white', borderRadius: '20px', maxWidth: '420px', width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'tourPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: 'linear-gradient(135deg,#7f1d1d,#dc2626)', padding: '1.2rem 1.5rem' }}>
          <p style={{ margin: 0, fontWeight: '900', fontSize: '0.95rem', color: 'white' }}>⚠️ Confirmar Anulación</p>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.73rem', color: 'rgba(255,255,255,0.7)' }}>Esta acción no se puede deshacer</p>
        </div>
        <div style={{ padding: '1.3rem 1.5rem' }}>
          <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '0.9rem 1rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '800', color: '#991b1b' }}>Comprobante a anular</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', fontWeight: '700', color: '#0f172a' }}>{getNumero(item)}</p>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>{getNombre(item)}</p>
            {getFecha(item) && <p style={{ margin: '0.1rem 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>{fmtFecha(getFecha(item))}</p>}
          </div>
          <p style={{ margin: '0 0 1.2rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
            El comprobante quedará anulado, el stock será revertido y no tendrá efecto tributario.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={onCerrar} disabled={cargando}
              style={{ flex: 1, padding: '0.62rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: '700', fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', color: '#64748b' }}>
              Cancelar
            </button>
            <button onClick={onConfirmar} disabled={cargando}
              style={{ flex: 1, padding: '0.62rem', borderRadius: '10px', border: 'none', background: cargando ? '#fca5a5' : 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white', fontWeight: '800', fontSize: '0.83rem', cursor: cargando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {cargando ? 'Anulando…' : 'Sí, anular'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

/* ── Modal confirmar finalizar ── */
const ModalConfirmarFinalizar = ({ item, getNombre, getNumero, onConfirmar, onCerrar, cargando }) =>
  ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', zIndex: 9995, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget && !cargando) onCerrar(); }}>
      <div style={{ background: 'white', borderRadius: '20px', maxWidth: '420px', width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'tourPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: 'linear-gradient(135deg,#064e3b,#059669)', padding: '1.2rem 1.5rem' }}>
          <p style={{ margin: 0, fontWeight: '900', fontSize: '0.95rem', color: 'white' }}>✅ Finalizar Comprobante</p>
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.73rem', color: 'rgba(255,255,255,0.7)' }}>Descuenta stock y habilita descarga</p>
        </div>
        <div style={{ padding: '1.3rem 1.5rem' }}>
          <div style={{ background: '#ecfdf5', borderRadius: '12px', padding: '0.9rem 1rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '800', color: '#065f46' }}>Comprobante a finalizar</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', fontWeight: '700', color: '#0f172a' }}>{getNumero(item)}</p>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>{getNombre(item)}</p>
          </div>
          <p style={{ margin: '0 0 1.2rem', fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
            El comprobante pasará a estado <strong>Finalizado</strong>, se descontará el stock y podrás descargar el XML y PDF.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={onCerrar} disabled={cargando}
              style={{ flex: 1, padding: '0.62rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontWeight: '700', fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', color: '#64748b' }}>
              Cancelar
            </button>
            <button onClick={onConfirmar} disabled={cargando}
              style={{ flex: 1, padding: '0.62rem', borderRadius: '10px', border: 'none', background: cargando ? '#6ee7b7' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontWeight: '800', fontSize: '0.83rem', cursor: cargando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {cargando ? 'Finalizando…' : 'Sí, finalizar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

/* ════════════════════════════════════════════════════════
   TOUR BIENVENIDA
════════════════════════════════════════════════════════ */
const getTOUR_KEY_FE = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `fe-tour-${uid}`;
  } catch { return 'fe-tour'; }
};
const TOUR_KEY_FE = getTOUR_KEY_FE();

const TourBienvenida_FE = ({ onCerrar }) => {
  const pasos = [
    { emoji: '🧾', titulo: '¿Qué son los Comprobantes Emitidos?', texto: 'Son todos los documentos tributarios que TÚ generas y entregas a tus clientes: facturas, notas de crédito, notas de débito, retenciones, liquidaciones de compra y proformas. Aquí los encuentras todos en un solo lugar.' },
    { emoji: '📋', titulo: 'Tipos de comprobante', texto: 'Factura: venta de bienes o servicios. Nota de Crédito: reversa o descuento sobre una factura. Nota de Débito: cargo adicional sobre una factura. Retención: comprobante de retención de impuestos. Liquidación de Compra: compra a personas sin RUC. Proforma: cotización sin efecto fiscal.' },
    { emoji: '📊', titulo: 'Estados de un comprobante', texto: 'Borrador: editable, no afecta stock ni impuestos. Finalizado: descuenta stock, aparece en el ATS, solo permite editar observaciones. Anulado: sin efecto tributario, stock revertido automáticamente.' },
    { emoji: '🔍', titulo: 'Buscar, filtrar y descargar', texto: 'Usa el buscador por número o nombre de cliente. Filtra por tipo de comprobante, estado (Todos / Finalizados / Borradores / Anulados) y rango de fechas. Descarga XML y PDF desde las acciones de cada fila.' },
    { emoji: '⚡', titulo: 'Acciones rápidas', texto: 'Desde la tabla puedes: Ver detalle completo, Descargar XML o PDF, Editar observaciones en comprobantes finalizados, Finalizar borradores y Anular comprobantes finalizados.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Todos los comprobantes finalizados aparecen en el ATS mensual del SRI. Los borradores no tienen efecto fiscal. Practica emitir facturas, notas y retenciones sin consecuencias reales. ¡Explora sin miedo!' },
  ];
  const [paso, setPaso] = useState(0);
  const actual = pasos[paso];
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(10,18,40,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'tourFadeIn 0.25s ease' }}>
      <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 40px 100px rgba(0,0,0,0.4)', overflow: 'hidden', animation: 'tourPopIn 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#1d4ed8)', padding: '1.6rem 1.8rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '30px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(96,165,250,0.12)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>COMPROBANTES EMITIDOS</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            Gestión de comprobantes<br /><span style={{ color: '#93c5fd' }}>electrónicos emitidos</span>
          </p>
          <button onClick={onCerrar}
            style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', width: '32px', height: '32px', borderRadius: '9px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', padding: '0.9rem 1.8rem 0' }}>
          {pasos.map((_, i) => (
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= paso ? '#2563eb' : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
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
            {paso > 0 && (
              <button onClick={() => setPaso(p => p - 1)}
                style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.82rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Atrás
              </button>
            )}
            {paso < pasos.length - 1 ? (
              <button onClick={() => setPaso(p => p + 1)}
                style={{ padding: '0.55rem 1.4rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${BLUE_MID},#2563eb)`, color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(15,31,75,0.35)' }}>
                Siguiente →
              </button>
            ) : (
              <button onClick={onCerrar}
                style={{ padding: '0.55rem 1.6rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>
                ¡Empezar a facturar! 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const BannerEdu_FE = ({ onClose }) => (
  <div style={{ marginBottom: '1rem', background: 'linear-gradient(135deg,#f0f7ff,#e0f2fe)', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '0.85rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', animation: 'tourFadeIn 0.3s ease' }}>
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

const BarraModoEdu_FE = ({ onVerTutorial }) => (
  <div style={{ background: 'linear-gradient(90deg,#fffbeb,#fef3c7)', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
const FacturasEmitidas = ({ onNuevoDocumento, filtroInicial = 'todos' }) => {

  const [tourVisto_FE, setTourVisto_FE] = useState(() => !!localStorage.getItem(TOUR_KEY_FE));
  const [mostrarEdu_FE, setMostrarEdu_FE] = useState(false);

  const cerrarTour_FE = () => {
    localStorage.setItem(TOUR_KEY_FE, '1');
    setTourVisto_FE(true);
    setMostrarEdu_FE(true);
    setTimeout(() => setMostrarEdu_FE(false), 30000);
  };

  const verTutorial_FE = () => {
    localStorage.removeItem(TOUR_KEY_FE);
    setTourVisto_FE(false);
    setMostrarEdu_FE(false);
  };

  const { logoNegocio } = useContext(AppContext);
  const [negocio, setNegocio] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/api/negocio/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setNegocio(data); })
      .catch(() => {});
  }, []);

  const logoSrc = buildLogoUrl(logoNegocio) || (negocio?.logo_url ? buildLogoUrl(negocio.logo_url) : null);

  const [tabActivo,    setTabActivo]    = useState('factura');
  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [busqueda,     setBusqueda]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState(filtroInicial);
  const [pagina,       setPagina]       = useState(1);
  const [totalItems,   setTotalItems]   = useState(0);
  const [resumen,      setResumen]      = useState({});
  const [hoveredRow,   setHoveredRow]   = useState(null);
  const [modalItem,    setModalItem]    = useState(null);
  const [showSelector, setShowSelector] = useState(false);
  const [filtroFecha,  setFiltroFecha]  = useState({ rango: 'todos', desde: '', hasta: '' });

  const [itemAnular, setItemAnular] = useState(null);
  const [anulando,   setAnulando]   = useState(false);
  const [errorSRI,   setErrorSRI]   = useState('');

  const [itemFinalizar, setItemFinalizar] = useState(null);
  const [finalizando,   setFinalizando]   = useState(false);

  const POR_PAGINA = 10;

  const tabConfig = TABS.find(t => t.id === tabActivo) || TABS[0];

  const cargar = async (page, fechaFiltro, tipo, estadoFil, busq) => {
    setLoading(true);
    setError('');
    try {
      const ff    = fechaFiltro;
      const desde = ff.rango !== 'todos' ? ff.desde : '';
      const hasta = ff.rango !== 'todos' ? ff.hasta : '';
      const cfg   = TABS.find(t => t.id === tipo) || TABS[0];
      const params = new URLSearchParams({ pagina: page, por_pagina: POR_PAGINA });
      if (estadoFil !== 'todos') params.append('estado', estadoFil);
      if (busq)  params.append('buscar', busq);
      if (desde) params.append('fecha_desde', desde);
      if (hasta) params.append('fecha_hasta', hasta);

      const r = await fetch(`${API}${cfg.endpoint}?${params}`, { headers: hdrs() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setItems(data.items || []);
      setTotalItems(data.total || 0);

      const rr = await fetch(`${API}${cfg.endpoint}resumen`, { headers: hdrs() });
      if (rr.ok) setResumen(await rr.json());
    } catch {
      setError('No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPagina(1);
    cargar(1, filtroFecha, tabActivo, filtroEstado, busqueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroFecha.rango, filtroFecha.desde, filtroFecha.hasta, tabActivo, filtroEstado, busqueda]);

  useEffect(() => {
    cargar(pagina, filtroFecha, tabActivo, filtroEstado, busqueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  const abrirModal = async (item) => {
    setModalItem(item);
    try {
      const idField = Object.keys(item).find(k => k.startsWith('id_'));
      const r = await fetch(`${API}${tabConfig.endpoint}${item[idField]}`, { headers: hdrs() });
      if (r.ok) setModalItem(await r.json());
    } catch {}
  };

  const solicitarAnulacion = (item) => {
    const estado = item.estado?.value || item.estado || '';
    if (estado === 'borrador') { setErrorSRI('Los documentos en estado Borrador no se anulan. Para eliminarlo usa el botón de eliminación.'); return; }
    if (estado === 'anulada' || estado === 'anulado') { setErrorSRI('Este comprobante ya está anulado.'); return; }
    setItemAnular(item);
  };

  const confirmarAnulacion = async () => {
    if (!itemAnular) return;
    setAnulando(true);
    try {
      const idField = Object.keys(itemAnular).find(k => k.startsWith('id_'));
      const id = itemAnular[idField];
      const r = await fetch(`${API}${tabConfig.endpoint}${id}/anular`, { method: 'PATCH', headers: hdrs() });
      if (r.ok) { setItemAnular(null); cargar(pagina, filtroFecha, tabActivo, filtroEstado, busqueda); }
      else {
        const data = await r.json().catch(() => ({}));
        setItemAnular(null);
        setErrorSRI(data?.detail || 'No se pudo anular el documento.');
      }
    } catch { setItemAnular(null); setErrorSRI('Error de conexión al intentar anular el comprobante.'); }
    finally { setAnulando(false); }
  };

  const solicitarFinalizar = (item) => {
    const estado = item.estado?.value || item.estado || '';
    if (estado !== 'borrador') { setErrorSRI('Solo se pueden finalizar documentos en estado Borrador.'); return; }
    setItemFinalizar(item);
  };

  const confirmarFinalizar = async () => {
    if (!itemFinalizar) return;
    setFinalizando(true);
    try {
      const idField = Object.keys(itemFinalizar).find(k => k.startsWith('id_'));
      const id = itemFinalizar[idField];
      const r = await fetch(`${API}${tabConfig.endpoint}${id}`, {
        method: 'PATCH', headers: hdrs(),
        body: JSON.stringify({ estado: 'finalizada' }),
      });
      if (r.ok) { setItemFinalizar(null); cargar(pagina, filtroFecha, tabActivo, filtroEstado, busqueda); }
      else {
        const data = await r.json().catch(() => ({}));
        setItemFinalizar(null);
        setErrorSRI(data?.detail || 'No se pudo finalizar el documento. Verifica que haya stock suficiente.');
      }
    } catch {
      setItemFinalizar(null);
      setErrorSRI('Error de conexión al intentar finalizar el comprobante.');
    } finally { setFinalizando(false); }
  };

  const getNombre   = (item) => { const c = item.cliente || item.proveedor; return c?.nombres_apellidos || c?.razon_social || '—'; };
  const getNumero   = (item) => item.numero_comprobante || '—';
  const getFecha    = (item) => item.fecha_emision || null;
  const getTotal    = (item) => item.total || item.total_retenido || 0;
  const getEstado   = (item) => { const est = item.estado?.value || item.estado || ''; return tabConfig.estadoMap[est] || { label: est, color: '#94a3b8', bg: '#f1f5f9' }; };
  const getId       = (item) => { const k = Object.keys(item).find(k => k.startsWith('id_')); return item[k]; };
  const puedeAnular = (item) => { const estado = item.estado?.value || item.estado || ''; return estado === 'finalizada' || estado === 'emitida'; };
  const esBorrador  = (item) => (item.estado?.value || item.estado || '') === 'borrador';

  const getResumenCards = () => {
    switch (tabActivo) {
      case 'factura': return [
        { label: 'Total Facturado', value: fmtMoney(resumen.totalFinalizado || 0), color: '#2563eb', bg: '#eff6ff', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
        { label: 'Finalizadas',     value: resumen.finalizadas || 0,               color: '#10b981', bg: '#ecfdf5', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
        { label: 'Borradores',      value: resumen.borradores || 0,                color: '#f59e0b', bg: '#fffbeb', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
        { label: 'Anuladas',        value: resumen.anuladas || 0,                  color: '#ef4444', bg: '#fef2f2', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
      ];
      case 'nota_credito': case 'nota_debito': return [
        { label: 'Total Emitido', value: fmtMoney(resumen.totalEmitido || 0), color: tabConfig.textColor, bg: '#f0fdf4', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tabConfig.textColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        { label: 'Emitidas',     value: resumen.emitidas || 0,               color: '#10b981', bg: '#ecfdf5', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
        { label: 'Anuladas',     value: resumen.anuladas || 0,               color: '#ef4444', bg: '#fef2f2', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
      ];
      case 'retencion': return [
        { label: 'Retenido Renta', value: fmtMoney(resumen.total_retenido_renta || 0), color: '#d97706', bg: '#fffbeb', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
        { label: 'Retenido IVA',   value: fmtMoney(resumen.total_retenido_iva || 0),   color: '#f59e0b', bg: '#fffbeb', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        { label: 'Emitidas',       value: resumen.total_emitidas || 0,                 color: '#10b981', bg: '#ecfdf5', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
        { label: 'Anuladas',       value: resumen.total_anuladas || 0,                 color: '#ef4444', bg: '#fef2f2', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
      ];
      case 'proforma': return [
        { label: 'Total Cotizado', value: fmtMoney(resumen.totalCotizado || 0), color: '#7c3aed', bg: '#ede9fe', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        { label: 'Cotizadas',     value: resumen.cotizadas || 0,   color: '#6366f1', bg: '#e0e7ff', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
        { label: 'Convertidas',   value: resumen.convertidas || 0, color: '#10b981', bg: '#ecfdf5', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
        { label: 'Rechazadas',    value: resumen.rechazadas || 0,  color: '#ef4444', bg: '#fef2f2', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
      ];
      default: return [
        { label: 'Total Emitido', value: fmtMoney(resumen.totalEmitido || 0), color: tabConfig.textColor, bg: '#f0fdf4', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={tabConfig.textColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        { label: 'Emitidas',     value: resumen.emitidas || 0,               color: '#10b981', bg: '#ecfdf5', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
        { label: 'Anuladas',     value: resumen.anuladas || 0,               color: '#ef4444', bg: '#fef2f2', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
      ];
    }
  };

  const totalPaginas   = Math.ceil(totalItems / POR_PAGINA);
  const hayFiltroFecha = filtroFecha.rango !== 'todos';

  const descargarModal = async (formato) => {
    if (!modalItem) return;
    try {
      const id  = getId(modalItem);
      const url = `${API}${tabConfig.endpoint}${id}/${formato}/`;
      const r   = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = `${modalItem.numero_comprobante || id}.${formato}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch { alert(`No se pudo descargar el ${formato.toUpperCase()}.`); }
  };

  const handleSeleccionarDocumento = (tipo) => {
    setShowSelector(false);
    if (onNuevoDocumento) { onNuevoDocumento(tipo); return; }
    const rutas = { factura: '/nueva-factura', nota_credito: '/nota-credito', nota_debito: '/nota-debito', retencion: '/comprobante-retencion', liquidacion: '/liquidacion-compras', proforma: '/proforma' };
    const ruta = rutas[tipo];
    if (!ruta) { alert(`No se encontró la ruta para ${tipo}.`); return; }
    setTimeout(() => { window.location.href = ruta; }, 50);
  };

  const filtrosEstado = tabActivo === 'factura'
    ? [{ key: 'todos', label: 'Todos' }, { key: 'finalizada', label: 'Finalizadas' }, { key: 'borrador', label: 'Borradores' }, { key: 'anulada', label: 'Anuladas' }]
    : tabActivo === 'proforma'
      ? [{ key: 'todos', label: 'Todos' }, { key: 'cotizada', label: 'Cotizadas' }, { key: 'aceptada', label: 'Aceptadas' }, { key: 'rechazada', label: 'Rechazadas' }, { key: 'convertida_factura', label: 'Convertidas' }]
      : [{ key: 'todos', label: 'Todos' }, { key: 'emitida', label: 'Emitidas' }, { key: 'anulada', label: 'Anuladas' }];

  /* ════ RENDER ════ */
  return (
    <div style={{ padding: '1.4rem 1.5rem', fontFamily: "'Nunito','Segoe UI',system-ui,sans-serif", animation: 'fadeUp 0.3s ease both' }}>

      {!tourVisto_FE && <TourBienvenida_FE onCerrar={cerrarTour_FE} />}
      {mostrarEdu_FE && <BannerEdu_FE onClose={() => setMostrarEdu_FE(false)} />}
      <BarraModoEdu_FE onVerTutorial={verTutorial_FE} />

      {errorSRI && <ModalErrorSRI mensaje={errorSRI} onCerrar={() => setErrorSRI('')} />}
      {itemAnular && (
        <ModalConfirmarAnulacion
          item={itemAnular} getNombre={getNombre} getNumero={getNumero} getFecha={getFecha}
          onConfirmar={confirmarAnulacion} onCerrar={() => setItemAnular(null)} cargando={anulando}
        />
      )}
      {itemFinalizar && (
        <ModalConfirmarFinalizar
          item={itemFinalizar} getNombre={getNombre} getNumero={getNumero}
          onConfirmar={confirmarFinalizar} onCerrar={() => setItemFinalizar(null)} cargando={finalizando}
        />
      )}

      {/* ── TABS ── */}
      <div style={{ background: 'white', borderBottom: '2px solid #f1f5f9', margin: '-1.4rem -1.5rem 1.4rem', padding: '0 1.5rem', display: 'flex', alignItems: 'flex-end', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(tab => {
          const activo = tabActivo === tab.id;
          return (
            <button key={tab.id} onClick={() => { setTabActivo(tab.id); setFiltroEstado('todos'); }}
              style={{ padding: '0.85rem 1.15rem 0.75rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', whiteSpace: 'nowrap', transition: 'all 0.18s', background: 'transparent', marginBottom: '-2px', color: activo ? tab.textColor : '#94a3b8', fontWeight: activo ? '800' : '600', borderBottom: activo ? `2.5px solid ${BLUE_MID}` : '2.5px solid transparent' }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.color = '#94a3b8'; }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.3rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, fontWeight: '600' }}>
          {loading ? 'Cargando…' : `${totalItems} documento${totalItems !== 1 ? 's' : ''} encontrado${totalItems !== 1 ? 's' : ''}`}
        </p>
        <button onClick={() => setShowSelector(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.2rem', borderRadius: '12px', border: 'none', cursor: 'pointer', background: 'linear-gradient(90deg,#15389a,#2563eb)', color: 'white', fontWeight: '700', fontSize: '0.85rem', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(21,56,154,0.33)', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(21,56,154,0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(21,56,154,0.33)'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Comprobante
        </button>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${getResumenCards().length},1fr)`, gap: '1rem', marginBottom: '1.3rem' }}>
        {getResumenCards().map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '16px', padding: '1rem 1.2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0.9rem', animation: `fadeUp 0.4s ease ${i * 0.06}s both` }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</p>
              {loading
                ? <div style={{ marginTop: '0.3rem' }}><Skeleton h="22px" w="70px" /></div>
                : <p style={{ margin: '0.1rem 0 0', fontSize: '1.2rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px' }}>{s.value}</p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '0.9rem 1.2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <input
            placeholder="Buscar por número, cliente…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ padding: '0.58rem 1rem 0.58rem 2.3rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.84rem', color: '#334155', outline: 'none', background: '#f8fafc', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'all 0.2s' }}
            onFocus={e => { e.target.style.borderColor = BLUE_MID; e.target.style.background = 'white'; e.target.style.boxShadow = `0 0 0 3px rgba(21,56,154,0.1)`; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
          />
          <svg style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        <FiltroFechas filtro={filtroFecha} onCambiar={setFiltroFecha} />

        {hayFiltroFecha && (
          <button onClick={() => setFiltroFecha({ rango: 'todos', desde: '', hasta: '' })}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.38rem 0.7rem', borderRadius: '99px', border: 'none', background: '#fef3c7', color: '#d97706', fontSize: '0.73rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fde68a'}
            onMouseLeave={e => e.currentTarget.style.background = '#fef3c7'}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Limpiar fecha
          </button>
        )}

        <div style={{ width: '1px', height: '28px', background: '#e8edf3', flexShrink: 0 }} />

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {filtrosEstado.map(f => (
            <button key={f.key} onClick={() => setFiltroEstado(f.key)}
              style={{ padding: '0.42rem 0.85rem', borderRadius: '99px', border: '1.5px solid', fontSize: '0.77rem', fontWeight: '700', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', borderColor: filtroEstado === f.key ? '#2563eb' : '#e2e8f0', background: filtroEstado === f.key ? 'linear-gradient(90deg,#15389a,#2563eb)' : 'white', color: filtroEstado === f.key ? 'white' : '#64748b', boxShadow: filtroEstado === f.key ? '0 4px 12px rgba(21,56,154,0.33)' : 'none' }}>
              {f.label}
            </button>
          ))}
        </div>

        <button onClick={() => cargar(pagina, filtroFecha, tabActivo, filtroEstado, busqueda)} title="Actualizar"
          style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = BLUE_MID; e.currentTarget.style.color = BLUE_MID; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      {/* ── TABLA ── */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', animation: 'fadeUp 0.4s ease 0.2s both' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px 130px 110px 120px', padding: '0.7rem 1.4rem', borderBottom: '2px solid #f1f5f9', background: '#fafafa' }}>
          {['Comprobante','Cliente / Proveedor','Fecha','Estado','Total','Acciones'].map(col => (
            <span key={col} style={{ fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</span>
          ))}
        </div>

        {error && <div style={{ padding: '1.5rem', textAlign: 'center', color: '#b91c1c', fontSize: '0.86rem', background: '#fef2f2' }}>⚠️ {error}</div>}

        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px 130px 110px 120px', padding: '1rem 1.4rem', alignItems: 'center', borderBottom: '1px solid #f8fafc', gap: '0.5rem' }}>
            <Skeleton h="13px" w="110px" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Skeleton h="30px" w="30px" radius="8px" /><Skeleton h="13px" /></div>
            <Skeleton h="13px" w="80px" />
            <Skeleton h="22px" w="90px" radius="99px" />
            <Skeleton h="13px" w="70px" />
            <div style={{ display: 'flex', gap: '0.3rem' }}><Skeleton h="28px" w="28px" radius="7px" /><Skeleton h="28px" w="28px" radius="7px" /><Skeleton h="28px" w="28px" radius="7px" /></div>
          </div>
        ))}

        {!loading && !error && items.length === 0 && (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <p style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: '#64748b' }}>
              {busqueda || filtroEstado !== 'todos' || hayFiltroFecha ? 'Sin resultados para ese filtro' : `No hay ${tabConfig.label.toLowerCase()} aún`}
            </p>
            <p style={{ margin: '0.4rem 0 1.2rem', fontSize: '0.83rem', color: '#94a3b8' }}>
              {busqueda || filtroEstado !== 'todos' || hayFiltroFecha ? 'Intenta con otros criterios' : 'Crea tu primer documento para comenzar'}
            </p>
            {!busqueda && filtroEstado === 'todos' && !hayFiltroFecha && (
              <button onClick={() => setShowSelector(true)}
                style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${BLUE},${BLUE_MID})`, color: 'white', fontWeight: '700', fontSize: '0.84rem', fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 12px rgba(21,56,154,0.3)' }}>
                + Nuevo Comprobante
              </button>
            )}
          </div>
        )}

        {!loading && items.map((item, i) => {
          const nombre  = getNombre(item);
          const estado  = getEstado(item);
          const color   = COLORS_AVATAR[i % COLORS_AVATAR.length];
          const permite = puedeAnular(item);
          const esBorr  = esBorrador(item);

          return (
            <div key={getId(item)}
              onMouseEnter={() => setHoveredRow(getId(item))}
              onMouseLeave={() => setHoveredRow(null)}
              style={{ display: 'grid', gridTemplateColumns: '150px 1fr 110px 130px 110px 120px', padding: '0.85rem 1.4rem', alignItems: 'center', borderBottom: i < items.length - 1 ? '1px solid #f8fafc' : 'none', background: hoveredRow === getId(item) ? '#f8faff' : 'transparent', transition: 'background 0.15s', animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: estado.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.74rem', fontWeight: '700', color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getNumero(item)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>{nombre.charAt(0).toUpperCase()}</div>
                <span style={{ fontSize: '0.86rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
              </div>

              <span style={{ fontSize: '0.79rem', color: '#64748b' }}>{fmtFecha(getFecha(item))}</span>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.22rem 0.65rem', borderRadius: '99px', background: estado.bg, color: estado.color, fontSize: '0.72rem', fontWeight: '800', width: 'fit-content' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: estado.color }} />{estado.label}
              </span>

              <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>{fmtMoney(getTotal(item))}</span>

              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button title="Ver detalle" onClick={() => abrirModal(item)}
                  style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = BLUE_LIGHTER; e.currentTarget.style.borderColor = BLUE_MID; e.currentTarget.style.color = BLUE_MID; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>

                <DescargaMenu item={item} tabConfig={tabConfig} getId={getId} />

                {esBorr && (
                  <button title="Finalizar comprobante" onClick={() => solicitarFinalizar(item)}
                    style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#059669'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                )}

                {permite && (
                  <button title="Anular comprobante" onClick={() => solicitarAnulacion(item)}
                    style={{ width: '28px', height: '28px', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.4rem', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>
              Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, totalItems)}–{Math.min(pagina * POR_PAGINA, totalItems)} de {totalItems}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <PaginBtn onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </PaginBtn>
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let page = i + 1;
                if (totalPaginas > 5) {
                  if (pagina <= 3) page = i + 1;
                  else if (pagina >= totalPaginas - 2) page = totalPaginas - 4 + i;
                  else page = pagina - 2 + i;
                }
                return <PaginBtn key={page} onClick={() => setPagina(page)} active={pagina === page}>{page}</PaginBtn>;
              })}
              <PaginBtn onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </PaginBtn>
            </div>
          </div>
        )}
      </div>

      {showSelector && <SelectorDocumentos onSeleccionar={handleSeleccionarDocumento} onCerrar={() => setShowSelector(false)} />}

      {/* ── MODAL DETALLE ── */}
      {modalItem && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalItem(null); }}>
          <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ padding: '1.2rem 1.5rem', background: `linear-gradient(135deg,#0f1f4b,${BLUE},${BLUE_MID})`, borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: 'white' }}>Detalle — {tabConfig.label}</h3>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.73rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{getNumero(modalItem)}</p>
              </div>
              <button onClick={() => setModalItem(null)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ padding: '1.4rem 1.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.2rem' }}>
                {[
                  { label: 'Cliente / Proveedor', value: getNombre(modalItem) },
                  { label: 'Fecha Emisión', value: fmtFecha(getFecha(modalItem)) },
                  { label: 'Estado', value: getEstado(modalItem).label, estadoObj: getEstado(modalItem) },
                  { label: 'Total', value: fmtMoney(getTotal(modalItem)) },
                  ...(modalItem.observaciones ? [{ label: 'Observaciones', value: modalItem.observaciones }] : []),
                ].map(row => (
                  <div key={row.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.7rem 0.9rem', gridColumn: row.label === 'Observaciones' ? '1/-1' : undefined }}>
                    <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{row.label}</p>
                    {row.estadoObj
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '99px', background: row.estadoObj.bg, color: row.estadoObj.color, fontSize: '0.76rem', fontWeight: '800' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: row.estadoObj.color }} />{row.value}
                        </span>
                      : <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', fontWeight: '700', color: '#0f172a' }}>{row.value}</p>
                    }
                  </div>
                ))}
              </div>

              {logoSrc && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <img src={logoSrc} alt="Logo"
                    style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                </div>
              )}

              {(modalItem.detalles || modalItem.conceptos) && (
                <div>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ítems</p>
                  <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
                    {(modalItem.detalles || modalItem.conceptos || []).map((d, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '0.65rem 0.9rem', borderBottom: i < (modalItem.detalles || modalItem.conceptos).length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{d.descripcion || d.producto?.nombre || '—'}</span>
                        <span style={{ fontSize: '0.84rem', fontWeight: '700', color: BLUE_MID }}>{fmtMoney(d.total || d.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.6rem' }}>
                {[
                  { fmt: 'xml', label: 'Descargar XML', sublabel: 'Electrónico',  color: '#0d9488', bg: '#f0fdf4', border: '#6ee7b7', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="10" y1="13" x2="14" y2="17"/><line x1="14" y1="13" x2="10" y2="17"/></svg> },
                  { fmt: 'pdf', label: 'Descargar PDF', sublabel: 'Formato RIDE', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg> },
                ].filter(o => (tabConfig.descargas || ['xml','pdf']).includes(o.fmt))
                  .map(({ fmt, label, sublabel, color, bg, border, icon }) => (
                    <button key={fmt} onClick={() => descargarModal(fmt)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem', borderRadius: '10px', border: `1.5px solid ${border}`, background: bg, color, fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', flexDirection: 'column', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      {icon}<span>{label}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: '600', opacity: 0.7 }}>{sublabel}</span>
                    </button>
                  ))}
              </div>

              {esBorrador(modalItem) && (
                <button onClick={() => { setModalItem(null); solicitarFinalizar(modalItem); }}
                  style={{ marginTop: '0.6rem', width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1.5px solid #6ee7b7', background: '#ecfdf5', color: '#059669', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#d1fae5'; e.currentTarget.style.borderColor = '#10b981'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.borderColor = '#6ee7b7'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Finalizar comprobante
                </button>
              )}

              {puedeAnular(modalItem) && (
                <button onClick={() => { setModalItem(null); solicitarAnulacion(modalItem); }}
                  style={{ marginTop: '0.6rem', width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  Anular comprobante (validación SRI)
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes tourFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes tourPopIn  { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes popIn      { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
        @keyframes dropIn     { from{opacity:0;transform:translateY(-8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        @keyframes modalIn    { from{opacity:0;transform:scale(0.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
      `}</style>
    </div>
  );
};

export default FacturasEmitidas;
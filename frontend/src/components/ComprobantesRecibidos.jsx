import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { createPortal } from 'react-dom';

const API      = 'http://localhost:8000/api';
const getToken = () => localStorage.getItem('token');
const hdrs     = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

const fmtMoney = (v) =>
  '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (s) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};

const BLUE         = '#15389a';
const BLUE_MID     = '#2563eb';
const BLUE_LIGHT   = '#dbeafe';
const BLUE_LIGHTER = '#eff6ff';

const ESTADO_CONFIG = {
  registrado: { label: 'Registrado', color: '#10b981', bg: '#d1fae5', dot: '#10b981' },
  pendiente:  { label: 'Pendiente',  color: '#f59e0b', bg: '#fef3c7', dot: '#f59e0b' },
  anulado:    { label: 'Anulado',    color: '#ef4444', bg: '#fee2e2', dot: '#ef4444' },
};

const TIPO_CONFIG = {
  factura:      { label: 'Factura',               color: '#2563eb', bg: '#eff6ff',  descargas: ['xml','pdf'] },
  nota_credito: { label: 'Nota de Crédito',        color: '#10b981', bg: '#ecfdf5',  descargas: ['xml','pdf'] },
  nota_debito:  { label: 'Nota de Débito',         color: '#ef4444', bg: '#fef2f2',  descargas: ['xml','pdf'] },
  retencion:    { label: 'Retención',              color: '#f59e0b', bg: '#fffbeb',  descargas: ['xml','pdf'] },
  liquidacion:  { label: 'Liquidación de Compra',  color: '#ec4899', bg: '#fdf2f8',  descargas: ['xml','pdf'] },
  proforma:     { label: 'Proforma',               color: '#6366f1', bg: '#eef2ff',  descargas: ['pdf'] },
};

const TABS = [
  { id: 'todos',        label: 'Todos',            textColor: '#475569' },
  { id: 'factura',      label: 'Facturas',          textColor: '#2563eb' },
  { id: 'nota_credito', label: 'Notas de Crédito',  textColor: '#059669' },
  { id: 'nota_debito',  label: 'Notas de Débito',   textColor: '#dc2626' },
  { id: 'liquidacion',  label: 'Liquidaciones',     textColor: '#be185d' },
  { id: 'proforma',     label: 'Proformas',         textColor: '#6366f1' },
];

const RANGOS_FECHA = [
  { id: 'hoy',           label: 'Hoy' },
  { id: 'ultimos7',      label: 'Últimos 7 días' },
  { id: 'ultimos30',     label: 'Últimos 30 días' },
  { id: 'este_mes',      label: 'Este Mes' },
  { id: 'mes_anterior',  label: 'Mes Anterior' },
  { id: 'este_año',      label: 'Este Año' },
  { id: 'año_anterior',  label: 'Año Anterior' },
  { id: 'personalizado', label: 'Personalizar' },
];

function calcularRango(id) {
  const hoy = new Date();
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  const pM  = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const uM  = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const mAI = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mAF = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  switch (id) {
    case 'hoy':          return { desde: fmt(hoy), hasta: fmt(hoy) };
    case 'ultimos7':     return { desde: fmt(new Date(Date.now() - 6 * 86400000)), hasta: fmt(hoy) };
    case 'ultimos30':    return { desde: fmt(new Date(Date.now() - 29 * 86400000)), hasta: fmt(hoy) };
    case 'este_mes':     return { desde: fmt(pM),  hasta: fmt(uM) };
    case 'mes_anterior': return { desde: fmt(mAI), hasta: fmt(mAF) };
    case 'este_año':     return { desde: `${hoy.getFullYear()}-01-01`, hasta: fmt(hoy) };
    case 'año_anterior': return { desde: `${hoy.getFullYear()-1}-01-01`, hasta: `${hoy.getFullYear()-1}-12-31` };
    default:             return { desde: '', hasta: '' };
  }
}

const COLORS_AVATAR = ['#6366f1','#8b5cf6','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#1d4ed8'];

const Skeleton = ({ w = '100%', h = '16px', radius = '6px' }) => (
  <div style={{ width: w, height: h, borderRadius: radius,
    background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
    backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
);

const PaginBtn = ({ children, onClick, disabled, active }) => (
  <button onClick={onClick} disabled={disabled}
    style={{ minWidth:'32px', height:'32px', padding:'0 6px', borderRadius:'8px',
      border:'1.5px solid', fontSize:'0.78rem', fontWeight:'700', fontFamily:'inherit',
      cursor: disabled ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center',
      justifyContent:'center', transition:'all 0.15s',
      borderColor: active ? BLUE : '#e2e8f0',
      background:  active ? `linear-gradient(135deg,${BLUE},${BLUE_MID})` : disabled ? '#f8fafc' : 'white',
      color:       active ? 'white' : disabled ? '#cbd5e1' : '#64748b' }}>
    {children}
  </button>
);

// ==================== COMPONENTE FILTRO DE FECHAS ====================
const FiltroFechas = ({ filtro, onCambiar }) => {
  const [open,      setOpen]      = useState(false);
  const [tempDesde, setTempDesde] = useState('');
  const [tempHasta, setTempHasta] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', h);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', h);
    };
  }, [open]);

  const seleccionar = (id) => {
    setOpen(false);
    if (id === 'todos') {
      onCambiar({ rango: 'todos', desde: '', hasta: '' });
      return;
    }
    if (id === 'personalizado') {
      setTempDesde(filtro.desde || '');
      setTempHasta(filtro.hasta || '');
      setTimeout(() => setOpen(true), 0);
      onCambiar({ ...filtro, rango: 'personalizado' });
      return;
    }
    const { desde, hasta } = calcularRango(id);
    onCambiar({ rango: id, desde, hasta });
  };

  const aplicarPersonalizado = () => {
    if (tempDesde && tempHasta) {
      onCambiar({ rango: 'personalizado', desde: tempDesde, hasta: tempHasta });
      setOpen(false);
    }
  };

  const label = filtro.rango === 'personalizado' && filtro.desde && filtro.hasta
    ? `${fmtFecha(filtro.desde)} → ${fmtFecha(filtro.hasta)}`
    : filtro.rango === 'todos' ? 'Todas las fechas'
    : RANGOS_FECHA.find(r => r.id === filtro.rango)?.label || 'Período';

  const activo = filtro.rango !== 'todos';

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen(v => !v); }}
        style={{
          display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.52rem 0.85rem',
          borderRadius:'10px',
          border:`1.5px solid ${activo ? BLUE : (open ? BLUE : '#e2e8f0')}`,
          background: activo ? BLUE_LIGHTER : (open ? BLUE_LIGHTER : 'white'),
          cursor:'pointer', fontFamily:'inherit', fontSize:'0.82rem', fontWeight:'700',
          color: activo ? BLUE : (open ? BLUE : '#475569'),
          transition:'all 0.18s', whiteSpace:'nowrap',
          boxShadow: (activo || open) ? `0 0 0 3px rgba(21,56,154,0.1)` : 'none'
        }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {label}
        {activo ? (
          <span
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); seleccionar('todos'); }}
            style={{ display:'flex', alignItems:'center', marginLeft:'2px', opacity:0.7 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
               style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:9000,
          background:'white', borderRadius:'16px', border:'1px solid #e8edf3',
          boxShadow:'0 16px 48px rgba(15,23,42,0.14)', minWidth:'230px',
          overflow:'hidden', animation:'dropIn 0.18s cubic-bezier(0.34,1.4,0.64,1)'
        }}>
          <div style={{ padding:'0.4rem' }}>
            <button
              onMouseDown={(e) => { e.preventDefault(); seleccionar('todos'); }}
              style={{ width:'100%', padding:'0.55rem 0.85rem', border:'none',
                background: filtro.rango==='todos' ? BLUE_LIGHTER : 'transparent',
                borderRadius:'10px', cursor:'pointer', fontFamily:'inherit',
                fontSize:'0.82rem', fontWeight: filtro.rango==='todos' ? '800':'600',
                color: filtro.rango==='todos' ? BLUE : '#475569',
                textAlign:'left', transition:'all 0.13s',
                display:'flex', alignItems:'center', gap:'0.5rem' }}
              onMouseEnter={e => { if (filtro.rango!=='todos') e.currentTarget.style.background='#f8fafc'; }}
              onMouseLeave={e => { if (filtro.rango!=='todos') e.currentTarget.style.background='transparent'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Todas las fechas
            </button>

            <div style={{ height:'1px', background:'#f1f5f9', margin:'0.3rem 0' }} />

            {RANGOS_FECHA.map(item => (
              <button key={item.id}
                onMouseDown={(e) => { e.preventDefault(); seleccionar(item.id); }}
                style={{ width:'100%', padding:'0.55rem 0.85rem', border:'none',
                  background: filtro.rango===item.id ? BLUE_LIGHTER : 'transparent',
                  borderRadius:'10px', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'0.82rem', fontWeight: filtro.rango===item.id ? '800':'600',
                  color: filtro.rango===item.id ? BLUE : '#475569',
                  textAlign:'left', transition:'all 0.13s' }}
                onMouseEnter={e => { if (filtro.rango!==item.id) e.currentTarget.style.background='#f8fafc'; }}
                onMouseLeave={e => { if (filtro.rango!==item.id) e.currentTarget.style.background='transparent'; }}>
                {item.label}
              </button>
            ))}
          </div>

          {filtro.rango === 'personalizado' && (
            <div style={{ borderTop:'1px solid #f1f5f9', padding:'0.85rem 0.9rem' }}>
              <p style={{ margin:'0 0 0.5rem', fontSize:'0.68rem', fontWeight:'800',
                color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                Rango personalizado
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                {[{ label:'Desde', key:'desde' }, { label:'Hasta', key:'hasta' }].map(({ label: l, key }) => (
                  <div key={key}>
                    <label style={{ fontSize:'0.7rem', fontWeight:'700', color:'#64748b',
                      display:'block', marginBottom:'0.2rem' }}>{l}</label>
                    <input type="date"
                      value={key === 'desde' ? tempDesde : tempHasta}
                      onChange={e => key === 'desde' ? setTempDesde(e.target.value) : setTempHasta(e.target.value)}
                      style={{ width:'100%', padding:'0.45rem 0.65rem',
                        border:'1.5px solid #e2e8f0', borderRadius:'8px',
                        fontSize:'0.81rem', fontFamily:'inherit', color:'#334155',
                        outline:'none', boxSizing:'border-box' }}
                      onFocus={e => { e.target.style.borderColor=BLUE; e.target.style.boxShadow=`0 0 0 3px rgba(21,56,154,0.1)`; }}
                      onBlur={e  => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; }} />
                  </div>
                ))}
                <button
                  onMouseDown={(e) => { e.preventDefault(); aplicarPersonalizado(); }}
                  disabled={!tempDesde || !tempHasta}
                  style={{ marginTop:'0.2rem', padding:'0.5rem', borderRadius:'8px', border:'none',
                    background: (tempDesde && tempHasta) ? `linear-gradient(135deg,${BLUE},${BLUE_MID})` : '#e2e8f0',
                    color: (tempDesde && tempHasta) ? 'white' : '#94a3b8',
                    fontWeight:'700', fontSize:'0.8rem', fontFamily:'inherit',
                    cursor: (tempDesde && tempHasta) ? 'pointer' : 'not-allowed' }}>
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== MENÚ DE DESCARGA ====================
const DescargaMenuComp = ({ comp }) => {
  const [open,        setOpen]        = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [menuPos,     setMenuPos]     = useState({ top:0, left:0 });
  const btnRef  = useRef(null);
  const menuRef = useRef(null);
  const tipoConfig = TIPO_CONFIG[comp.tipo] || TIPO_CONFIG.factura;

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (btnRef.current  && !btnRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 6, left: r.right - 170 });
    }
    setOpen(v => !v);
  };

  const descargar = async (formato) => {
    setOpen(false);
    setDescargando(formato);
    try {
      const url = `${API}/comprobantes-recibidos/${comp.id_comprobante}/${formato}/`;
      const r   = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error(`Error al descargar ${formato.toUpperCase()}`);
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = href;
      a.download = `${comp.numero_comprobante || comp.id_comprobante}.${formato}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch (err) {
      alert(err.message || `No se pudo descargar el ${formato.toUpperCase()}.`);
    } finally {
      setDescargando(null);
    }
  };

  const OPTS = [
    { fmt:'xml', label:'Descargar XML', sublabel:'Comprobante electrónico', color:'#0d9488',
      icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="10" y1="13" x2="14" y2="17"/><line x1="14" y1="13" x2="10" y2="17"/></svg> },
    { fmt:'pdf', label:'Descargar PDF', sublabel:'Formato imprimible',      color:'#ef4444',
      icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg> },
  ].filter(o => (tipoConfig.descargas || ['xml','pdf']).includes(o.fmt));

  const spin = descargando !== null;

  return (
    <div style={{ position:'relative' }}>
      <button ref={btnRef} title="Descargar" disabled={spin} onClick={handleToggle}
        style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1.5px solid #e2e8f0',
          background:'white', cursor:spin?'not-allowed':'pointer', display:'flex',
          alignItems:'center', justifyContent:'center', color:'#64748b', transition:'all 0.15s' }}
        onMouseEnter={e => { if (!spin) { e.currentTarget.style.background='#f0fdf4'; e.currentTarget.style.borderColor='#10b981'; e.currentTarget.style.color='#10b981'; } }}
        onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b'; }}>
        {spin
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{animation:'spin 1s linear infinite'}}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        }
      </button>

      {open && createPortal(
        <div ref={menuRef} style={{ position:'fixed', top:menuPos.top, left:menuPos.left,
          zIndex:8900, background:'white', borderRadius:'14px', border:'1px solid #e8edf3',
          boxShadow:'0 12px 36px rgba(15,23,42,0.14)', minWidth:'170px', overflow:'hidden',
          animation:'dropIn 0.15s cubic-bezier(0.34,1.4,0.64,1)' }}>
          <div style={{ padding:'0.35rem' }}>
            {OPTS.map(({ fmt, label, sublabel, color, icon }) => (
              <button key={fmt} onClick={(e) => { e.stopPropagation(); descargar(fmt); }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.6rem',
                  padding:'0.55rem 0.75rem', border:'none', background:'transparent',
                  cursor:'pointer', fontFamily:'inherit', borderRadius:'10px',
                  transition:'background 0.13s', textAlign:'left' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <div style={{ width:'28px', height:'28px', borderRadius:'7px',
                  background:color+'18', display:'flex', alignItems:'center',
                  justifyContent:'center', color, flexShrink:0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize:'0.81rem', fontWeight:'700', color:'#334155' }}>{label}</div>
                  <div style={{ fontSize:'0.68rem', color:'#94a3b8', fontWeight:'600' }}>{sublabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ==================== COMPONENTE PRINCIPAL ====================

/* ════════════════════════════════════════════════════════
   TOUR — Comprobantes Recibidos | key: recv_tour_visto
════════════════════════════════════════════════════════ */
const getTOUR_KEY_RECV = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `tour-key-recv-${uid}`;
  } catch { return 'tour-key-recv'; }
};
const TOUR_KEY_RECV = getTOUR_KEY_RECV();

const TourBienvenida_RECV = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📥', titulo: '¿Qué son los Comprobantes Recibidos?', texto: 'Son todos los documentos tributarios que recibes de tus proveedores y que debes registrar: facturas, notas de crédito, notas de débito, retenciones, liquidaciones de compra y proformas. Registrarlos te permite controlar gastos y calcular el crédito tributario de IVA.' },
    { emoji: '📋', titulo: 'Tipos de comprobante recibido', texto: 'Factura: compra de bienes o servicios. Nota de Crédito: el proveedor te devuelve o descuenta algo. Nota de Débito: el proveedor te cobra un cargo adicional. Retención: documento de retención recibido. Liquidación de Compra: compra a personas sin RUC. Proforma: cotización recibida.' },
    { emoji: '➕', titulo: 'Registrar un comprobante', texto: 'Haz clic en "Nuevo Comprobante Recibido", selecciona el tipo de documento, ingresa el proveedor, número de comprobante, fecha y montos. La clave de acceso de 49 dígitos es opcional pero recomendada para validación.' },
    { emoji: '🔍', titulo: 'Buscar, filtrar y descargar', texto: 'Usa la barra de búsqueda para localizar por proveedor o número. Filtra por tipo de documento (Todos, Facturas, Notas de Crédito, Notas de Débito, Liquidaciones, Proformas) y por rango de fechas.' },
    { emoji: '📄', titulo: 'Acciones sobre cada comprobante', texto: 'Desde la tabla puedes: Ver el detalle completo, Descargar XML y PDF, y Anular registros incorrectos desde el menú de acciones. Los anulados quedan registrados con su historial.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Los comprobantes recibidos registrados alimentan la sección Compras del ATS mensual del SRI. Registrar todos correctamente es clave para calcular bien el IVA a pagar. ¡Practica sin miedo!' },
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
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>COMPROBANTES RECIBIDOS</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            Registro de comprobantes<br />
            <span style={{ color: '#93c5fd' }}>electrónicos recibidos</span>
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

const BannerEdu_RECV = ({ onClose, onVerTutorial }) => (
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

const BarraModoEdu_RECV = ({ onVerTutorial }) => (
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

const ComprobantesRecibidos = () => {

  // ── Tour educativo primera visita ──────────────────────────────
  const [tourVisto_RECV, setTourVisto_RECV] = useState(
    () => !!localStorage.getItem(TOUR_KEY_RECV)
  );
  const [mostrarEdu_RECV, setMostrarEdu_RECV] = useState(false);
  const cerrarTour_RECV = () => {
    localStorage.setItem(TOUR_KEY_RECV, '1');
    setTourVisto_RECV(true);
    setMostrarEdu_RECV(true);
    setTimeout(() => setMostrarEdu_RECV(false), 30000);
  };
  const verTutorial_RECV = () => {
    localStorage.removeItem(TOUR_KEY_RECV);
    setTourVisto_RECV(false);
    setMostrarEdu_RECV(false);
  };
  const [tabActivo,    setTabActivo]    = useState('todos');
  const [comprobantes, setComprobantes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [busqueda,     setBusqueda]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalItems,   setTotalItems]   = useState(0);
  const [resumen,      setResumen]      = useState({ totalRegistrados:0, registrados:0, pendientes:0, totalIVA:0 });
  const [hoveredRow,   setHoveredRow]   = useState(null);
  const [modalComp,    setModalComp]    = useState(null);
  const [exportando,   setExportando]   = useState(null);

  const [filtroFecha, setFiltroFecha] = useState({ rango: 'todos', desde: '', hasta: '' });

  const POR_PAGINA = 10;

  const cargar = useCallback(async (page, fechaFiltro, tipo, estadoFil, busq) => {
    try {
      setLoading(true); setError('');
      const desde = fechaFiltro.rango !== 'todos' ? fechaFiltro.desde : '';
      const hasta = fechaFiltro.rango !== 'todos' ? fechaFiltro.hasta : '';

      const params = new URLSearchParams({ pagina: page, por_pagina: POR_PAGINA });
      if (tipo !== 'todos') params.append('tipo', tipo);
      if (estadoFil !== 'todos') params.append('estado', estadoFil);
      if (busq) params.append('buscar', busq);
      if (desde) params.append('fecha_desde', desde);
      if (hasta) params.append('fecha_hasta', hasta);

      const r = await fetch(`${API}/comprobantes-recibidos/?${params}`, { headers: hdrs() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setComprobantes(data.items || []);
      setTotalItems(data.total || 0);

      const rr = await fetch(`${API}/comprobantes-recibidos/resumen`, { headers: hdrs() });
      if (rr.ok) {
        const res = await rr.json();
        setResumen({
          totalRegistrados: res.totalRegistrados || 0,
          registrados:      res.registrados      || 0,
          pendientes:       res.pendientes       || 0,
          totalIVA:         res.totalIVA         || 0,
        });
      }
    } catch {
      setError('No se pudieron cargar los comprobantes recibidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const skipPageEffect = useRef(false);

  useEffect(() => {
    if (paginaActual !== 1) {
      skipPageEffect.current = true;
      setPaginaActual(1);
    } else {
      cargar(1, filtroFecha, tabActivo, filtroEstado, busqueda);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroFecha, tabActivo, filtroEstado, busqueda]);

  useEffect(() => {
    if (skipPageEffect.current) {
      skipPageEffect.current = false;
      cargar(1, filtroFecha, tabActivo, filtroEstado, busqueda);
      return;
    }
    cargar(paginaActual, filtroFecha, tabActivo, filtroEstado, busqueda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual]);

  const limpiarFechas = () => setFiltroFecha({ rango: 'todos', desde: '', hasta: '' });

  const abrirModal = async (comp) => {
    setModalComp(comp);
    try {
      const r = await fetch(`${API}/comprobantes-recibidos/${comp.id_comprobante}`, { headers: hdrs() });
      if (r.ok) setModalComp(await r.json());
    } catch {}
  };

  const exportar = async (formato) => {
    setExportando(formato);
    try {
      const desde = filtroFecha.rango !== 'todos' ? filtroFecha.desde : '';
      const hasta = filtroFecha.rango !== 'todos' ? filtroFecha.hasta : '';
      const p = new URLSearchParams();
      if (tabActivo    !== 'todos') p.append('tipo',   tabActivo);
      if (filtroEstado !== 'todos') p.append('estado', filtroEstado);
      if (busqueda)                 p.append('buscar', busqueda);
      if (desde) p.append('fecha_desde', desde);
      if (hasta) p.append('fecha_hasta', hasta);
      const url = `${API}/comprobantes-recibidos/exportar/${formato}?${p}`;
      const r   = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = href;
      a.download = `comprobantes_recibidos.${formato}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch {
      alert(`No se pudo exportar el ${formato.toUpperCase()}.`);
    } finally {
      setExportando(null);
    }
  };

  const descargarModal = async (formato) => {
    if (!modalComp) return;
    try {
      const url = `${API}/comprobantes-recibidos/${modalComp.id_comprobante}/${formato}/`;
      const r   = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = href;
      a.download = `${modalComp.numero_comprobante || modalComp.id_comprobante}.${formato}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch { alert(`No se pudo descargar el ${formato.toUpperCase()}.`); }
  };

  const totalPaginas = Math.ceil(totalItems / POR_PAGINA);
  const hayFiltro    = filtroFecha.rango !== 'todos';

  const etiquetaFiltro = () => {
    if (!hayFiltro) return '';
    if (filtroFecha.rango === 'personalizado' && filtroFecha.desde && filtroFecha.hasta)
      return `${fmtFecha(filtroFecha.desde)} – ${fmtFecha(filtroFecha.hasta)}`;
    return RANGOS_FECHA.find(r => r.id === filtroFecha.rango)?.label || '';
  };

  return (
    <div style={{ padding:'1.4rem 1.5rem', fontFamily:"'Nunito','Segoe UI',system-ui,sans-serif", animation:'fadeUp 0.3s ease both' }}>
      {!tourVisto_RECV && <TourBienvenida_RECV onCerrar={cerrarTour_RECV} />}
      {mostrarEdu_RECV && <BannerEdu_RECV onClose={() => setMostrarEdu_RECV(false)} onVerTutorial={verTutorial_RECV} />}
      <BarraModoEdu_RECV onVerTutorial={verTutorial_RECV} />


      {/* TABS */}
      <div style={{ background:'white', borderBottom:'2px solid #f1f5f9', margin:'-1.4rem -1.5rem 1.4rem', padding:'0 1.5rem', display:'flex', alignItems:'flex-end', overflowX:'auto', scrollbarWidth:'none' }}>
        {TABS.map(tab => {
          const activo = tabActivo === tab.id;
          return (
            <button key={tab.id} onClick={() => setTabActivo(tab.id)}
              style={{ padding:'0.85rem 1.15rem 0.75rem', border:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:'0.8rem', whiteSpace:'nowrap',
                transition:'all 0.18s', background:'transparent', marginBottom:'-2px',
                color:        activo ? tab.textColor : '#94a3b8',
                fontWeight:   activo ? '800' : '600',
                borderBottom: activo ? `2.5px solid ${BLUE}` : '2.5px solid transparent' }}
              onMouseEnter={e => { if (!activo) e.currentTarget.style.color='#475569'; }}
              onMouseLeave={e => { if (!activo) e.currentTarget.style.color='#94a3b8'; }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.3rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <p style={{ fontSize:'0.82rem', color:'#94a3b8', margin:'0 0 0.15rem', fontWeight:'600' }}>
            {loading ? 'Cargando...' : `${totalItems} comprobante${totalItems!==1?'s':''} encontrado${totalItems!==1?'s':''}`}
          </p>
          {hayFiltro && !loading && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <span style={{ fontSize:'0.73rem', color:BLUE, fontWeight:'700' }}>
                📅 Filtrando: {etiquetaFiltro()}
                {filtroFecha.rango !== 'personalizado' && filtroFecha.desde && filtroFecha.hasta &&
                  ` (${fmtFecha(filtroFecha.desde)} – ${fmtFecha(filtroFecha.hasta)})`
                }
              </span>
              <button onClick={limpiarFechas}
                style={{ fontSize:'0.68rem', color:'#94a3b8', background:'none', border:'none',
                  cursor:'pointer', textDecoration:'underline', fontFamily:'inherit', padding:0 }}>
                Quitar filtro
              </button>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          {['csv','xml'].map(fmt => (
            <button key={fmt} onClick={() => exportar(fmt)} disabled={exportando===fmt}
              style={{ display:'flex', alignItems:'center', gap:'0.4rem', padding:'0.55rem 0.9rem',
                borderRadius:'10px', border:'1.5px solid #e2e8f0', background:'white',
                cursor:exportando===fmt?'not-allowed':'pointer', color:'#475569',
                fontWeight:'700', fontSize:'0.8rem', fontFamily:'inherit',
                transition:'all 0.15s', opacity:exportando===fmt?0.6:1 }}
              onMouseEnter={e => { if (exportando!==fmt) { e.currentTarget.style.borderColor= fmt==='csv'?'#10b981':'#0d9488'; e.currentTarget.style.color=fmt==='csv'?'#10b981':'#0d9488'; } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#475569'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {exportando===fmt ? 'Exportando…' : fmt.toUpperCase()}
            </button>
          ))}
          <button onClick={() => cargar(paginaActual, filtroFecha, tabActivo, filtroEstado, busqueda)}
            style={{ display:'flex', alignItems:'center', gap:'0.45rem', padding:'0.6rem 1.2rem',
              borderRadius:'12px', border:'none', cursor:'pointer',
              background:`linear-gradient(90deg,${BLUE},${BLUE_MID})`, color:'white',
              fontWeight:'700', fontSize:'0.85rem', fontFamily:'inherit',
              boxShadow:`0 4px 12px rgba(21,56,154,0.33)`, transition:'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(21,56,154,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=`0 4px 12px rgba(21,56,154,0.33)`; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation:loading?'spin 1s linear infinite':'none' }}>
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.3rem' }}>
        {[
          { label:'Total Recibido', value:fmtMoney(resumen.totalRegistrados), color:BLUE,      bg:BLUE_LIGHTER,
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> },
          { label:'Registrados',    value:resumen.registrados,                color:'#10b981', bg:'#ecfdf5',
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
          { label:'Pendientes',     value:resumen.pendientes,                 color:'#f59e0b', bg:'#fffbeb',
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          { label:'IVA Soportado',  value:fmtMoney(resumen.totalIVA),         color:'#6366f1', bg:'#eef2ff',
            icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        ].map((s, i) => (
          <div key={i} style={{ background:'white', borderRadius:'16px', padding:'1rem 1.2rem',
            boxShadow:'0 2px 12px rgba(0,0,0,0.05)', display:'flex', alignItems:'center',
            gap:'0.9rem', animation:`fadeUp 0.4s ease ${i*0.06}s both` }}>
            <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:s.bg,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{s.icon}</div>
            <div>
              <p style={{ margin:0, fontSize:'0.7rem', color:'#94a3b8', fontWeight:'700',
                textTransform:'uppercase', letterSpacing:'0.4px' }}>{s.label}</p>
              {loading
                ? <div style={{marginTop:'0.3rem'}}><Skeleton h="22px" w="70px"/></div>
                : <p style={{ margin:'0.1rem 0 0', fontSize:'1.2rem', fontWeight:'900',
                    color:'#0f172a', letterSpacing:'-0.3px' }}>{s.value}</p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ background:'white', borderRadius:'16px', padding:'0.9rem 1.2rem',
        boxShadow:'0 2px 12px rgba(0,0,0,0.05)', marginBottom:'1.2rem',
        display:'flex', alignItems:'center', gap:'0.85rem', flexWrap:'wrap' }}>

        <div style={{ position:'relative', flex:1, minWidth:'200px' }}>
          <input placeholder="Buscar por número o emisor..." value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ padding:'0.58rem 1rem 0.58rem 2.3rem', border:'1.5px solid #e2e8f0',
              borderRadius:'10px', fontSize:'0.84rem', color:'#334155', outline:'none',
              background:'#f8fafc', width:'100%', boxSizing:'border-box',
              fontFamily:'inherit', transition:'all 0.2s' }}
            onFocus={e => { e.target.style.borderColor=BLUE; e.target.style.background='white'; e.target.style.boxShadow=`0 0 0 3px rgba(21,56,154,0.1)`; }}
            onBlur={e  => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#f8fafc'; e.target.style.boxShadow='none'; }} />
          <svg style={{ position:'absolute', left:'0.7rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {busqueda && (
            <button onClick={() => setBusqueda('')}
              style={{ position:'absolute', right:'0.6rem', top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer', color:'#94a3b8',
                display:'flex', alignItems:'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <FiltroFechas filtro={filtroFecha} onCambiar={setFiltroFecha} />

        {/* BOTÓN LIMPIAR FECHA — igual que FacturasEmitidas */}
        {hayFiltro && (
          <button onClick={limpiarFechas}
            style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.38rem 0.7rem', borderRadius:'99px', border:'none', background:'#fef3c7', color:'#d97706', fontSize:'0.73rem', fontWeight:'800', cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fde68a'}
            onMouseLeave={e => e.currentTarget.style.background = '#fef3c7'}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Limpiar fecha
          </button>
        )}

        <div style={{ width:'1px', height:'28px', background:'#e8edf3', flexShrink:0 }} />

        <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
          {[{ key:'todos', label:'Todos' }, { key:'registrado', label:'Registrados' }, { key:'pendiente', label:'Pendientes' }].map(f => (
            <button key={f.key} onClick={() => setFiltroEstado(f.key)}
              style={{ padding:'0.42rem 0.85rem', borderRadius:'99px', border:'1.5px solid',
                fontSize:'0.77rem', fontWeight:'700', fontFamily:'inherit', cursor:'pointer',
                transition:'all 0.15s',
                borderColor: filtroEstado===f.key ? BLUE : '#e2e8f0',
                background:  filtroEstado===f.key ? `linear-gradient(135deg,${BLUE},${BLUE_MID})` : 'white',
                color:       filtroEstado===f.key ? 'white' : '#64748b',
                boxShadow:   filtroEstado===f.key ? '0 4px 12px rgba(21,56,154,0.3)' : 'none' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLA */}
      <div style={{ background:'white', borderRadius:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', overflow:'hidden', animation:'fadeUp 0.4s ease 0.2s both' }}>
        <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 130px 110px 130px 110px 64px', padding:'0.7rem 1.4rem', borderBottom:'2px solid #f1f5f9', background:'#fafafa' }}>
          {['Comprobante','Emisor','Tipo','Fecha','Estado','Total',''].map(col => (
            <span key={col} style={{ fontSize:'0.68rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>{col}</span>
          ))}
        </div>

        {error && <div style={{ padding:'1.5rem', textAlign:'center', color:'#b91c1c', fontSize:'0.86rem', background:'#fef2f2' }}>⚠️ {error}</div>}

        {loading && Array.from({ length:5 }).map((_, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'160px 1fr 130px 110px 130px 110px 64px', padding:'1rem 1.4rem', alignItems:'center', borderBottom:'1px solid #f8fafc', gap:'0.5rem' }}>
            <Skeleton h="13px" w="120px"/>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}><Skeleton h="30px" w="30px" radius="8px"/><Skeleton h="13px"/></div>
            <Skeleton h="20px" w="100px" radius="99px"/>
            <Skeleton h="13px" w="80px"/>
            <Skeleton h="22px" w="90px" radius="99px"/>
            <Skeleton h="13px" w="70px"/>
            <div style={{ display:'flex', gap:'0.3rem' }}><Skeleton h="28px" w="28px" radius="7px"/><Skeleton h="28px" w="28px" radius="7px"/></div>
          </div>
        ))}

        {!loading && !error && comprobantes.length === 0 && (
          <div style={{ padding:'3.5rem', textAlign:'center' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:'1rem' }}>
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
            </svg>
            <p style={{ margin:0, fontWeight:'800', fontSize:'1rem', color:'#64748b' }}>
              {hayFiltro
                ? `No hay comprobantes para ${etiquetaFiltro()}`
                : busqueda || filtroEstado !== 'todos'
                  ? 'Sin resultados para ese filtro'
                  : 'Aún no tienes comprobantes recibidos'}
            </p>
            <p style={{ margin:'0.4rem 0 0', fontSize:'0.83rem', color:'#94a3b8' }}>
              {hayFiltro
                ? <><span>No se encontraron documentos en ese período. </span>
                    <button onClick={limpiarFechas}
                      style={{ color:BLUE, background:'none', border:'none', cursor:'pointer',
                        fontFamily:'inherit', fontSize:'0.83rem', fontWeight:'700',
                        textDecoration:'underline', padding:0 }}>
                      Ver todos
                    </button>
                  </>
                : busqueda || filtroEstado !== 'todos'
                  ? 'Intenta con otros criterios'
                  : 'Cuando alguien emita un comprobante a tu nombre, aparecerá aquí automáticamente'
              }
            </p>
          </div>
        )}

        {!loading && comprobantes.map((c, i) => {
          const est    = ESTADO_CONFIG[c.estado]  || ESTADO_CONFIG.registrado;
          const tip    = TIPO_CONFIG[c.tipo]      || TIPO_CONFIG.factura;
          const nombre = c.proveedor?.nombres_apellidos || c.proveedor?.razon_social || '—';
          const ident  = c.proveedor?.identificacion || '';
          const color  = COLORS_AVATAR[i % COLORS_AVATAR.length];

          return (
            <div key={c.id_comprobante}
              onMouseEnter={() => setHoveredRow(c.id_comprobante)}
              onMouseLeave={() => setHoveredRow(null)}
              style={{ display:'grid', gridTemplateColumns:'160px 1fr 130px 110px 130px 110px 64px',
                padding:'0.85rem 1.4rem', alignItems:'center',
                borderBottom: i < comprobantes.length-1 ? '1px solid #f8fafc' : 'none',
                background: hoveredRow===c.id_comprobante ? '#f8faff' : 'transparent',
                transition:'background 0.15s', animation:`fadeUp 0.3s ease ${i*0.04}s both` }}>

              <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:est.dot, flexShrink:0 }} />
                <span style={{ fontSize:'0.74rem', fontWeight:'700', color:'#64748b',
                  fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {c.numero_comprobante || '—'}
                </span>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:'0.55rem', minWidth:0 }}>
                <div style={{ width:'30px', height:'30px', borderRadius:'9px', background:color,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'0.75rem', fontWeight:'800', color:'white', flexShrink:0 }}>
                  {nombre.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:'0.86rem', fontWeight:'700', color:'#0f172a',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nombre}</div>
                  {ident && <div style={{ fontSize:'0.69rem', color:'#94a3b8', fontFamily:'monospace' }}>{ident}</div>}
                </div>
              </div>

              <span style={{ display:'inline-flex', alignItems:'center', padding:'0.18rem 0.55rem',
                borderRadius:'99px', background:tip.bg, color:tip.color,
                fontSize:'0.68rem', fontWeight:'800', width:'fit-content', whiteSpace:'nowrap' }}>
                {tip.label}
              </span>

              <span style={{ fontSize:'0.79rem', color:'#64748b' }}>{fmtFecha(c.fecha_emision)}</span>

              <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem',
                padding:'0.22rem 0.65rem', borderRadius:'99px', background:est.bg, color:est.color,
                fontSize:'0.72rem', fontWeight:'800', width:'fit-content' }}>
                <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:est.color }} />
                {est.label}
              </span>

              <span style={{ fontSize:'0.88rem', fontWeight:'800', color:'#0f172a' }}>{fmtMoney(c.total)}</span>

              <div style={{ display:'flex', gap:'0.3rem' }}>
                <button title="Ver detalle" onClick={() => abrirModal(c)}
                  style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1.5px solid #e2e8f0',
                    background:'white', cursor:'pointer', display:'flex', alignItems:'center',
                    justifyContent:'center', color:'#64748b', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background=BLUE_LIGHTER; e.currentTarget.style.borderColor=BLUE_MID; e.currentTarget.style.color=BLUE_MID; }}
                  onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
                <DescargaMenuComp comp={c} />
              </div>
            </div>
          );
        })}

        {!loading && totalPaginas > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0.85rem 1.4rem', borderTop:'1px solid #f1f5f9', background:'#fafafa' }}>
            <span style={{ fontSize:'0.78rem', color:'#94a3b8', fontWeight:'600' }}>
              Mostrando {Math.min((paginaActual-1)*POR_PAGINA+1, totalItems)}–{Math.min(paginaActual*POR_PAGINA, totalItems)} de {totalItems}
            </span>
            <div style={{ display:'flex', gap:'0.3rem' }}>
              <PaginBtn onClick={() => setPaginaActual(p => Math.max(1,p-1))} disabled={paginaActual===1}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </PaginBtn>
              {Array.from({ length:Math.min(5,totalPaginas) }, (_, i) => {
                let page = i+1;
                if (totalPaginas>5) {
                  if (paginaActual<=3) page=i+1;
                  else if (paginaActual>=totalPaginas-2) page=totalPaginas-4+i;
                  else page=paginaActual-2+i;
                }
                return <PaginBtn key={page} onClick={() => setPaginaActual(page)} active={paginaActual===page}>{page}</PaginBtn>;
              })}
              <PaginBtn onClick={() => setPaginaActual(p => Math.min(totalPaginas,p+1))} disabled={paginaActual===totalPaginas}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </PaginBtn>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DETALLE */}
      {modalComp && createPortal(
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:9999,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
          backdropFilter:'blur(4px)', animation:'fadeUp 0.2s ease' }}
          onClick={e => { if (e.target===e.currentTarget) setModalComp(null); }}>
          <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'640px',
            maxHeight:'87vh', overflow:'hidden', display:'flex', flexDirection:'column',
            boxShadow:'0 32px 80px rgba(0,0,0,0.3)', animation:'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>

            <div style={{ padding:'1.2rem 1.5rem', background:`linear-gradient(135deg,#0f1f4b,${BLUE})`,
              borderRadius:'20px 20px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                  <h3 style={{ margin:0, fontSize:'0.95rem', fontWeight:'900', color:'white' }}>
                    Detalle del Comprobante
                  </h3>
                  {modalComp.tipo && (
                    <span style={{ padding:'0.15rem 0.55rem', borderRadius:'99px',
                      background:'rgba(255,255,255,0.2)', color:'white', fontSize:'0.7rem', fontWeight:'700' }}>
                      {TIPO_CONFIG[modalComp.tipo]?.label || modalComp.tipo}
                    </span>
                  )}
                </div>
                <p style={{ margin:'0.1rem 0 0', fontSize:'0.73rem', color:'rgba(255,255,255,0.6)', fontFamily:'monospace' }}>
                  {modalComp.numero_comprobante}
                </p>
              </div>
              <button onClick={() => setModalComp(null)}
                style={{ width:'32px', height:'32px', borderRadius:'8px', border:'none',
                  background:'rgba(255,255,255,0.15)', cursor:'pointer', display:'flex',
                  alignItems:'center', justifyContent:'center', color:'white', transition:'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ padding:'1.4rem 1.5rem', overflowY:'auto', flex:1 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.85rem', marginBottom:'1.2rem' }}>
                {[
                  { label:'Emisor',       value: modalComp.proveedor?.nombres_apellidos || '—' },
                  { label:'RUC / Cédula', value: modalComp.proveedor?.identificacion   || '—' },
                  { label:'Fecha',        value: fmtFecha(modalComp.fecha_emision) },
                  { label:'Estado',       value: ESTADO_CONFIG[modalComp.estado]?.label || '—', est: modalComp.estado },
                ].map(item => (
                  <div key={item.label} style={{ background:'#f8fafc', borderRadius:'10px', padding:'0.7rem 0.9rem' }}>
                    <p style={{ margin:0, fontSize:'0.68rem', fontWeight:'800', color:'#94a3b8',
                      textTransform:'uppercase', letterSpacing:'0.4px' }}>{item.label}</p>
                    {item.est
                      ? <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem',
                          marginTop:'0.3rem', padding:'0.2rem 0.6rem', borderRadius:'99px',
                          background:ESTADO_CONFIG[item.est]?.bg, color:ESTADO_CONFIG[item.est]?.color,
                          fontSize:'0.76rem', fontWeight:'800' }}>
                          <span style={{ width:'5px', height:'5px', borderRadius:'50%',
                            background:ESTADO_CONFIG[item.est]?.color }} />{item.value}
                        </span>
                      : <p style={{ margin:'0.2rem 0 0', fontSize:'0.88rem', fontWeight:'700', color:'#0f172a' }}>{item.value}</p>
                    }
                  </div>
                ))}
              </div>

              {modalComp.detalles?.length > 0 && (
                <div style={{ marginBottom:'1.2rem' }}>
                  <p style={{ margin:'0 0 0.6rem', fontSize:'0.72rem', fontWeight:'800', color:'#475569',
                    textTransform:'uppercase', letterSpacing:'0.4px' }}>Productos / Servicios</p>
                  <div style={{ border:'1px solid #f1f5f9', borderRadius:'12px', overflow:'hidden' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px 90px',
                      padding:'0.5rem 0.9rem', background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                      {['Descripción','Cant.','P. Unit.','Total'].map(h => (
                        <span key={h} style={{ fontSize:'0.66rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase' }}>{h}</span>
                      ))}
                    </div>
                    {modalComp.detalles.map((d, i) => (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 60px 90px 90px',
                        padding:'0.65rem 0.9rem',
                        borderBottom: i<modalComp.detalles.length-1 ? '1px solid #f8fafc':'none',
                        background: i%2===0?'white':'#fafafa' }}>
                        <span style={{ fontSize:'0.84rem', fontWeight:'700', color:'#0f172a' }}>{d.descripcion || '—'}</span>
                        <span style={{ fontSize:'0.82rem', color:'#64748b', textAlign:'center' }}>{d.cantidad}</span>
                        <span style={{ fontSize:'0.82rem', color:'#64748b', textAlign:'right' }}>{fmtMoney(d.precio_unitario)}</span>
                        <span style={{ fontSize:'0.84rem', fontWeight:'700', color:'#0f172a', textAlign:'right' }}>{fmtMoney(d.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background:`linear-gradient(135deg,${BLUE_LIGHTER},${BLUE_LIGHT})`,
                borderRadius:'12px', padding:'1rem 1.1rem', border:`1px solid #bfdbfe`, marginBottom:'1rem' }}>
                {[
                  { label:'Subtotal 0%',  value:fmtMoney(modalComp.subtotal_0),   show:parseFloat(modalComp.subtotal_0||0)>0 },
                  { label:'Subtotal IVA', value:fmtMoney(modalComp.subtotal_iva), show:parseFloat(modalComp.subtotal_iva||0)>0 },
                  { label:`IVA ${modalComp.porcentaje_iva||15}%`, value:fmtMoney(modalComp.iva), show:parseFloat(modalComp.iva||0)>0 },
                  { label:'Descuento',    value:`- ${fmtMoney(modalComp.descuento)}`, show:parseFloat(modalComp.descuento||0)>0 },
                ].filter(r => r.show).map(r => (
                  <div key={r.label} style={{ display:'flex', justifyContent:'space-between',
                    padding:'0.35rem 0', borderBottom:'1px solid #bfdbfe' }}>
                    <span style={{ fontSize:'0.82rem', color:'#64748b' }}>{r.label}</span>
                    <span style={{ fontSize:'0.82rem', fontWeight:'700', color:'#334155' }}>{r.value}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'0.5rem', paddingTop:'0.5rem' }}>
                  <span style={{ fontSize:'0.88rem', fontWeight:'900', color:'#0f172a' }}>TOTAL</span>
                  <span style={{ fontSize:'1.15rem', fontWeight:'900', color:'#0f172a' }}>{fmtMoney(modalComp.total)}</span>
                </div>
              </div>

              {modalComp.observaciones && (
                <div style={{ marginBottom:'1rem', padding:'0.8rem 1rem', background:'#fffbeb',
                  borderRadius:'10px', border:'1px solid #fde68a' }}>
                  <p style={{ margin:0, fontSize:'0.75rem', fontWeight:'800', color:'#92400e',
                    textTransform:'uppercase', letterSpacing:'0.4px' }}>Observaciones</p>
                  <p style={{ margin:'0.3rem 0 0', fontSize:'0.84rem', color:'#78350f' }}>{modalComp.observaciones}</p>
                </div>
              )}

              <div style={{ display:'flex', gap:'0.6rem' }}>
                {[
                  { fmt:'xml', label:'Descargar XML', sublabel:'Comprobante electrónico', color:'#0d9488', bg:'#f0fdf4', border:'#6ee7b7',
                    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="10" y1="13" x2="14" y2="17"/><line x1="14" y1="13" x2="10" y2="17"/></svg> },
                  { fmt:'pdf', label:'Descargar PDF', sublabel:'Formato imprimible', color:'#ef4444', bg:'#fef2f2', border:'#fca5a5',
                    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg> },
                ].filter(o => (TIPO_CONFIG[modalComp.tipo]?.descargas || ['xml','pdf']).includes(o.fmt))
                 .map(({ fmt, label, sublabel, color, bg, border, icon }) => (
                  <button key={fmt} onClick={() => descargarModal(fmt)}
                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                      gap:'0.5rem', padding:'0.65rem', borderRadius:'10px',
                      border:`1.5px solid ${border}`, background:bg, color, fontFamily:'inherit',
                      fontSize:'0.82rem', fontWeight:'700', cursor:'pointer',
                      transition:'all 0.15s', flexDirection:'column' }}
                    onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                    {icon}
                    <span>{label}</span>
                    <span style={{ fontSize:'0.68rem', fontWeight:'600', opacity:0.7 }}>{sublabel}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes popIn   { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
        @keyframes dropIn  { from{opacity:0;transform:translateY(-8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>
    </div>
  );
};

export default ComprobantesRecibidos;
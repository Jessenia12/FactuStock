import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientesService, productosService } from '../services/api';
import ReactDOM from 'react-dom';


/* ════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — Proforma / Cotización
   Primera visita: muestra el modal explicativo al estudiante
   localStorage key: prof_tour_visto_<userId>
════════════════════════════════════════════════════════ */




/* ════════════════════════════════════════════════════════
   CONSTANTES GLOBALES — API, colores, helpers
════════════════════════════════════════════════════════ */
const API_BASE = 'https://factustock-efdi.onrender.com';
const API      = `${API_BASE}/api`;
const getToken = () => localStorage.getItem('token');
const hdrs     = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

// Paleta AZUL (comprobantes / proforma)
const C = {
  primary : '#0f1f4b',
  mid     : '#2563eb',
  light   : '#dbeafe',
  lighter : '#eff6ff',
  border  : '#bfdbfe',
};

// Paleta MORADA (stepper de BarraContexto)
const MORADO = {
  primary : '#6d28d9',
  mid     : '#7c3aed',
  light   : '#ede9fe',
  lighter : '#f5f3ff',
  border  : '#c4b5fd',
};

// Pasos del stepper
const PASOS = [
  { n: 1, label: 'Cliente' },
  { n: 2, label: 'Productos' },
  { n: 3, label: 'Confirmación' },
];

// Helpers de fecha
const hoy = () => new Date().toISOString().slice(0, 10);
const en30dias = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

// Formateadores
const fmtMoney = (v = 0) =>
  `$${parseFloat(v).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtFecha = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

// Estilos de inputs
const inputBase = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.55rem 0.75rem',
  border: '1.5px solid #e2e8f0', borderRadius: '9px',
  fontSize: '0.85rem', fontFamily: 'inherit', color: '#0f172a',
  background: 'white', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
};
const inputRO = { ...inputBase, background: '#f8fafc', color: '#64748b', cursor: 'default' };
const lbl = { display: 'block', fontSize: '0.73rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.3px' };

/* ── Componente Buscador con dropdown ──────────────────── */
const Buscador = ({ placeholder, items, loading, selected, onSelect, onClear, renderItem, renderSelected }) => {
  const [query, setQuery]   = React.useState('');
  const [open,  setOpen]    = React.useState(false);
  const ref                 = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = items.filter(it =>
    renderItem(it).toLowerCase().includes(query.toLowerCase())
  ).slice(0, 30);

  if (selected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ ...inputRO, flex: 1 }}>{renderSelected(selected)}</div>
        <button onClick={onClear} style={{ padding: '0.52rem 0.75rem', borderRadius: '9px', border: '1.5px solid #fecaca', background: 'white', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>✕ Quitar</button>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={loading ? 'Cargando...' : placeholder}
        disabled={loading}
        style={{ ...inputBase, borderColor: open ? C.mid : '#e2e8f0', boxShadow: open ? `0 0 0 3px rgba(37,99,235,0.08)` : 'none' }}
      />
      {open && !loading && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999, background: 'white', border: `1.5px solid ${C.border}`, borderRadius: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: '240px', overflowY: 'auto' }}>
          {filtered.length === 0
            ? <p style={{ padding: '0.9rem 1rem', fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Sin resultados</p>
            : filtered.map((it, i) => (
              <div key={i}
                onMouseDown={() => { onSelect(it); setQuery(''); setOpen(false); }}
                style={{ padding: '0.65rem 1rem', fontSize: '0.83rem', color: '#0f172a', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = C.lighter}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                {renderItem(it)}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

const EDU_BG_PRO     = '#f0f7ff';
const EDU_BORDER_PRO = '#bfdbfe';

const TourBienvenida_PRO = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📋', titulo: '¿Qué es una Proforma?', texto: 'Es un documento de cotización o presupuesto previo a la venta. NO tiene validez tributaria ni descuenta stock. Se usa para que el cliente apruebe el precio antes de emitir la factura oficial.' },
    { emoji: '👤', titulo: 'Paso 1: Cliente y vigencia', texto: 'Selecciona el cliente, la fecha de emisión y la fecha de vencimiento de la cotización. Las proformas suelen tener vigencia de 15 a 30 días según tu política comercial.' },
    { emoji: '📦', titulo: 'Paso 2: Productos y servicios', texto: 'Agrega los ítems como en una factura normal. Los cálculos de IVA y totales son idénticos pero el stock NO se descuenta al guardar la proforma, solo al convertirla en factura.' },
    { emoji: '🔄', titulo: 'Convertir a Factura', texto: 'Cuando el cliente aprueba, usa "Convertir a Factura". Esto crea una nueva factura con todos los datos de la proforma y SÍ descuenta el stock del inventario automáticamente.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Las proformas son herramientas comerciales muy útiles. En Ecuador no son comprobantes tributarios autorizados por el SRI, pero tienen valor contractual entre las partes comerciales.' }
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
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a)', padding: '1.3rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>
              PROFORMA
            </span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: '#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', paddingRight: '2rem' }}>Crear Proforma / Cotización</p>
          <p style={{ margin: '0.18rem 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.62)' }}>Te explicamos cómo funciona paso a paso</p>
          <button onClick={onCerrar}
            style={{ position: 'absolute', top: '1rem', right: '1rem', width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', padding: '0.85rem 1.5rem 0' }}>
          {pasos.map((_, i) => (
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= paso ? '#2563eb' : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ padding: '1.2rem 1.5rem', minHeight: '150px' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: EDU_BG_PRO, border: `2px solid ${EDU_BORDER_PRO}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>
              {actual.emoji}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '0.94rem', color: '#0f172a' }}>{actual.titulo}</p>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.65 }}>{actual.texto}</p>
            </div>
          </div>
        </div>
        <div style={{ padding: '0.85rem 1.5rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: '700' }}>{paso + 1} de {pasos.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {paso > 0 && (
              <button onClick={() => setPaso(p => p - 1)}
                style={{ padding: '0.52rem 1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Atrás
              </button>
            )}
            {paso < pasos.length - 1 ? (
              <button onClick={() => setPaso(p => p + 1)}
                style={{ padding: '0.52rem 1.2rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#15389a,#2563eb)', color: 'white', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(21,56,154,0.3)' }}>
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


/* ════════════════════════════════════════════════════════
   TOUR — Proforma / Cotización | key: prof_tour
════════════════════════════════════════════════════════ */
// TOUR_KEY_PROF → getTourKeyProf() definido en el componente
const TourBienvenida_PROF = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📋', titulo: '¿Qué es una Proforma?', texto: 'Cotización o presupuesto previo a la factura oficial. No tiene efecto tributario ni descuenta stock. Es un documento informativo antes de confirmar la venta.' },
    { emoji: '👤', titulo: 'Paso 1 — Cliente y Datos', texto: 'Selecciona el cliente, fecha de la proforma y fecha de validez (generalmente 30 días desde la emisión).' },
    { emoji: '🛒', titulo: 'Paso 2 — Productos', texto: 'Agrega productos con cantidades y precios. El PDF se genera con el logo y datos de Configuración del Negocio.' },
    { emoji: '📄', titulo: 'Descargar PDF', texto: 'Descarga la proforma como PDF para enviarla al cliente. Si acepta, conviértela en factura desde Comprobantes Emitidos.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Las proformas no aparecen en el ATS ni en reportes de ventas. Son documentos previos sin validez tributaria ante el SRI.' },
  ];
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return ReactDOM.createPortal(
    <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9999,background:'rgba(10,18,40,0.72)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'tourFadeIn 0.22s ease' }}>
      <div style={{ background:'white',borderRadius:'22px',width:'100%',maxWidth:'460px',boxShadow:'0 32px 80px rgba(0,0,0,0.3)',overflow:'hidden',animation:'tourPopIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background:'linear-gradient(135deg,#0f1f4b,#15389a)',padding:'1.3rem 1.5rem',position:'relative' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.35rem' }}>
            <span style={{ background:'rgba(255,255,255,0.2)',borderRadius:'99px',padding:'0.2rem 0.65rem',fontSize:'0.67rem',fontWeight:'800',color:'white',letterSpacing:'0.5px' }}>PROFORMA</span>
            <span style={{ background:'#fbbf24',borderRadius:'99px',padding:'0.2rem 0.65rem',fontSize:'0.67rem',fontWeight:'800',color:'#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin:0,fontSize:'1.1rem',fontWeight:'900',color:'white',paddingRight:'2rem' }}>Proforma / Cotización</p>
          <p style={{ margin:'0.18rem 0 0',fontSize:'0.76rem',color:'rgba(255,255,255,0.65)' }}>Te explicamos cómo funciona este módulo</p>
          <button onClick={onCerrar} style={{ position:'absolute',top:'1rem',right:'1rem',width:'30px',height:'30px',borderRadius:'8px',border:'none',background:'rgba(255,255,255,0.15)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'white' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.28)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display:'flex',gap:'0.35rem',padding:'0.85rem 1.5rem 0' }}>{pasos.map((_,i)=>(<div key={i} style={{ height:'4px',flex:1,borderRadius:'99px',background:i<=paso?'#15389a':'#e2e8f0',transition:'background 0.3s' }}/>))}</div>
        <div style={{ padding:'1.2rem 1.5rem',minHeight:'150px' }}>
          <div style={{ display:'flex',gap:'1rem',alignItems:'flex-start' }}>
            <div style={{ width:'52px',height:'52px',borderRadius:'14px',background:'#f0f7ff',border:'2px solid #bfdbfe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.75rem',flexShrink:0 }}>{actual.emoji}</div>
            <div><p style={{ margin:0,fontWeight:'900',fontSize:'0.94rem',color:'#0f172a' }}>{actual.titulo}</p><p style={{ margin:'0.4rem 0 0',fontSize:'0.82rem',color:'#475569',lineHeight:1.65 }}>{actual.texto}</p></div>
          </div>
        </div>
        <div style={{ padding:'0.85rem 1.5rem 1.2rem',display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #f1f5f9' }}>
          <span style={{ fontSize:'0.73rem',color:'#94a3b8',fontWeight:'700' }}>{paso+1} de {pasos.length}</span>
          <div style={{ display:'flex',gap:'0.5rem' }}>
            {paso>0&&(<button onClick={()=>setPaso(p=>p-1)} style={{ padding:'0.52rem 1rem',borderRadius:'10px',border:'1.5px solid #e2e8f0',background:'white',fontSize:'0.8rem',fontWeight:'700',color:'#64748b',cursor:'pointer',fontFamily:'inherit' }}>← Atrás</button>)}
            {paso<pasos.length-1?(<button onClick={()=>setPaso(p=>p+1)} style={{ padding:'0.52rem 1.2rem',borderRadius:'10px',border:'none',background:'linear-gradient(135deg,#0f1f4b,#15389a)',color:'white',fontSize:'0.8rem',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 12px rgba(15,31,75,0.3)' }}>Siguiente →</button>):(<button onClick={onCerrar} style={{ padding:'0.52rem 1.4rem',borderRadius:'10px',border:'none',background:'linear-gradient(135deg,#059669,#10b981)',color:'white',fontSize:'0.8rem',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 12px rgba(5,150,105,0.3)' }}>¡Entendido! Empezar 🚀</button>)}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
const BannerEdu_PROF = ({ onClose }) => (
  <div style={{ marginBottom:'1rem',background:'linear-gradient(135deg,#f0f7ff,#e0f2fe)',border:'1.5px solid #bfdbfe',borderRadius:'14px',padding:'0.85rem 1.2rem',display:'flex',alignItems:'center',gap:'0.85rem',animation:'tourFadeIn 0.3s ease' }}>
    <div style={{ width:'36px',height:'36px',borderRadius:'10px',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0 }}>🎓</div>
    <div style={{ flex:1 }}>
      <p style={{ margin:0,fontWeight:'900',fontSize:'0.82rem',color:'#1d4ed8' }}>Modo Educativo Activo</p>
      <p style={{ margin:'0.1rem 0 0',fontSize:'0.76rem',color:'#3b82f6',lineHeight:1.4 }}>Primera visita. Los datos son de práctica, ¡explora sin miedo!</p>
    </div>
    <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#94a3b8',padding:'0.2rem',display:'flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>
);
const BarraModoEdu_PROF = ({ onVerTutorial }) => (
  <div style={{ background:'linear-gradient(90deg,#fffbeb,#fef3c7)',border:'1.5px solid #fde68a',borderRadius:'12px',padding:'0.65rem 1rem',marginBottom:'1.1rem',display:'flex',alignItems:'center',gap:'0.65rem' }}>
    <span style={{ fontSize:'0.95rem' }}>🏫</span>
    <p style={{ margin:0,fontSize:'0.77rem',color:'#92400e',fontWeight:'700',flex:1 }}>Modo Educativo — Los datos son de práctica. Explora sin miedo.</p>
    <button onClick={onVerTutorial} style={{ padding:'0.28rem 0.65rem',borderRadius:'8px',border:'1.5px solid #fbbf24',background:'white',color:'#92400e',fontSize:'0.7rem',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:'0.3rem' }}>📖 Ver tutorial</button>
  </div>
);



const Proforma = ({ onVolver }) => {


  // ── Tour educativo (por usuario) ─────────────────────
  const getTourKey = () => {
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); const uid = u?.id_usuario || u?.email || 'default'; return `prof-tour-${uid}`; }
    catch { return 'prof-tour'; }
  };
  const [tourVisto_PROF, setTourVisto_PROF] = useState(() => !!localStorage.getItem(getTourKey()));
  const cerrarTour_PROF = () => { localStorage.setItem(getTourKey(), '1'); setTourVisto_PROF(true); };
  const verTutorial_PROF = () => { localStorage.removeItem(getTourKey()); setTourVisto_PROF(false); };

  const navigate = useNavigate();

  const [clientes,         setClientes]         = useState([]);
  const [productos,        setProductos]         = useState([]);
  const [loadingDatos,     setLoadingDatos]      = useState(true);
  const [clienteSelec,     setClienteSelec]      = useState(null);
  const [fecha,            setFecha]             = useState(hoy());
  const [fechaValidez,     setFechaValidez]      = useState(en30dias());
  const [observaciones,    setObservaciones]     = useState('');
  const [lineas,           setLineas]            = useState([]);
  const [guardando,        setGuardando]         = useState(false);
  const [errores,          setErrores]           = useState({});
  const [errorApi,         setErrorApi]          = useState('');
  const [exito,            setExito]             = useState(false);
  const [proformaGuardada, setProformaGuardada]  = useState(null);
  const [convirtiendo,     setConvirtiendo]      = useState(false);
  const [convertida,       setConvertida]        = useState(null);
  const [descargandoPDF,   setDescargandoPDF]    = useState(false);

  const pasoActivo = exito ? 3 : (lineas.length > 0 || clienteSelec) ? 2 : 1;

  useEffect(() => {
    (async () => {
      try {
        const [c, p] = await Promise.all([
          clientesService.listar({ porPagina: 200 }),
          productosService.listar({ por_pagina: 200, solo_con_stock: false }),
        ]);
        setClientes(c.items || []);
        setProductos(p.items || []);
      } catch { setErrorApi('Error cargando datos del servidor.'); }
      finally  { setLoadingDatos(false); }
    })();
  }, []);

  const calcLinea = (l) => {
    const subtotal = parseFloat(l.cantidad || 0) * parseFloat(l.precio || 0);
    const desc     = parseFloat(l.descuento || 0);
    const base     = subtotal - desc;
    const ivaP     = parseFloat(l.porcentaje_iva || 0);
    const iva      = ivaP > 0 ? base * (ivaP / 100) : 0;
    return { subtotal, desc, base, iva, total: base + iva };
  };

  const totales = lineas.reduce((acc, l) => {
    const c = calcLinea(l);
    if (parseFloat(l.porcentaje_iva || 0) === 0) acc.sub0  += c.base;
    else                                          acc.subIva += c.base;
    acc.iva   += c.iva;
    acc.desc  += c.desc;
    acc.total += c.total;
    return acc;
  }, { sub0: 0, subIva: 0, iva: 0, desc: 0, total: 0 });

  const ivaGeneral = lineas.length > 0
    ? Math.max(...lineas.map(l => parseFloat(l.porcentaje_iva || 0)))
    : 15;

  const agregarLinea = (producto) => {
    if (lineas.find(l => l.id_producto === producto.id_producto)) return;
    setLineas(prev => [...prev, {
      id_producto:    producto.id_producto,
      nombre:         producto.nombre,
      codigo:         producto.codigo,
      cantidad:       1,
      precio:         parseFloat(producto.precio_unitario || 0),
      porcentaje_iva: parseFloat(producto.porcentaje_iva || 0),
      stock:          producto.stock,
      descuento:      0,
    }]);
  };

  const eliminarLinea   = (idx) => setLineas(prev => prev.filter((_, i) => i !== idx));
  const actualizarLinea = (idx, campo, valor) => setLineas(prev => prev.map((l, i) => i === idx ? { ...l, [campo]: valor } : l));

  const validar = () => {
    const e = {};
    if (!clienteSelec)       e.cliente = 'Selecciona un cliente';
    if (!fecha)              e.fecha   = 'Ingresa la fecha';
    if (lineas.length === 0) e.lineas  = 'Agrega al menos un producto';
    lineas.forEach((l, i) => {
      if (!l.cantidad || l.cantidad <= 0) e[`cant_${i}`]   = 'Cantidad inválida';
      if (!l.precio   || l.precio   <= 0) e[`precio_${i}`] = 'Precio inválido';
    });
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    if (!validar()) return;
    setGuardando(true); setErrorApi('');
    try {
      const body = {
        id_persona_comercial: clienteSelec.id_persona_comercial,
        fecha_emision:  fecha,
        fecha_validez:  fechaValidez || null,
        porcentaje_iva: ivaGeneral,
        observaciones:  observaciones || null,
        detalles: lineas.map(l => ({
          id_producto:     l.id_producto,
          cantidad:        parseInt(l.cantidad),
          precio_unitario: parseFloat(l.precio),
          porcentaje_iva:  parseFloat(l.porcentaje_iva),
          descuento:       parseFloat(l.descuento || 0),
        })),
      };
      const r = await fetch(`${API}/proformas/`, {
        method: 'POST', headers: hdrs(), body: JSON.stringify(body)
      });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error HTTP ${r.status}`);
      }
      const data = await r.json();
      setProformaGuardada(data);
      setExito(true);
    } catch (e) {
      setErrorApi(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const convertirAFactura = async () => {
    if (!proformaGuardada) return;
    setConvirtiendo(true); setErrorApi('');
    try {
      const r = await fetch(`${API}/proformas/${proformaGuardada.id_proforma}/convertir`, {
        method: 'POST', headers: hdrs()
      });
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error HTTP ${r.status}`);
      }
      const data = await r.json();
      setConvertida(data);
    } catch (e) {
      setErrorApi(e.message);
    } finally {
      setConvirtiendo(false);
    }
  };

  const descargarPDF = async () => {
    if (!proformaGuardada) return;
    setDescargandoPDF(true);
    try {
      const r = await fetch(`${API}/proformas/${proformaGuardada.id_proforma}/pdf/`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!r.ok) throw new Error('No se pudo generar el PDF');
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `proforma_${proformaGuardada.numero_comprobante}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {
      setErrorApi(e.message);
    } finally {
      setDescargandoPDF(false);
    }
  };

  const resetForm = () => {
    setExito(false); setProformaGuardada(null); setClienteSelec(null);
    setLineas([]); setObservaciones(''); setFecha(hoy()); setFechaValidez(en30dias());
    setErrores({}); setErrorApi(''); setConvertida(null);
  };

  // ── Barra de contexto (ícono + stepper MORADO, botón volver AZUL) ────────────
  const BarraContexto = () => (
    <div style={{ background:'white', borderRadius:'16px', padding:'0.9rem 1.4rem', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', marginBottom:'1.4rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
        {/* Ícono MORADO */}
        <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:`linear-gradient(135deg,${MORADO.primary},${MORADO.mid})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9"  x2="8" y2="9"/>
          </svg>
        </div>
        <div>
          <p style={{ margin:0, fontSize:'0.68rem', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>Tipo de documento</p>
          <p style={{ margin:0, fontSize:'0.92rem', fontWeight:'900', color:'#0f172a' }}>Nueva Proforma</p>
        </div>
      </div>

      {/* Stepper MORADO */}
      <div style={{ display:'flex', alignItems:'center' }}>
        {PASOS.map((s, i) => (
          <React.Fragment key={s.n}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <div style={{ width:'24px', height:'24px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:'800', background: pasoActivo>=s.n ? `linear-gradient(135deg,${MORADO.primary},${MORADO.mid})` : '#e2e8f0', color: pasoActivo>=s.n ? 'white' : '#94a3b8', flexShrink:0 }}>
                {pasoActivo > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize:'0.74rem', fontWeight: pasoActivo===s.n ? '800' : '500', color: pasoActivo>=s.n ? '#0f172a' : '#94a3b8', whiteSpace:'nowrap' }}>{s.label}</span>
            </div>
            {i < 2 && <div style={{ width:'36px', height:'2px', background: pasoActivo>s.n ? MORADO.mid : '#e2e8f0', margin:'0 0.5rem' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Botón volver AZUL */}
      <button onClick={() => onVolver ? onVolver() : navigate('/')}
        style={{ background:C.lighter, border:`1.5px solid ${C.border}`, borderRadius:'8px', padding:'0.42rem 0.9rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.78rem', fontWeight:'700', color:C.primary, fontFamily:'inherit', flexShrink:0, transition:'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = C.light; e.currentTarget.style.borderColor = C.mid; }}
        onMouseLeave={e => { e.currentTarget.style.background = C.lighter; e.currentTarget.style.borderColor = C.border; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Volver a Documentos
      </button>
    </div>
  );

  // ── Pantalla de éxito (AZUL) ─────────────────────────────────────
  if (exito && proformaGuardada) return (
    <div style={{ padding:'1.4rem 2rem', fontFamily:"'Nunito','Segoe UI',sans-serif", background:'#f1f5f9', minHeight:'100vh' }}>
      <BarraContexto />
      <div style={{ maxWidth:'500px', margin:'1.5rem auto 0', animation:'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background:'white', borderRadius:'20px', padding:'2.5rem', textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.07)' }}>
          <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:`linear-gradient(135deg,${C.primary},${C.mid})`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem', boxShadow:`0 16px 48px rgba(21,56,154,0.32)` }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize:'1.5rem', fontWeight:'900', color:'#0f172a', margin:'0 0 0.3rem' }}>¡Proforma guardada!</h2>
          <p style={{ color:'#64748b', fontSize:'0.88rem', margin:'0 0 0.15rem' }}>
            Comprobante <strong style={{ color:C.primary, fontFamily:'monospace' }}>{proformaGuardada.numero_comprobante}</strong>
          </p>
          <p style={{ color:'#94a3b8', fontSize:'0.81rem', margin:'0 0 1.5rem' }}>
            Válida hasta: {fmtFecha(proformaGuardada.fecha_validez)} · Estado: Cotizada
          </p>

          <div style={{ background:C.lighter, borderRadius:'14px', padding:'1rem 1.2rem', marginBottom:'1.4rem', textAlign:'left', border:`1.5px solid ${C.border}` }}>
            <p style={{ margin:'0 0 0.6rem', fontSize:'0.68rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>Resumen</p>
            {[
              { label:'Cliente',   value: proformaGuardada.cliente?.nombres_apellidos || proformaGuardada.cliente?.razon_social || '—' },
              { label:'Productos', value: `${proformaGuardada.detalles?.length || 0} ítem(s)` },
              { label:'IVA',       value: fmtMoney(proformaGuardada.iva) },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.83rem', marginBottom:'0.25rem' }}>
                <span style={{ color:'#64748b' }}>{r.label}</span>
                <span style={{ fontWeight:'700', color:'#0f172a' }}>{r.value}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.95rem', marginTop:'0.6rem', paddingTop:'0.6rem', borderTop:`1px solid ${C.light}` }}>
              <span style={{ fontWeight:'800', color:'#0f172a' }}>Total</span>
              <span style={{ fontWeight:'900', color:C.primary, fontSize:'1.1rem' }}>{fmtMoney(proformaGuardada.total)}</span>
            </div>
          </div>

          <button onClick={descargarPDF} disabled={descargandoPDF}
            style={{ width:'100%', padding:'0.75rem', borderRadius:'12px', border:`1.5px solid ${C.border}`, background: descargandoPDF ? '#f8fafc' : C.lighter, color: descargandoPDF ? '#94a3b8' : C.primary, fontWeight:'700', fontSize:'0.88rem', fontFamily:'inherit', cursor: descargandoPDF ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', marginBottom:'0.65rem', transition:'all 0.15s' }}
            onMouseEnter={e => { if (!descargandoPDF) e.currentTarget.style.background = C.light; }}
            onMouseLeave={e => { if (!descargandoPDF) e.currentTarget.style.background = C.lighter; }}>
            {descargandoPDF
              ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>Generando PDF...</>
              : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar PDF</>
            }
          </button>

          {convertida ? (
            <div style={{ background:'#d1fae5', borderRadius:'12px', padding:'1rem', marginBottom:'1.2rem', border:'1.5px solid #6ee7b7' }}>
              <p style={{ margin:0, fontWeight:'800', color:'#065f46', fontSize:'0.88rem' }}>✓ Convertida a Factura</p>
              <p style={{ margin:'0.2rem 0 0', color:'#047857', fontSize:'0.81rem', fontFamily:'monospace' }}>{convertida.numero_factura}</p>
            </div>
          ) : (
            <button onClick={convertirAFactura} disabled={convirtiendo}
              style={{ width:'100%', padding:'0.88rem', borderRadius:'12px', border:'none', background: convirtiendo ? C.light : `linear-gradient(135deg,${C.primary},${C.mid})`, color: convirtiendo ? C.mid : 'white', fontWeight:'800', fontSize:'0.92rem', fontFamily:'inherit', cursor: convirtiendo ? 'not-allowed' : 'pointer', boxShadow: convirtiendo ? 'none' : `0 8px 24px rgba(21,56,154,0.32)`, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', marginBottom:'0.65rem', transition:'all 0.2s' }}
              onMouseEnter={e => { if (!convirtiendo) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(21,56,154,0.42)`; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = convirtiendo ? 'none' : `0 8px 24px rgba(21,56,154,0.32)`; }}>
              {convirtiendo
                ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>Convirtiendo...</>
                : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 13 10 15 16 9"/></svg>Convertir a Factura</>
              }
            </button>
          )}

          {errorApi && (
            <div style={{ padding:'0.7rem', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:'10px', color:'#b91c1c', fontSize:'0.82rem', marginBottom:'0.65rem' }}>
              ⚠️ {errorApi}
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.65rem' }}>
            <button onClick={() => onVolver ? onVolver() : navigate('/')}
              style={{ padding:'0.72rem', borderRadius:'12px', border:`1.5px solid ${C.border}`, background:C.lighter, color:C.primary, fontWeight:'700', fontSize:'0.84rem', fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem' }}
              onMouseEnter={e => e.currentTarget.style.background = C.light}
              onMouseLeave={e => e.currentTarget.style.background = C.lighter}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Ir al Inicio
            </button>
            <button onClick={resetForm}
              style={{ padding:'0.72rem', borderRadius:'12px', border:'1.5px solid #e2e8f0', background:'white', color:'#475569', fontWeight:'700', fontSize:'0.84rem', fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.mid; e.currentTarget.style.color = C.mid; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva Proforma
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Formulario principal ──────────────────────────────────
  return (
    <div style={{ padding:'1.4rem 2rem', fontFamily:"'Nunito','Segoe UI',sans-serif", background:'#f1f5f9', minHeight:'100vh' }}>
      {/* Modal tour educativo */}
      {!tourVisto_PROF && <TourBienvenida_PROF onCerrar={cerrarTour_PROF} />}
      {/* Barra modo educativo */}
      <BarraModoEdu_PROF onVerTutorial={verTutorial_PROF} />
      <BarraContexto />

      {errorApi && (
        <div style={{ padding:'0.85rem 1.1rem', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:'12px', color:'#b91c1c', fontSize:'0.84rem', fontWeight:'600', display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'1.2rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {errorApi}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 330px', gap:'1.4rem', alignItems:'start' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>

          {/* CLIENTE */}
          <div style={{ background:'white', borderRadius:'16px', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', border:'1px solid #f1f5f9' }}>
            <div style={{ padding:'1rem 1.4rem', borderBottom:'1px solid #f8fafc', background:'#fafafa', display:'flex', alignItems:'center', gap:'0.7rem' }}>
              <div style={{ width:'32px', height:'32px', borderRadius:'9px', background:`linear-gradient(135deg,${C.primary},${C.mid})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <h3 style={{ margin:0, fontSize:'0.88rem', fontWeight:'800', color:'#0f172a' }}>Datos del Cliente</h3>
                <p style={{ margin:0, fontSize:'0.7rem', color:'#94a3b8', fontWeight:'600' }}>Destinatario de la cotización</p>
              </div>
            </div>
            <div style={{ padding:'1.2rem 1.4rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Cliente <span style={{ color:'#ef4444' }}>*</span></label>
                <Buscador
                  placeholder="Buscar cliente por nombre o cédula..."
                  items={clientes} loading={loadingDatos} selected={clienteSelec}
                  onSelect={c => { setClienteSelec(c); setErrores(p => ({ ...p, cliente: null })); }}
                  onClear={() => setClienteSelec(null)}
                  renderItem={c => `${c.nombres_apellidos || c.razon_social} — ${c.identificacion}`}
                  renderSelected={c => `${c.nombres_apellidos || c.razon_social} (${c.identificacion})`}
                />
                {errores.cliente && <span style={{ fontSize:'0.72rem', color:'#ef4444', marginTop:'0.3rem', display:'block' }}>⚠ {errores.cliente}</span>}
              </div>
              {clienteSelec && (<>
                <div><label style={lbl}>Email</label><input value={clienteSelec.email || '—'} readOnly style={inputRO} /></div>
                <div><label style={lbl}>Teléfono</label><input value={clienteSelec.telefono || '—'} readOnly style={inputRO} /></div>
              </>)}
              <div>
                <label style={lbl}>Fecha de Emisión <span style={{ color:'#ef4444' }}>*</span></label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  style={{ ...inputBase, borderColor: errores.fecha ? '#ef4444' : '#e2e8f0' }}
                  onFocus={e => { e.target.style.borderColor = C.mid; e.target.style.boxShadow = `0 0 0 3px rgba(37,99,235,0.08)`; }}
                  onBlur={e  => { e.target.style.borderColor = errores.fecha ? '#ef4444' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
              </div>
              <div>
                <label style={lbl}>Válida hasta</label>
                <input type="date" value={fechaValidez} onChange={e => setFechaValidez(e.target.value)}
                  style={inputBase}
                  onFocus={e => { e.target.style.borderColor = C.mid; e.target.style.boxShadow = `0 0 0 3px rgba(37,99,235,0.08)`; }}
                  onBlur={e  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observaciones</label>
                <input placeholder="Notas o condiciones de la proforma..." value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  style={inputBase}
                  onFocus={e => { e.target.style.borderColor = C.mid; e.target.style.boxShadow = `0 0 0 3px rgba(37,99,235,0.08)`; }}
                  onBlur={e  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
              </div>
            </div>
          </div>

          {/* PRODUCTOS */}
          <div style={{ background:'white', borderRadius:'16px', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', border:'1px solid #f1f5f9' }}>
            <div style={{ padding:'1rem 1.4rem', borderBottom:'1px solid #f8fafc', background:'#fafafa', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.7rem' }}>
                <div style={{ width:'4px', height:'22px', borderRadius:'2px', background:C.mid }} />
                <div>
                  <h3 style={{ margin:0, fontSize:'0.88rem', fontWeight:'800', color:'#0f172a' }}>
                    Productos / Servicios
                    {lineas.length > 0 && <span style={{ marginLeft:'0.5rem', padding:'2px 8px', borderRadius:'99px', background:C.lighter, color:C.primary, fontSize:'0.7rem', fontWeight:'800', border:`1px solid ${C.border}` }}>{lineas.length}</span>}
                  </h3>
                  <p style={{ margin:0, fontSize:'0.7rem', color:'#94a3b8', fontWeight:'600' }}>Busca y agrega ítems a cotizar</p>
                </div>
              </div>
              {errores.lineas && <span style={{ fontSize:'0.75rem', color:'#ef4444', fontWeight:'700', background:'#fef2f2', padding:'3px 10px', borderRadius:'99px', border:'1px solid #fecaca' }}>⚠ {errores.lineas}</span>}
            </div>
            <div style={{ padding:'1.2rem 1.4rem' }}>
              <div style={{ marginBottom:'1.2rem' }}>
                <Buscador
                  placeholder="Buscar producto por nombre o código..."
                  items={productos} loading={loadingDatos} selected={null}
                  onSelect={agregarLinea} onClear={() => {}}
                  renderItem={p => `${p.codigo ? p.codigo + ' — ' : ''}${p.nombre}  ·  Stock: ${p.stock}  ·  ${fmtMoney(p.precio_unitario)}`}
                  renderSelected={() => ''}
                />
              </div>
              {lineas.length === 0 ? (
                <div style={{ padding:'2.5rem', textAlign:'center', border:`2px dashed ${C.border}`, borderRadius:'14px', background:C.lighter }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:'0.75rem' }}>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                  <p style={{ margin:0, fontWeight:'700', color:'#64748b', fontSize:'0.87rem' }}>Sin productos aún</p>
                  <p style={{ margin:'0.3rem 0 0', fontSize:'0.78rem', color:'#94a3b8' }}>Busca arriba para agregar ítems a cotizar</p>
                </div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 115px 95px 68px 90px 34px', gap:'0.55rem', padding:'0.55rem 0.7rem', background:'#f8fafc', borderRadius:'9px', marginBottom:'0.5rem' }}>
                    {['Producto','Cant.','Precio Unit.','Descuento','IVA%','Total',''].map(h => (
                      <span key={h} style={{ fontSize:'0.66rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
                    ))}
                  </div>
                  {lineas.map((l, i) => {
                    const c = calcLinea(l);
                    const hayError = errores[`cant_${i}`] || errores[`precio_${i}`];
                    return (
                      <div key={l.id_producto}
                        style={{ display:'grid', gridTemplateColumns:'1fr 80px 115px 95px 68px 90px 34px', gap:'0.55rem', alignItems:'center', padding:'0.65rem 0.7rem', borderRadius:'11px', marginBottom:'0.4rem', background: hayError ? '#fff5f5' : 'white', border:`1px solid ${hayError ? '#fecaca' : '#f1f5f9'}`, transition:'background 0.15s' }}
                        onMouseEnter={e => { if (!hayError) e.currentTarget.style.background = '#f8faff'; }}
                        onMouseLeave={e => { if (!hayError) e.currentTarget.style.background = 'white'; }}>
                        <div>
                          <div style={{ fontSize:'0.86rem', fontWeight:'800', color:'#0f172a' }}>{l.nombre}</div>
                          <div style={{ fontSize:'0.69rem', color:'#94a3b8', fontWeight:'600' }}>
                            {l.codigo && <span style={{ marginRight:'0.4rem', color:C.mid }}>{l.codigo}</span>}
                            Stock: {l.stock}
                          </div>
                          {hayError && <span style={{ fontSize:'0.69rem', color:'#ef4444', fontWeight:'700' }}>⚠ {errores[`cant_${i}`] || errores[`precio_${i}`]}</span>}
                        </div>
                        <input type="number" min="1" step="1" value={l.cantidad} onChange={e => actualizarLinea(i,'cantidad',e.target.value)}
                          style={{ ...inputBase, textAlign:'center', borderColor: errores[`cant_${i}`] ? '#ef4444' : '#e2e8f0', padding:'0.48rem 0.4rem' }}
                          onFocus={e => { e.target.style.borderColor = C.mid; e.target.style.boxShadow = `0 0 0 3px rgba(37,99,235,0.08)`; }}
                          onBlur={e  => { e.target.style.borderColor = errores[`cant_${i}`] ? '#ef4444' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                        <input type="number" min="0" step="0.01" value={l.precio} onChange={e => actualizarLinea(i,'precio',e.target.value)}
                          style={{ ...inputBase, padding:'0.48rem 0.5rem' }}
                          onFocus={e => { e.target.style.borderColor = C.mid; e.target.style.boxShadow = `0 0 0 3px rgba(37,99,235,0.08)`; }}
                          onBlur={e  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                        <input type="number" min="0" step="0.01" value={l.descuento} onChange={e => actualizarLinea(i,'descuento',e.target.value)}
                          style={{ ...inputBase, padding:'0.48rem 0.5rem' }}
                          onFocus={e => { e.target.style.borderColor = C.mid; e.target.style.boxShadow = `0 0 0 3px rgba(37,99,235,0.08)`; }}
                          onBlur={e  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                        <div style={{ display:'flex', justifyContent:'center' }}>
                          <span style={{ padding:'3px 7px', borderRadius:'7px', fontSize:'0.73rem', fontWeight:'800', background: l.porcentaje_iva > 0 ? '#fef9c3' : '#f1f5f9', color: l.porcentaje_iva > 0 ? '#854d0e' : '#64748b', border: l.porcentaje_iva > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0', whiteSpace:'nowrap' }}>
                            {l.porcentaje_iva}%
                          </span>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <span style={{ fontSize:'0.87rem', fontWeight:'800', color:'#0f172a' }}>{fmtMoney(c.total)}</span>
                          {c.iva > 0 && <div style={{ fontSize:'0.67rem', color:'#f59e0b', fontWeight:'700' }}>+{fmtMoney(c.iva)} IVA</div>}
                        </div>
                        <button onClick={() => eliminarLinea(i)}
                          style={{ width:'28px', height:'28px', borderRadius:'7px', border:'1.5px solid #fecaca', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#ef4444', transition:'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#f87171'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#fecaca'; }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RESUMEN lateral (AZUL) */}
        <div style={{ position:'sticky', top:'1rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div style={{ background:'white', borderRadius:'16px', overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', border:'1px solid #f1f5f9' }}>
            <div style={{ padding:'1rem 1.3rem', background:`linear-gradient(135deg,${C.primary},${C.mid})`, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'70px', height:'70px', borderRadius:'50%', background:'rgba(255,255,255,0.06)' }} />
              <h3 style={{ margin:0, fontSize:'0.88rem', fontWeight:'800', color:'white', position:'relative' }}>Resumen de Proforma</h3>
              <p style={{ margin:'0.2rem 0 0', fontSize:'0.7rem', color:'rgba(255,255,255,0.55)', position:'relative' }}>
                {lineas.length} ítem{lineas.length !== 1 ? 's' : ''} · {fechaValidez ? `válida hasta ${fmtFecha(fechaValidez)}` : 'sin fecha límite'}
              </p>
            </div>
            <div style={{ padding:'1.1rem 1.3rem' }}>
              {[
                { label:'Subtotal (0%)',       value: fmtMoney(totales.sub0),   show: totales.sub0   > 0, color:'#475569' },
                { label:'Subtotal (IVA)',       value: fmtMoney(totales.subIva), show: totales.subIva > 0, color:'#475569' },
                { label:'Descuentos',           value: `- ${fmtMoney(totales.desc)}`, show: totales.desc > 0, color:'#16a34a' },
                { label:`IVA (${ivaGeneral}%)`, value: fmtMoney(totales.iva),   show: totales.iva   > 0, color:'#f59e0b' },
              ].filter(r => r.show).map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.5rem 0', borderBottom:'1px solid #f8fafc' }}>
                  <span style={{ fontSize:'0.81rem', color:'#64748b', fontWeight:'600' }}>{r.label}</span>
                  <span style={{ fontSize:'0.83rem', fontWeight:'700', color:r.color }}>{r.value}</span>
                </div>
              ))}
              {lineas.length === 0 && <p style={{ textAlign:'center', color:'#cbd5e1', fontSize:'0.79rem', padding:'0.9rem 0', margin:0 }}>Agrega productos para ver el resumen</p>}
              <div style={{ margin:'0.9rem 0 0', padding:'0.9rem 1rem', background:C.lighter, borderRadius:'12px', border:`1.5px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'0.82rem', fontWeight:'800', color:C.primary, textTransform:'uppercase', letterSpacing:'0.5px' }}>Total</span>
                  <span style={{ fontSize:'1.55rem', fontWeight:'900', color:C.primary, letterSpacing:'-0.5px' }}>{fmtMoney(totales.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <button onClick={guardar} disabled={guardando}
            style={{ padding:'0.88rem', borderRadius:'12px', border:'none', cursor: guardando ? 'not-allowed' : 'pointer', background: guardando ? C.border : `linear-gradient(135deg,${C.primary},${C.mid})`, color:'white', fontWeight:'800', fontSize:'0.92rem', fontFamily:'inherit', boxShadow: guardando ? 'none' : `0 8px 24px rgba(21,56,154,0.35)`, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', transition:'all 0.2s' }}
            onMouseEnter={e => { if (!guardando) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 32px rgba(21,56,154,0.45)`; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = guardando ? 'none' : `0 8px 24px rgba(21,56,154,0.35)`; }}>
            {guardando
              ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation:'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>Guardando...</>
              : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar Proforma</>
            }
          </button>

          <div style={{ padding:'0.82rem 1rem', background:'#f8fafc', borderRadius:'11px', border:'1px solid #f1f5f9', fontSize:'0.74rem', color:'#64748b', lineHeight:'1.65' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.28rem' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'2px', background:`linear-gradient(135deg,${C.primary},${C.mid})`, flexShrink:0 }} />
              <strong style={{ color:'#334155' }}>Proforma</strong> — cotización sin afectar inventario
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <div style={{ width:'7px', height:'7px', borderRadius:'2px', background:'#10b981', flexShrink:0 }} />
              <strong style={{ color:'#334155' }}>Convertir</strong> — genera factura y descuenta stock
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
        * { -webkit-font-smoothing:antialiased; }
      `}</style>
    </div>
  );
};

export default Proforma;
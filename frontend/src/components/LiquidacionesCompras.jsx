import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

const API    = 'http://localhost:8000/api';
const getToken = () => localStorage.getItem('token');
const hdrs   = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

const fmt    = (v) => '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoy    = () => new Date().toISOString().split('T')[0];

const AZUL = {
  primary: '#15389a',
  mid: '#2563eb',
  light: '#dbeafe',
  lighter: '#eff6ff',
  border: '#93c5fd',
};

const ROSADO = {
  primary: '#db2777',
  mid: '#ec4899',
  light: '#fce7f3',
  lighter: '#fdf2f8',
  border: '#fbcfe8',
};

const ITEM_VACIO = { descripcion: '', cantidad: '1', precio_unitario: '', porcentaje_iva: '15', descuento: '0' };

const TOUR_KEY_LIQ = (uid) => `liq_tour_visto_${uid || 'default'}`;

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

// ════════════════════════════════════════════════════════
// TOUR DE BIENVENIDA
// ════════════════════════════════════════════════════════
const TourBienvenida_LIQ = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📄', titulo: '¿Qué es una Liquidación de Compras?', texto: 'Comprobante que TÚ emites cuando compras a personas naturales sin obligación de facturar: artesanos, agricultores, personas sin RUC. Actúas como emisor.' },
    { emoji: '👤', titulo: 'Paso 1 — Proveedor', texto: 'Busca el proveedor que no emite facturas. Debe tener su cédula o RUC registrado en el módulo de Clientes.' },
    { emoji: '🛒', titulo: 'Paso 2 — Ítems', texto: 'Agrega los productos comprados con descripción, cantidad, precio e IVA. El sistema calcula los totales automáticamente.' },
    { emoji: '📝', titulo: 'Paso 3 — Emitir', texto: 'Completa número de comprobante y fecha. Al emitir aparece en el ATS mensual como compra.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'La liquidación requiere que tú como comprador la emitas. El IVA aplica como crédito tributario para el cálculo del ATS.' },
  ];
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '22px', width: '100%', maxWidth: '460px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a)', padding: '1.3rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>LIQUIDACIÓN DE COMPRAS</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: '#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', paddingRight: '2rem' }}>Liquidación de Compras</p>
          <p style={{ margin: '0.18rem 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.65)' }}>Te explicamos cómo funciona este módulo</p>
          <button onClick={onCerrar}
            style={{ position: 'absolute', top: '1rem', right: '1rem', width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
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

const BannerEdu_LIQ = ({ onClose, onVerTutorial }) => (
  <div style={{
    marginBottom: '1rem', background: 'linear-gradient(135deg,#f0f7ff,#e0f2fe)',
    border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '0.85rem 1.2rem',
    display: 'flex', alignItems: 'center', gap: '0.85rem',
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

const BarraModoEdu_LIQ = ({ onVerTutorial }) => (
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

const LiquidacionesCompras = ({ onVolver }) => {
  return <FormNueva onGuardado={onVolver} onVolver={onVolver} />;
};

// ════════════════════════════════════════════════════════
// FORMULARIO NUEVO
// ════════════════════════════════════════════════════════
const FormNueva = ({ onGuardado, onVolver }) => {
  const [paso,         setPaso]         = useState(1);
  const [busqueda,     setBusqueda]     = useState('');
  const [proveedores,  setProveedores]  = useState([]);
  const [cargando,     setCargando]     = useState(false);
  const [proveedor,    setProveedor]    = useState(null);
  const [items,        setItems]        = useState([{ ...ITEM_VACIO }]);
  const [fecha,        setFecha]        = useState(hoy());
  const [obs,          setObs]          = useState('');
  const [guardando,    setGuardando]    = useState(false);
  const [error,        setError]        = useState('');
  const [resultado,    setResultado]    = useState(null);

  // ── Tour educativo ──────────────────────────────────────
  const tourKey = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return TOUR_KEY_LIQ(u?.id_usuario || u?.email || null);
    } catch { return TOUR_KEY_LIQ(null); }
  })();
  const [tourVisto,    setTourVisto]    = useState(() => !!localStorage.getItem(tourKey));
  const [mostrarEdu,   setMostrarEdu]   = useState(() => !localStorage.getItem(tourKey));

  const cerrarTour = useCallback(() => {
    localStorage.setItem(tourKey, '1');
    setTourVisto(true);
    setMostrarEdu(true); // muestra banner post-tour
  }, [tourKey]);

  const verTutorial = useCallback(() => {
    localStorage.removeItem(tourKey);
    setTourVisto(false);
    setMostrarEdu(false);
  }, [tourKey]);
  // ───────────────────────────────────────────────────────

  const buscar = useCallback(async () => {
    if (busqueda.length < 2) { setProveedores([]); return; }
    setCargando(true);
    try {
      const r = await fetch(`${API}/clientes/?buscar=${encodeURIComponent(busqueda)}&por_pagina=20`, { headers: hdrs() });
      const d = await r.json();
      setProveedores(d.items || []);
    } catch { setProveedores([]); }
    finally { setCargando(false); }
  }, [busqueda]);

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const agregarItem  = () => setItems(p => [...p, { ...ITEM_VACIO }]);
  const quitarItem   = (i) => setItems(p => p.filter((_,j) => j !== i));
  const cambiarItem  = (i, k, v) => setItems(p => p.map((it,j) => j === i ? { ...it, [k]: v } : it));

  const itemsParaResumen = items.filter(it => parseFloat(it.precio_unitario) > 0);
  const itemsValidos     = items.filter(it => it.descripcion.trim() && parseFloat(it.precio_unitario) > 0);
  const s0   = itemsParaResumen.filter(it => parseFloat(it.porcentaje_iva) === 0).reduce((s,it) => { const q=parseFloat(it.cantidad)||0, p=parseFloat(it.precio_unitario)||0, d=parseFloat(it.descuento)||0; return s+(q*p-d); }, 0);
  const siva = itemsParaResumen.filter(it => parseFloat(it.porcentaje_iva) > 0).reduce((s,it) => { const q=parseFloat(it.cantidad)||0, p=parseFloat(it.precio_unitario)||0, d=parseFloat(it.descuento)||0; return s+(q*p-d); }, 0);
  const tiva = itemsParaResumen.reduce((s,it) => { const q=parseFloat(it.cantidad)||0, p=parseFloat(it.precio_unitario)||0, d=parseFloat(it.descuento)||0, pct=parseFloat(it.porcentaje_iva)||0; const sub=q*p-d; return s+(pct>0 ? sub*pct/100 : 0); }, 0);
  const total = s0 + siva + tiva;

  const emitir = async () => {
    setError('');
    if (!proveedor) { setError('Selecciona un proveedor.'); return; }
    if (!itemsValidos.length) { setError('Agrega al menos un ítem con descripción y precio.'); return; }
    setGuardando(true);
    try {
      const body = {
        id_persona_comercial: proveedor.id_persona_comercial,
        fecha_emision: fecha,
        porcentaje_iva: 15,
        observaciones: obs || null,
        detalles: itemsValidos.map(it => ({
          descripcion:     it.descripcion.trim(),
          cantidad:        parseFloat(it.cantidad),
          precio_unitario: parseFloat(it.precio_unitario),
          porcentaje_iva:  parseFloat(it.porcentaje_iva),
          descuento:       parseFloat(it.descuento) || 0,
        })),
      };
      const r = await fetch(`${API}/liquidaciones/`, { method:'POST', headers:hdrs(), body:JSON.stringify(body) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Error al guardar'); }
      setResultado(await r.json());
      setPaso(3);
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  // Barra de contexto (stepper rosado, botón volver azul)
  const BarraContexto = () => (
    <div style={{ background:'white', borderRadius:'16px', padding:'0.9rem 1.4rem', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', marginBottom:'1.4rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
        <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:`linear-gradient(135deg,${ROSADO.primary},${ROSADO.mid})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
        </div>
        <div>
          <p style={{ margin:0, fontSize:'0.68rem', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>Tipo de documento</p>
          <p style={{ margin:0, fontSize:'0.92rem', fontWeight:'900', color:'#0f172a' }}>Liquidación de Compras</p>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center' }}>
        {[{ n:1, label:'Seleccionar Proveedor' }, { n:2, label:'Ítems y Totales' }, { n:3, label:'Emitida' }].map((s,i) => (
          <React.Fragment key={s.n}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
              <div style={{ width:'24px', height:'24px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:'800', background: paso>=s.n ? `linear-gradient(135deg,${ROSADO.primary},${ROSADO.mid})` : '#e2e8f0', color: paso>=s.n ? 'white' : '#94a3b8', flexShrink:0 }}>
                {paso > s.n ? '✓' : s.n}
              </div>
              <span style={{ fontSize:'0.74rem', fontWeight:paso===s.n?'800':'500', color:paso>=s.n?'#0f172a':'#94a3b8', whiteSpace:'nowrap' }}>{s.label}</span>
            </div>
            {i < 2 && <div style={{ width:'36px', height:'2px', background:paso>s.n ? ROSADO.mid : '#e2e8f0', margin:'0 0.5rem' }} />}
          </React.Fragment>
        ))}
      </div>

      <button onClick={onVolver}
        style={{ background:AZUL.lighter, border:`1.5px solid ${AZUL.border}`, borderRadius:'8px', padding:'0.42rem 0.9rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.3rem', fontSize:'0.78rem', fontWeight:'700', color:AZUL.primary, fontFamily:'inherit', flexShrink:0, transition:'all 0.15s' }}
        onMouseEnter={e=>{ e.currentTarget.style.background=AZUL.light; e.currentTarget.style.borderColor=AZUL.mid; }}
        onMouseLeave={e=>{ e.currentTarget.style.background=AZUL.lighter; e.currentTarget.style.borderColor=AZUL.border; }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Volver
      </button>
    </div>
  );

  // ── Pantalla de éxito ──────────────────────────────────
  if (paso === 3 && resultado) {
    return (
      <div style={{ padding:'1.8rem 2rem', fontFamily:"'Nunito','Segoe UI',sans-serif" }}>
        <BarraContexto />
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'4rem 2rem', textAlign:'center', gap:'1rem' }}>
          <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:`linear-gradient(135deg,${ROSADO.primary},${ROSADO.mid})`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'0.5rem' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize:'1.4rem', fontWeight:'900', color:'#0f172a', margin:0 }}>¡Liquidación emitida!</h2>
          <p style={{ fontSize:'0.88rem', color:'#64748b', margin:0 }}>El documento ha sido registrado correctamente.</p>
          <div style={{ background:AZUL.lighter, border:`1.5px solid ${AZUL.border}`, borderRadius:'14px', padding:'1.2rem 2rem', marginTop:'0.5rem' }}>
            <div style={{ fontSize:'0.72rem', fontWeight:'800', color:AZUL.primary, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.4rem' }}>Número de comprobante</div>
            <div style={{ fontSize:'1.3rem', fontWeight:'900', color:'#0f172a', fontFamily:'monospace' }}>{resultado.numero_comprobante}</div>
            <div style={{ fontSize:'1.1rem', fontWeight:'700', color:AZUL.mid, marginTop:'0.4rem' }}>{fmt(resultado.total)}</div>
          </div>
          <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem' }}>
            <button onClick={() => { setPaso(1); setProveedor(null); setItems([{...ITEM_VACIO}]); setResultado(null); setBusqueda(''); }}
              style={{ padding:'0.7rem 1.4rem', background:ROSADO.lighter, border:`1.5px solid ${ROSADO.border}`, borderRadius:'10px', cursor:'pointer', fontSize:'0.84rem', fontWeight:'700', color:ROSADO.primary, fontFamily:'inherit' }}>
              Nueva Liquidación
            </button>
            <button onClick={onGuardado}
              style={{ padding:'0.7rem 1.4rem', background:`linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, border:'none', borderRadius:'10px', cursor:'pointer', fontSize:'0.84rem', fontWeight:'700', color:'white', fontFamily:'inherit', boxShadow:`0 4px 14px ${AZUL.primary}55` }}>
              Volver al listado
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ───────────────────────────────
  return (
    <div style={{ padding:'1.8rem 2rem', fontFamily:"'Nunito','Segoe UI',sans-serif" }}>
      {/* Tour educativo (modal primera visita) */}
      {!tourVisto && <TourBienvenida_LIQ onCerrar={cerrarTour} />}
      {/* Banner post-tour */}
      {tourVisto && mostrarEdu && <BannerEdu_LIQ onClose={() => setMostrarEdu(false)} onVerTutorial={verTutorial} />}
      {/* Barra modo educativo persistente */}
      <BarraModoEdu_LIQ onVerTutorial={verTutorial} />
      <BarraContexto />

      {error && (
        <div style={{ padding:'0.8rem 1rem', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:'10px', color:'#b91c1c', fontSize:'0.83rem', marginBottom:'1rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* PASO 1: Seleccionar proveedor */}
      {paso === 1 && (
        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f1f5f9', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', overflow:'hidden' }}>
          <div style={{ padding:'1rem 1.4rem', borderBottom:'1px solid #f8fafc', background:'#fafafa', display:'flex', alignItems:'center', gap:'0.65rem' }}>
            <div style={{ width:'4px', height:'20px', borderRadius:'2px', background:AZUL.mid }} />
            <h3 style={{ margin:0, fontSize:'0.88rem', fontWeight:'800', color:'#0f172a' }}>Busca y selecciona al proveedor / vendedor</h3>
          </div>
          <div style={{ padding:'1.2rem 1.4rem' }}>
            <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.2rem' }}>
              <div style={{ position:'relative', flex:1 }}>
                <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o cédula/RUC..."
                  style={{ width:'100%', padding:'0.6rem 1rem 0.6rem 2.5rem', border:`1.5px solid #e2e8f0`, borderRadius:'10px', fontSize:'0.84rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                  onFocus={e=>e.target.style.borderColor=AZUL.mid}
                  onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                <svg style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
            </div>

            <div style={{ border:'1px solid #f1f5f9', borderRadius:'12px', overflow:'hidden' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 160px 90px', padding:'0.5rem 1rem', background:'#f8fafc', borderBottom:'1px solid #f1f5f9' }}>
                {['Nombre / Razón social','Identificación','Acción'].map(c=>(
                  <span key={c} style={{ fontSize:'0.68rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase' }}>{c}</span>
                ))}
              </div>
              {cargando ? (
                <div style={{ padding:'2rem', textAlign:'center', color:'#94a3b8', fontSize:'0.84rem' }}>Buscando...</div>
              ) : proveedores.length === 0 ? (
                <div style={{ padding:'2.5rem', textAlign:'center', color:'#94a3b8', fontSize:'0.84rem' }}>
                  {busqueda.length < 2 ? 'Escribe al menos 2 caracteres para buscar' : 'Sin resultados. El proveedor debe estar registrado en Clientes.'}
                </div>
              ) : proveedores.map((p,i) => (
                <div key={p.id_persona_comercial}
                  style={{ display:'grid', gridTemplateColumns:'1fr 160px 90px', padding:'0.75rem 1rem', alignItems:'center', borderBottom:i<proveedores.length-1?'1px solid #f8fafc':'none', transition:'background 0.12s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div>
                    <div style={{ fontSize:'0.86rem', fontWeight:'700', color:'#0f172a' }}>{p.nombres_apellidos || p.razon_social}</div>
                    {p.razon_social && p.nombres_apellidos && <div style={{ fontSize:'0.73rem', color:'#94a3b8' }}>{p.razon_social}</div>}
                  </div>
                  <span style={{ fontSize:'0.8rem', color:'#64748b', fontFamily:'monospace' }}>{p.identificacion}</span>
                  <button onClick={() => { setProveedor(p); setPaso(2); }}
                    style={{ padding:'0.38rem 0.8rem', background:AZUL.lighter, border:`1.5px solid ${AZUL.border}`, color:AZUL.primary, borderRadius:'8px', cursor:'pointer', fontSize:'0.75rem', fontWeight:'700', fontFamily:'inherit', transition:'all 0.15s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=AZUL.mid; e.currentTarget.style.color='white'; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background=AZUL.lighter; e.currentTarget.style.color=AZUL.primary; }}>
                    Seleccionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PASO 2: Ítems */}
      {paso === 2 && proveedor && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'1.2rem', alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>
            {/* Proveedor seleccionado */}
            <div style={{ background:AZUL.lighter, border:`1.5px solid ${AZUL.border}`, borderRadius:'14px', padding:'1rem 1.2rem', display:'flex', gap:'2rem', alignItems:'center', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:'800', color:AZUL.primary, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'0.2rem' }}>Proveedor seleccionado</div>
                <div style={{ fontSize:'0.95rem', fontWeight:'900', color:'#0f172a' }}>{proveedor.nombres_apellidos || proveedor.razon_social}</div>
              </div>
              <div>
                <div style={{ fontSize:'0.68rem', fontWeight:'800', color:AZUL.primary, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'0.2rem' }}>Identificación</div>
                <div style={{ fontSize:'0.87rem', fontWeight:'700', color:'#0f172a', fontFamily:'monospace' }}>{proveedor.identificacion}</div>
              </div>
              <button onClick={() => { setPaso(1); setProveedor(null); }}
                style={{ marginLeft:'auto', padding:'0.35rem 0.8rem', background:'white', border:`1px solid ${AZUL.border}`, borderRadius:'8px', cursor:'pointer', fontSize:'0.74rem', fontWeight:'700', color:'#64748b', fontFamily:'inherit' }}>
                Cambiar
              </button>
            </div>

            {/* Tabla de ítems */}
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f1f5f9', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', overflow:'hidden' }}>
              <div style={{ padding:'0.85rem 1.2rem', borderBottom:'1px solid #f8fafc', background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
                  <div style={{ width:'4px', height:'20px', borderRadius:'2px', background:AZUL.mid }} />
                  <h3 style={{ margin:0, fontSize:'0.88rem', fontWeight:'800', color:'#0f172a' }}>Ítems / Bienes adquiridos</h3>
                </div>
                <button onClick={agregarItem}
                  style={{ fontSize:'0.74rem', fontWeight:'700', color:AZUL.primary, background:AZUL.lighter, border:`1px solid ${AZUL.border}`, borderRadius:'8px', padding:'0.3rem 0.75rem', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                  + Agregar ítem
                </button>
              </div>
              <div style={{ padding:'1rem 1.2rem', display:'flex', flexDirection:'column', gap:'0.65rem' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 80px 100px 36px', gap:'0.6rem', padding:'0 0.1rem' }}>
                  {['Descripción','Cant.','Precio unit.','IVA%','Descuento',''].map(c=>(
                    <span key={c} style={{ fontSize:'0.67rem', fontWeight:'800', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.4px' }}>{c}</span>
                  ))}
                </div>
                {items.map((it,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 80px 100px 36px', gap:'0.6rem', alignItems:'center' }}>
                    <input value={it.descripcion} onChange={e=>cambiarItem(i,'descripcion',e.target.value)}
                      placeholder="Ej: Mano de obra, producto agrícola..."
                      style={{ padding:'0.58rem 0.8rem', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'0.84rem', fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=AZUL.mid} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                    <input type="number" value={it.cantidad} onChange={e=>cambiarItem(i,'cantidad',e.target.value)} min="1" step="1"
                      style={{ padding:'0.58rem 0.5rem', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'0.84rem', fontFamily:'inherit', outline:'none', width:'100%', textAlign:'right', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor=AZUL.mid} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:'0.6rem', top:'50%', transform:'translateY(-50%)', fontSize:'0.84rem', color:'#94a3b8', pointerEvents:'none' }}>$</span>
                      <input type="number" value={it.precio_unitario} onChange={e=>cambiarItem(i,'precio_unitario',e.target.value)} min="0" step="0.01" placeholder="0.00"
                        style={{ padding:'0.58rem 0.5rem 0.58rem 1.4rem', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'0.84rem', fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor=AZUL.mid} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                    </div>
                    <select value={it.porcentaje_iva} onChange={e=>cambiarItem(i,'porcentaje_iva',e.target.value)}
                      style={{ padding:'0.58rem 0.4rem', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'0.82rem', fontFamily:'inherit', outline:'none', background:'white', cursor:'pointer' }}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="15">15%</option>
                    </select>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:'0.6rem', top:'50%', transform:'translateY(-50%)', fontSize:'0.84rem', color:'#94a3b8', pointerEvents:'none' }}>$</span>
                      <input type="number" value={it.descuento} onChange={e=>cambiarItem(i,'descuento',e.target.value)} min="0" step="0.01" placeholder="0.00"
                        style={{ padding:'0.58rem 0.5rem 0.58rem 1.4rem', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'0.84rem', fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor=AZUL.mid} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                    </div>
                    <button onClick={()=>quitarItem(i)} disabled={items.length===1}
                      style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid #fecaca', background:'#fef2f2', cursor:items.length===1?'not-allowed':'pointer', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', opacity:items.length===1?0.3:1 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                <div style={{ padding:'0.6rem 0.8rem', background:AZUL.lighter, borderRadius:'10px', fontSize:'0.76rem', color:AZUL.primary, display:'flex', gap:'0.4rem', alignItems:'flex-start', marginTop:'0.25rem' }}>
                  <span>ℹ️</span>
                  <span>La liquidación de compras se usa cuando el vendedor <strong>no está obligado a emitir facturas</strong> (personas naturales, artesanos, agricultores). El comprador emite este documento.</span>
                </div>
              </div>
            </div>

            {/* Fecha y observaciones */}
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f1f5f9', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', padding:'1.2rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div>
                <label style={lblStyle}>Fecha de Emisión *</label>
                <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inputStyle}
                  onFocus={e=>e.target.style.borderColor=AZUL.mid} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
              <div style={{ gridColumn:'span 2' }}>
                <label style={lblStyle}>Observaciones (opcional)</label>
                <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Descripción de la compra, lugar, etc." rows={3}
                  style={{ ...inputStyle, resize:'vertical', lineHeight:1.5 }}
                  onFocus={e=>e.target.style.borderColor=AZUL.mid} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div style={{ position:'sticky', top:'1rem' }}>
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f1f5f9', boxShadow:'0 4px 20px rgba(0,0,0,0.08)', overflow:'hidden' }}>
              <div style={{ padding:'0.85rem 1.2rem', background:`linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, borderBottom:`1px solid ${AZUL.border}` }}>
                <h3 style={{ margin:0, fontSize:'0.88rem', fontWeight:'800', color:'white' }}>Resumen de la Liquidación</h3>
              </div>
              <div style={{ padding:'1.2rem' }}>
                {itemsParaResumen.length > 0 && (
                  <div style={{ marginBottom:'1rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                    {itemsParaResumen.map((it,i) => {
                      const q=parseFloat(it.cantidad)||0, p=parseFloat(it.precio_unitario)||0, d=parseFloat(it.descuento)||0;
                      return (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', color:'#475569', padding:'0.3rem 0', borderBottom:'1px dashed #f1f5f9' }}>
                          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'0.5rem' }}>{it.descripcion}</span>
                          <span style={{ fontWeight:'700', flexShrink:0 }}>{fmt(q*p-d)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.55rem', marginBottom:'1rem' }}>
                  <ResumenFila label="Subtotal sin IVA" valor={fmt(s0)} />
                  <ResumenFila label="Subtotal con IVA" valor={fmt(siva)} />
                  <ResumenFila label="IVA" valor={fmt(tiva)} />
                  <div style={{ height:'1px', background:'#f1f5f9', margin:'0.25rem 0' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'0.9rem', fontWeight:'900', color:'#0f172a' }}>TOTAL</span>
                    <span style={{ fontSize:'1.2rem', fontWeight:'900', color:AZUL.mid }}>{fmt(total)}</span>
                  </div>
                </div>
                <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'0.75rem', marginBottom:'1rem', fontSize:'0.76rem', color:'#64748b', lineHeight:1.6 }}>
                  <strong style={{ color:'#0f172a' }}>Al emitir esta liquidación:</strong>
                  <ul style={{ margin:'0.35rem 0 0', paddingLeft:'1.1rem' }}>
                    <li>Se registra la compra con número secuencial</li>
                    <li>El proveedor queda vinculado al documento</li>
                    <li>No afecta el inventario de productos</li>
                    <li>Sirve como respaldo tributario de la compra</li>
                  </ul>
                </div>
                <button onClick={emitir} disabled={guardando || !itemsValidos.length}
                  style={{ width:'100%', padding:'0.9rem', background: guardando||!itemsValidos.length ? AZUL.border : `linear-gradient(135deg,${AZUL.primary},${AZUL.mid})`, color:'white', border:'none', borderRadius:'12px', cursor: guardando||!itemsValidos.length ? 'not-allowed' : 'pointer', fontSize:'0.88rem', fontWeight:'800', fontFamily:'inherit', boxShadow:`0 4px 14px ${AZUL.primary}44` }}>
                  {guardando ? 'Emitiendo...' : '✓ Emitir Liquidación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidacionesCompras;
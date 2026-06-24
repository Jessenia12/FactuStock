import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientesService, productosService, facturasService, negocioService } from '../services/api';
import ReactDOM from 'react-dom';

/* ════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — Nueva Factura
   localStorage key: nf_tour
════════════════════════════════════════════════════════ */
const getTOUR_KEY_NF = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `nf-tour-${uid}`;
  } catch { return 'nf-tour'; }
};
const TOUR_KEY_NF = getTOUR_KEY_NF();

const TourBienvenida_NF = ({ onCerrar }) => {
  const pasos = [
    { emoji: '🧾', titulo: '¿Cómo funciona este módulo?', texto: 'Emites facturas electrónicas en dos pasos: primero seleccionas el cliente y la fecha, luego buscas y agregas los productos o servicios.' },
    { emoji: '👤', titulo: 'Paso 1 — Cliente y Fecha', texto: 'Busca el cliente por nombre, RUC o cédula. Selecciona la fecha de emisión y agrega observaciones si las necesitas.' },
    { emoji: '🛒', titulo: 'Paso 2 — Productos', texto: 'Busca y agrega productos. Ajusta cantidades y precios. El sistema calcula subtotales, IVA y total automáticamente en tiempo real.' },
    { emoji: '💾', titulo: 'Borrador vs Finalizar', texto: 'Borrador: editable, no afecta el stock. Finalizar: descuenta stock y da validez tributaria. Los borradores van a Pendientes de Emitir.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Una factura finalizada no puede modificarse en sus datos fiscales. Para corregir montos, emite una Nota de Crédito.' },
  ];
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return ReactDOM.createPortal(
    <div style={{ position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9999,background:'rgba(10,18,40,0.72)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',animation:'tourFadeIn 0.22s ease' }}>
      <div style={{ background:'white',borderRadius:'22px',width:'100%',maxWidth:'460px',boxShadow:'0 32px 80px rgba(0,0,0,0.3)',overflow:'hidden',animation:'tourPopIn 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background:'linear-gradient(135deg,#0f1f4b,#15389a)',padding:'1.3rem 1.5rem',position:'relative' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'0.35rem' }}>
            <span style={{ background:'rgba(255,255,255,0.2)',borderRadius:'99px',padding:'0.2rem 0.65rem',fontSize:'0.67rem',fontWeight:'800',color:'white',letterSpacing:'0.5px' }}>NUEVA FACTURA</span>
            <span style={{ background:'#fbbf24',borderRadius:'99px',padding:'0.2rem 0.65rem',fontSize:'0.67rem',fontWeight:'800',color:'#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin:0,fontSize:'1.1rem',fontWeight:'900',color:'white',paddingRight:'2rem' }}>Crear Nueva Factura</p>
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

const BannerEdu_NF = ({ onClose }) => (
  <div style={{ marginBottom:'1rem',background:'linear-gradient(135deg,#f0f7ff,#e0f2fe)',border:'1.5px solid #bfdbfe',borderRadius:'14px',padding:'0.85rem 1.2rem',display:'flex',alignItems:'center',gap:'0.85rem',animation:'tourFadeIn 0.3s ease' }}>
    <div style={{ width:'36px',height:'36px',borderRadius:'10px',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',flexShrink:0 }}>🎓</div>
    <div style={{ flex:1 }}>
      <p style={{ margin:0,fontWeight:'900',fontSize:'0.82rem',color:'#1d4ed8' }}>Modo Educativo Activo</p>
      <p style={{ margin:'0.1rem 0 0',fontSize:'0.76rem',color:'#3b82f6',lineHeight:1.4 }}>Primera visita. Los datos son de práctica, ¡explora sin miedo!</p>
    </div>
    <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'#94a3b8',padding:'0.2rem',display:'flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>
);

const BarraModoEdu_NF = ({ onVerTutorial }) => (
  <div style={{ background:'linear-gradient(90deg,#fffbeb,#fef3c7)',border:'1.5px solid #fde68a',borderRadius:'12px',padding:'0.65rem 1rem',marginBottom:'1.1rem',display:'flex',alignItems:'center',gap:'0.65rem' }}>
    <span style={{ fontSize:'0.95rem' }}>🏫</span>
    <p style={{ margin:0,fontSize:'0.77rem',color:'#92400e',fontWeight:'700',flex:1 }}>Modo Educativo — Los datos son de práctica. Explora sin miedo.</p>
    <button onClick={onVerTutorial} style={{ padding:'0.28rem 0.65rem',borderRadius:'8px',border:'1.5px solid #fbbf24',background:'white',color:'#92400e',fontSize:'0.7rem',fontWeight:'800',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:'0.3rem' }}>📖 Ver tutorial</button>
  </div>
);

const fmtMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoy      = () => new Date().toISOString().split('T')[0];
const fmtFecha = (s) => { if (!s) return '—'; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmt      = (v) => parseFloat(v || 0).toFixed(2);

const C = { primary:'#15389a', mid:'#2563eb', light:'#dbeafe', lighter:'#eff6ff', border:'#93c5fd' };

const PASOS = [
  { n:1, label:'Cliente y Fecha' },
  { n:2, label:'Productos' },
  { n:3, label:'Emitida' },
];

// ─── PrintView SRI ─────────────────────────────────────────
const API_BASE_PRINT = 'https://factustock-efdi.onrender.com';
const buildLogoUrl = (url) => {
  if (!url) return null;
  const base = url.startsWith('http') ? url : `${API_BASE_PRINT}${url}`;
  return `${base}?t=${Math.floor(Date.now() / 60000)}`;
};

const PrintViewSRI = ({ factura, negocio, logoNegocio }) => {
  if (!factura) return null;
  const { numeroComprobante='001-001-000000001', fecha:fechaEmision, cliente, lineas=[], totales, ivaGeneral=15, observaciones, estado } = factura;
  const neg=negocio||{};
  const subTotal=(totales?.sub0||0)+(totales?.subIva||0), descuento=totales?.desc||0, iva=totales?.iva||0, total=totales?.total||0;
  const claveAcceso=`${(fechaEmision||'').replace(/-/g,'')}01${neg.ruc||'0000000000001'}${(numeroComprobante||'').replace(/-/g,'')}001`;
  const logoSrc = buildLogoUrl(logoNegocio) || buildLogoUrl(neg.logo_url);
  return (
    <div id="print-area">
<div className="sri-wrap">
      <table className="sri-header"><tbody><tr>
        <td className="sri-header-left">
          {logoSrc?<img src={logoSrc} alt="logo" className="sri-logo" onError={e=>e.target.style.display='none'}/>:<div className="sri-logo-box">{neg.nombre_comercial||neg.razon_social||'NEGOCIO'}</div>}
          <p className="sri-nombre-grande">{neg.nombre_comercial||neg.razon_social||'NOMBRE DEL NEGOCIO'}</p>
          <p className="sri-dato"><b>{neg.razon_social}</b></p>
          {neg.direccion_matriz&&<p className="sri-dato"><b>Dir. Matriz:</b> {neg.direccion_matriz}</p>}
          {neg.direccion_sucursal&&<p className="sri-dato"><b>Dir. Sucursal:</b> {neg.direccion_sucursal}</p>}
          <p className="sri-dato"><b>Obligado A Llevar Contabilidad:</b> {neg.obligado_contabilidad?'SÍ':'NO'}</p>
          {neg.contribuyente&&<p className="sri-dato"><b>Contribuyente Régimen {neg.contribuyente}</b></p>}
        </td>
        <td className="sri-header-right">
          <table className="sri-comp-box"><tbody>
            <tr><td className="sri-comp-row"><b>R.U.C:</b></td><td className="sri-comp-val">{neg.ruc||'—'}</td></tr>
            <tr><td className="sri-comp-row sri-factura-title" colSpan="2">FACTURA</td></tr>
            <tr><td className="sri-comp-row">No.</td><td className="sri-comp-val sri-mono">{numeroComprobante}</td></tr>
            <tr><td className="sri-comp-row" colSpan="2"><b>NÚMERO AUTORIZACIÓN</b></td></tr>
            <tr><td className="sri-comp-row sri-mono sri-small" colSpan="2" style={{wordBreak:'break-all'}}>{claveAcceso}</td></tr>
            <tr><td className="sri-comp-row">FECHA Y HORA DE AUTORIZACIÓN</td><td className="sri-comp-val">{fmtFecha(fechaEmision)} 00:00:00-05:00</td></tr>
            <tr><td className="sri-comp-row">AMBIENTE:</td><td className="sri-comp-val">{neg.ambiente||'Pruebas'}</td></tr>
            <tr><td className="sri-comp-row">EMISIÓN:</td><td className="sri-comp-val">Normal</td></tr>
          </tbody></table>
          <div className="sri-clave-box">
            <p className="sri-clave-titulo">CLAVE DE ACCESO</p>
            <div className="sri-barcode">{Array.from({length:50}).map((_,i)=><span key={i} style={{display:'inline-block',width:i%3===0?'3px':i%2===0?'1px':'2px',height:'28px',background:i%2===0?'#000':'transparent',verticalAlign:'middle'}}/>)}</div>
            <p className="sri-mono sri-small" style={{wordBreak:'break-all',margin:'2px 0 0'}}>{claveAcceso}</p>
          </div>
        </td>
      </tr></tbody></table>
      <table className="sri-receptor"><tbody>
        <tr><td className="sri-rec-td"><span className="sri-rec-label">Razón Social / Nombres y Apellidos:</span> {cliente?.nombres_apellidos||cliente?.razon_social||'—'}</td><td className="sri-rec-td"><span className="sri-rec-label">RUC / CI:</span> {cliente?.identificacion||'—'}</td></tr>
        <tr><td className="sri-rec-td"><span className="sri-rec-label">Fecha Emisión:</span> {fmtFecha(fechaEmision)}</td><td className="sri-rec-td"><span className="sri-rec-label">Guía de Remisión:</span> —</td></tr>
      </tbody></table>
      <table className="sri-detalle">
        <thead><tr className="sri-th-row"><th className="sri-th">Cod. Principal</th><th className="sri-th">Cod. Auxiliar</th><th className="sri-th sri-center">Cant.</th><th className="sri-th sri-desc">Descripción</th><th className="sri-th sri-right">Precio Unitario</th><th className="sri-th sri-right">Descuento</th><th className="sri-th sri-right">Precio Total</th></tr></thead>
        <tbody>{lineas.map((l,i)=>{const sub=parseFloat(l.cantidad)*parseFloat(l.precio),desc=parseFloat(l.descuento||0),base=sub-desc;return(<tr key={i} style={{background:i%2===0?'white':'#f9f9f9'}}><td className="sri-td sri-mono">{l.codigo||'—'}</td><td className="sri-td">—</td><td className="sri-td sri-center">{l.cantidad}</td><td className="sri-td"><b>{l.nombre}</b></td><td className="sri-td sri-right">${parseFloat(l.precio).toFixed(5)}</td><td className="sri-td sri-right">0% $0.00</td><td className="sri-td sri-right">${fmt(base)}</td></tr>);})}</tbody>
      </table>
      <table className="sri-bottom"><tbody><tr>
        <td className="sri-pago-cell">
          <table className="sri-pago"><thead><tr><th className="sri-section-title" colSpan="4">Forma de Pago</th></tr><tr><th className="sri-pago-th">Forma de Pago</th><th className="sri-pago-th sri-right">Valor</th><th className="sri-pago-th sri-right">Plazo</th><th className="sri-pago-th">Tiempo</th></tr></thead><tbody><tr><td className="sri-pago-td">SIN UTILIZACION DEL SISTEMA FINANCIERO</td><td className="sri-pago-td sri-right">${fmt(total)}</td><td className="sri-pago-td sri-right">0</td><td className="sri-pago-td">dias</td></tr></tbody></table>
          <table className="sri-pago" style={{marginTop:'4px'}}><thead><tr><th className="sri-section-title" colSpan="2">Información Adicional</th></tr></thead><tbody>{cliente?.direccion&&<tr><td className="sri-pago-th">DIRECCIÓN</td><td className="sri-pago-td">{cliente.direccion}</td></tr>}{neg.telefono&&<tr><td className="sri-pago-th">TELÉFONO</td><td className="sri-pago-td">{neg.telefono}</td></tr>}{neg.email&&<tr><td className="sri-pago-th">EMAIL</td><td className="sri-pago-td">{neg.email}</td></tr>}</tbody></table>
        </td>
        <td className="sri-totales-cell"><table className="sri-totales"><tbody>
          {ivaGeneral>0&&<FilaTotal label={`SUBTOTAL ${ivaGeneral}%`} valor={totales?.subIva||0}/>}
          <FilaTotal label="SUBTOTAL 0%" valor={totales?.sub0||0}/><FilaTotal label="SUBTOTAL NO OBJETO IVA" valor={0}/><FilaTotal label="SUBTOTAL EXENTO IVA" valor={0}/><FilaTotal label="SUBTOTAL SIN IMPUESTOS" valor={subTotal}/><FilaTotal label="DESCUENTO" valor={descuento}/><FilaTotal label="ICE" valor={0}/>
          {ivaGeneral>0&&<FilaTotal label={`IVA ${ivaGeneral}%`} valor={iva}/>}
          <FilaTotal label="PROPINA" valor={0}/><FilaTotal label="VALOR TOTAL" valor={total} bold/>
        </tbody></table></td>
      </tr></tbody></table>
      {observaciones&&<div className="sri-obs"><b>Observaciones:</b> {observaciones}</div>}
      <div className="sri-footer"><span>Página 1 de 1</span><span>{estado==='borrador'?'⚠ BORRADOR — No válido como comprobante':`Generado por FacuStock · ${new Date().toLocaleString('es-EC')}`}</span></div>
    </div></div>
  );
};
const FilaTotal=({label,valor,bold})=>(<tr><td style={{padding:'3px 8px',borderBottom:'1px solid #eee',fontWeight:bold?'900':'400',fontSize:'7.5pt'}}>{label}</td><td style={{padding:'3px 8px',borderBottom:'1px solid #eee',textAlign:'right',fontWeight:bold?'900':'400',fontFamily:"'Courier New',monospace",fontSize:'7.5pt'}}>$ &nbsp;{parseFloat(valor).toFixed(2)}</td></tr>);

// ─── Buscador ──────────────────────────────────────────────
const Buscador = ({ placeholder, items, onSelect, renderItem, renderSelected, selected, onClear, loading }) => {
  const [q,setQ]=useState('');const [open,setOpen]=useState(false);const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h);},[]);
  if(selected)return(
    <div style={{display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.65rem 1rem',border:`1.5px solid ${C.mid}`,borderRadius:'12px',background:C.lighter,boxShadow:`0 0 0 3px rgba(37,99,235,0.07)`}}>
      <div style={{width:'7px',height:'7px',borderRadius:'50%',background:C.mid,flexShrink:0}}/>
      <div style={{flex:1,fontSize:'0.87rem',fontWeight:'700',color:'#1e3a8a'}}>{renderSelected(selected)}</div>
      <button onClick={onClear} style={{background:'rgba(37,99,235,0.08)',border:'none',borderRadius:'6px',width:'24px',height:'24px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.mid}}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(37,99,235,0.16)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(37,99,235,0.08)'}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
  const filtrados=items.filter(i=>renderItem(i).toLowerCase().includes(q.toLowerCase())).slice(0,8);
  return(
    <div ref={ref} style={{position:'relative'}}>
      <div style={{position:'relative'}}>
        <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true);}} placeholder={placeholder}
          style={{padding:'0.65rem 1rem 0.65rem 2.5rem',border:'1.5px solid #e2e8f0',borderRadius:'12px',fontSize:'0.87rem',color:'#1e293b',outline:'none',fontFamily:'inherit',background:'white',width:'100%',boxSizing:'border-box'}}
          onFocus={e=>{e.target.style.borderColor=C.mid;e.target.style.boxShadow=`0 0 0 3px rgba(37,99,235,0.08)`;setOpen(true);}}
          onBlur={e=>{e.target.style.borderColor='#e2e8f0';e.target.style.boxShadow='none';}}/>
        <svg style={{position:'absolute',left:'0.8rem',top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 5px)',left:0,right:0,background:'white',border:'1.5px solid #e2e8f0',borderRadius:'12px',boxShadow:'0 16px 40px rgba(0,0,0,0.11)',zIndex:50,maxHeight:'230px',overflowY:'auto'}}>
          {loading&&<div style={{padding:'1rem',fontSize:'0.82rem',color:'#94a3b8',textAlign:'center'}}>Cargando...</div>}
          {!loading&&filtrados.length===0&&<div style={{padding:'1rem',fontSize:'0.82rem',color:'#94a3b8',textAlign:'center'}}>Sin resultados</div>}
          {filtrados.map((item,i)=>(
            <div key={i} onClick={()=>{onSelect(item);setQ('');setOpen(false);}}
              style={{padding:'0.72rem 1rem',fontSize:'0.85rem',cursor:'pointer',borderBottom:i<filtrados.length-1?'1px solid #f8fafc':'none',color:'#334155',fontWeight:'500'}}
              onMouseEnter={e=>{e.currentTarget.style.background=C.lighter;e.currentTarget.style.color=C.primary;}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#334155';}}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ══ COMPONENTE PRINCIPAL ══ */
const NuevaFactura = ({ onVolver, logoNegocio }) => {

  // ── Tour educativo primera visita ──────────────────────────────
  const [tourVisto_NF, setTourVisto_NF] = useState(() => !!localStorage.getItem(TOUR_KEY_NF));
  const [mostrarEdu_NF, setMostrarEdu_NF] = useState(false);

  const cerrarTour_NF = () => {
    localStorage.setItem(TOUR_KEY_NF, '1');
    setTourVisto_NF(true);
    setMostrarEdu_NF(true);
    setTimeout(() => setMostrarEdu_NF(false), 30000);
  };
  const verTutorial_NF = () => {
    localStorage.removeItem(TOUR_KEY_NF);
    setTourVisto_NF(false);
    setMostrarEdu_NF(false);
  };

  const navigate=useNavigate();
  const [clientes,setClientes]=useState([]);
  const [productos,setProductos]=useState([]);
  const [negocioUsuario,setNegocioUsuario]=useState(null);
  const [loadingDatos,setLoadingDatos]=useState(true);
  const [clienteSelec,setClienteSelec]=useState(null);
  const [fecha,setFecha]=useState(hoy());
  const [observaciones,setObservaciones]=useState('');
  const [lineas,setLineas]=useState([]);
  const [tarifasIVA,setTarifasIVA]=useState([
    {valor:0,label:'0%',descripcion:'Exento'},
    {valor:5,label:'5%',descripcion:'Tarifa reducida'},
    {valor:15,label:'15%',descripcion:'Tarifa general vigente'},
  ]);
  React.useEffect(()=>{
    const token=localStorage.getItem('token');
    fetch('https://factustock-efdi.onrender.com/api/tarifas-iva/?solo_activas=true',{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.ok?r.json():null)
      .then(data=>{if(data&&data.length>0)setTarifasIVA(data.map(t=>({valor:parseFloat(t.porcentaje),label:t.etiqueta,descripcion:t.descripcion})));})
      .catch(()=>{});
  },[]);
  const [guardando,setGuardando]=useState(false);
  const [errores,setErrores]=useState({});
  const [errorApi,setErrorApi]=useState('');
  const [exito,setExito]=useState(false);
  const [facturaGuardada,setFacturaGuardada]=useState(null);

  const pasoActivo = exito ? 3 : (lineas.length > 0 || clienteSelec) ? 2 : 1;

  useEffect(()=>{
    (async()=>{
      try{
        const [c,p,neg]=await Promise.all([clientesService.listar({porPagina:200}),productosService.listar({por_pagina:200,solo_con_stock:false}),negocioService.obtener()]);
        setClientes(c.items||[]);setProductos(p.items||[]);setNegocioUsuario(neg);
      }catch{setErrorApi('Error cargando datos del servidor.');}
      finally{setLoadingDatos(false);}
    })();
  },[]);

  const calcLinea=(l)=>{const subtotal=parseFloat(l.cantidad||0)*parseFloat(l.precio||0),desc=parseFloat(l.descuento||0),base=subtotal-desc,ivaP=parseFloat(l.porcentaje_iva||0),iva=ivaP>0?base*(ivaP/100):0;return{subtotal,desc,base,iva,total:base+iva};};
  const totales=lineas.reduce((acc,l)=>{const c=calcLinea(l);if(parseFloat(l.porcentaje_iva||0)===0)acc.sub0+=c.base;else acc.subIva+=c.base;acc.iva+=c.iva;acc.desc+=c.desc;acc.total+=c.total;return acc;},{sub0:0,subIva:0,iva:0,desc:0,total:0});
  const ivaGeneral=lineas.length>0?Math.max(...lineas.map(l=>parseFloat(l.porcentaje_iva||0))):15;

  const agregarLinea=(producto)=>{if(lineas.find(l=>l.id_producto===producto.id_producto))return;setLineas(prev=>[...prev,{id_producto:producto.id_producto,nombre:producto.nombre,codigo:producto.codigo,cantidad:1,precio:parseFloat(producto.precio_unitario||0),porcentaje_iva:parseFloat(producto.porcentaje_iva||0),stock:producto.stock,descuento:0}]);};
  const eliminarLinea=(idx)=>setLineas(prev=>prev.filter((_,i)=>i!==idx));
  const actualizarLinea=(idx,campo,valor)=>setLineas(prev=>prev.map((l,i)=>i===idx?{...l,[campo]:valor}:l));

  const validar=()=>{const e={};if(!clienteSelec)e.cliente='Selecciona un cliente';if(!fecha)e.fecha='Ingresa la fecha';if(lineas.length===0)e.lineas='Agrega al menos un producto';lineas.forEach((l,i)=>{if(!l.cantidad||l.cantidad<=0)e[`cant_${i}`]='Cantidad inválida';if(l.cantidad>l.stock)e[`cant_${i}`]=`Máx ${l.stock}`;if(!l.precio||l.precio<=0)e[`precio_${i}`]='Precio inválido';});setErrores(e);return Object.keys(e).length===0;};

  const guardar=async(estadoFinal)=>{if(!validar())return;setGuardando(true);setErrorApi('');try{const payload={id_persona_comercial:clienteSelec.id_persona_comercial,fecha_emision:fecha,porcentaje_iva:ivaGeneral,observaciones:observaciones||null,estado:estadoFinal,detalles:lineas.map(l=>({id_producto:l.id_producto,cantidad:parseInt(l.cantidad),precio_unitario:parseFloat(l.precio),porcentaje_iva:parseFloat(l.porcentaje_iva),descuento:parseFloat(l.descuento||0)}))};const respuesta=await facturasService.crear(payload);setFacturaGuardada({numeroComprobante:respuesta?.numero_comprobante||'001-001-XXXXXXXXX',fecha,cliente:clienteSelec,lineas:[...lineas],totales:{...totales},ivaGeneral,observaciones,estado:estadoFinal});setExito(true);}catch(e){const detail=e?.response?.data?.detail;setErrorApi(Array.isArray(detail)?detail.map(d=>d.msg||d).join(', '):detail||e?.message||'Error al guardar la factura.');}finally{setGuardando(false);} };

  const resetForm=()=>{setExito(false);setFacturaGuardada(null);setClienteSelec(null);setLineas([]);setObservaciones('');setFecha(hoy());setErrores({});setErrorApi('');};

  const BarraContexto = () => (
    <div style={{background:'white',borderRadius:'16px',padding:'0.9rem 1.4rem',boxShadow:'0 2px 12px rgba(0,0,0,0.05)',marginBottom:'1.4rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
        <div style={{width:'38px',height:'38px',borderRadius:'10px',background:`linear-gradient(135deg,${C.primary},${C.mid})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
        </div>
        <div>
          <p style={{margin:0,fontSize:'0.68rem',fontWeight:'700',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px'}}>Tipo de documento</p>
          <p style={{margin:0,fontSize:'0.92rem',fontWeight:'900',color:'#0f172a'}}>Nueva Factura</p>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center'}}>
        {PASOS.map((s,i)=>(
          <React.Fragment key={s.n}>
            <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
              <div style={{width:'24px',height:'24px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:'800',background:pasoActivo>=s.n?`linear-gradient(135deg,${C.primary},${C.mid})`:'#e2e8f0',color:pasoActivo>=s.n?'white':'#94a3b8',flexShrink:0}}>
                {pasoActivo>s.n?'✓':s.n}
              </div>
              <span style={{fontSize:'0.74rem',fontWeight:pasoActivo===s.n?'800':'500',color:pasoActivo>=s.n?'#0f172a':'#94a3b8',whiteSpace:'nowrap'}}>{s.label}</span>
            </div>
            {i<2&&<div style={{width:'36px',height:'2px',background:pasoActivo>s.n?C.mid:'#e2e8f0',margin:'0 0.5rem'}}/>}
          </React.Fragment>
        ))}
      </div>
      <button onClick={()=>onVolver ? onVolver() : navigate('/')}
        style={{background:C.lighter,border:`1.5px solid ${C.border}`,borderRadius:'8px',padding:'0.42rem 0.9rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'0.3rem',fontSize:'0.78rem',fontWeight:'700',color:C.primary,fontFamily:'inherit',flexShrink:0,transition:'all 0.15s'}}
        onMouseEnter={e=>{e.currentTarget.style.background=C.light;e.currentTarget.style.borderColor=C.mid;}}
        onMouseLeave={e=>{e.currentTarget.style.background=C.lighter;e.currentTarget.style.borderColor=C.border;}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Volver a Documentos
      </button>
    </div>
  );

  if (exito && facturaGuardada) return (
    <>
      <PrintViewSRI factura={facturaGuardada} negocio={negocioUsuario} logoNegocio={logoNegocio}/>
      <div className="no-print" style={{padding:'1.4rem 2rem',fontFamily:"'Nunito','Segoe UI',sans-serif",background:'#f1f5f9',minHeight:'100vh'}}>
        <BarraContexto/>
        <div style={{maxWidth:'440px',margin:'1.5rem auto 0',animation:'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)'}}>
          <div style={{background:'white',borderRadius:'20px',padding:'2.5rem',textAlign:'center',boxShadow:'0 4px 24px rgba(0,0,0,0.07)'}}>
            <div style={{width:'72px',height:'72px',borderRadius:'50%',background:`linear-gradient(135deg,${C.primary},${C.mid})`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.2rem',boxShadow:`0 16px 48px rgba(21,56,154,0.32)`}}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{fontSize:'1.5rem',fontWeight:'900',color:'#0f172a',margin:'0 0 0.3rem'}}>¡Factura guardada!</h2>
            <p style={{color:'#64748b',fontSize:'0.88rem',margin:'0 0 0.15rem'}}>Comprobante <strong style={{color:C.primary,fontFamily:'monospace'}}>{facturaGuardada.numeroComprobante}</strong></p>
            <p style={{color:'#94a3b8',fontSize:'0.81rem',margin:'0 0 1.5rem'}}>{facturaGuardada.estado==='finalizada'?'✓ Finalizada':'○ Borrador'} · {fmtFecha(facturaGuardada.fecha)}</p>
            <div style={{background:C.lighter,borderRadius:'14px',padding:'1rem 1.2rem',marginBottom:'1.4rem',textAlign:'left',border:`1.5px solid ${C.border}`}}>
              <p style={{margin:'0 0 0.6rem',fontSize:'0.68rem',fontWeight:'800',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px'}}>Resumen</p>
              {[{label:'Cliente',value:facturaGuardada.cliente?.nombres_apellidos||'—'},{label:'Productos',value:`${facturaGuardada.lineas.length} ítem(s)`}].map(r=>(
                <div key={r.label} style={{display:'flex',justifyContent:'space-between',fontSize:'0.83rem',marginBottom:'0.25rem'}}>
                  <span style={{color:'#64748b'}}>{r.label}</span><span style={{fontWeight:'700',color:'#0f172a'}}>{r.value}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.95rem',marginTop:'0.6rem',paddingTop:'0.6rem',borderTop:`1px solid ${C.light}`}}>
                <span style={{fontWeight:'800',color:'#0f172a'}}>Total</span>
                <span style={{fontWeight:'900',color:C.primary,fontSize:'1.1rem'}}>{fmtMoney(facturaGuardada.totales.total)}</span>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.65rem'}}>
              <button onClick={()=>window.print()}
                style={{padding:'0.88rem',borderRadius:'12px',border:'none',background:`linear-gradient(135deg,${C.primary},${C.mid})`,color:'white',fontWeight:'800',fontSize:'0.92rem',fontFamily:'inherit',cursor:'pointer',boxShadow:`0 8px 24px rgba(21,56,154,0.32)`,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',transition:'all 0.2s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 12px 32px rgba(21,56,154,0.42)`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=`0 8px 24px rgba(21,56,154,0.32)`;}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir Comprobante
              </button>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.65rem'}}>
                <button onClick={()=>onVolver ? onVolver() : navigate('/')}
                  style={{padding:'0.72rem',borderRadius:'12px',border:`1.5px solid ${C.border}`,background:C.lighter,color:C.primary,fontWeight:'700',fontSize:'0.84rem',fontFamily:'inherit',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem'}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.light}
                  onMouseLeave={e=>e.currentTarget.style.background=C.lighter}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Ir al Inicio
                </button>
                <button onClick={resetForm}
                  style={{padding:'0.72rem',borderRadius:'12px',border:'1.5px solid #e2e8f0',background:'white',color:'#475569',fontWeight:'700',fontSize:'0.84rem',fontFamily:'inherit',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.4rem'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.mid;e.currentTarget.style.color=C.mid;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#475569';}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Nueva Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{printCSS}</style>
    </>
  );

  return (
    <div style={{padding:'1.4rem 2rem',fontFamily:"'Nunito','Segoe UI',sans-serif",background:'#f1f5f9',minHeight:'100vh'}}>
      {/* Tour educativo */}
      {!tourVisto_NF && <TourBienvenida_NF onCerrar={cerrarTour_NF} />}
      {mostrarEdu_NF && <BannerEdu_NF onClose={() => setMostrarEdu_NF(false)} />}
      <BarraModoEdu_NF onVerTutorial={verTutorial_NF} />

      <BarraContexto/>

      {errorApi&&(
        <div style={{padding:'0.85rem 1.1rem',background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:'12px',color:'#b91c1c',fontSize:'0.84rem',fontWeight:'600',display:'flex',alignItems:'center',gap:'0.6rem',marginBottom:'1.2rem'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {errorApi}
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 330px',gap:'1.4rem',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'1.2rem'}}>

          {/* CLIENTE */}
          <div style={{background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)',border:'1px solid #f1f5f9'}}>
            <div style={{padding:'1rem 1.4rem',borderBottom:'1px solid #f8fafc',background:'#fafafa',display:'flex',alignItems:'center',gap:'0.7rem'}}>
              <div style={{width:'32px',height:'32px',borderRadius:'9px',background:`linear-gradient(135deg,${C.primary},${C.mid})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <h3 style={{margin:0,fontSize:'0.88rem',fontWeight:'800',color:'#0f172a'}}>Datos del Cliente</h3>
                <p style={{margin:0,fontSize:'0.7rem',color:'#94a3b8',fontWeight:'600'}}>Destinatario del comprobante</p>
              </div>
            </div>
            <div style={{padding:'1.2rem 1.4rem',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
              <div style={{gridColumn:'1/-1'}}>
                <label style={lbl}>Cliente <span style={{color:'#ef4444'}}>*</span></label>
                <Buscador placeholder="Buscar cliente por nombre o cédula..." items={clientes} loading={loadingDatos} selected={clienteSelec}
                  onSelect={c=>{setClienteSelec(c);setErrores(p=>({...p,cliente:null}));}} onClear={()=>setClienteSelec(null)}
                  renderItem={c=>`${c.nombres_apellidos||c.razon_social} — ${c.identificacion}`}
                  renderSelected={c=>`${c.nombres_apellidos||c.razon_social} (${c.identificacion})`}/>
                {errores.cliente&&<span style={{fontSize:'0.72rem',color:'#ef4444',marginTop:'0.3rem',display:'block'}}>⚠ {errores.cliente}</span>}
              </div>
              {clienteSelec&&(<>
                <div><label style={lbl}>Email</label><input value={clienteSelec.email||'—'} readOnly style={inputRO}/></div>
                <div><label style={lbl}>Teléfono</label><input value={clienteSelec.telefono||'—'} readOnly style={inputRO}/></div>
              </>)}
              <div>
                <label style={lbl}>Fecha de Emisión <span style={{color:'#ef4444'}}>*</span></label>
                <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inputBase,borderColor:errores.fecha?'#ef4444':'#e2e8f0'}}
                  onFocus={e=>{e.target.style.borderColor=C.mid;e.target.style.boxShadow=`0 0 0 3px rgba(37,99,235,0.08)`;}}
                  onBlur={e=>{e.target.style.borderColor=errores.fecha?'#ef4444':'#e2e8f0';e.target.style.boxShadow='none';}}/>
              </div>
              <div>
                <label style={lbl}>Observaciones</label>
                <input placeholder="Notas opcionales..." value={observaciones} onChange={e=>setObservaciones(e.target.value)} style={inputBase}
                  onFocus={e=>{e.target.style.borderColor=C.mid;e.target.style.boxShadow=`0 0 0 3px rgba(37,99,235,0.08)`;}}
                  onBlur={e=>{e.target.style.borderColor='#e2e8f0';e.target.style.boxShadow='none';}}/>
              </div>
            </div>
          </div>

          {/* PRODUCTOS */}
          <div style={{background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)',border:'1px solid #f1f5f9'}}>
            <div style={{padding:'1rem 1.4rem',borderBottom:'1px solid #f8fafc',background:'#fafafa',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.7rem'}}>
                <div style={{width:'4px',height:'22px',borderRadius:'2px',background:C.mid}}/>
                <div>
                  <h3 style={{margin:0,fontSize:'0.88rem',fontWeight:'800',color:'#0f172a'}}>
                    Productos / Servicios
                    {lineas.length>0&&<span style={{marginLeft:'0.5rem',padding:'2px 8px',borderRadius:'99px',background:C.lighter,color:C.primary,fontSize:'0.7rem',fontWeight:'800',border:`1px solid ${C.border}`}}>{lineas.length}</span>}
                  </h3>
                  <p style={{margin:0,fontSize:'0.7rem',color:'#94a3b8',fontWeight:'600'}}>Busca y agrega ítems a la factura</p>
                </div>
              </div>
              {errores.lineas&&<span style={{fontSize:'0.75rem',color:'#ef4444',fontWeight:'700',background:'#fef2f2',padding:'3px 10px',borderRadius:'99px',border:'1px solid #fecaca'}}>⚠ {errores.lineas}</span>}
            </div>
            <div style={{padding:'1.2rem 1.4rem'}}>
              <div style={{marginBottom:'1.2rem'}}>
                <Buscador placeholder="Buscar producto por nombre o código..." items={productos} loading={loadingDatos} selected={null}
                  onSelect={agregarLinea} onClear={()=>{}}
                  renderItem={p=>`${p.codigo?p.codigo+' — ':''}${p.nombre}  ·  Stock: ${p.stock}  ·  ${fmtMoney(p.precio_unitario)}`}
                  renderSelected={()=>''}/>
              </div>
              {lineas.length===0?(
                <div style={{padding:'2.5rem',textAlign:'center',border:`2px dashed ${C.border}`,borderRadius:'14px',background:C.lighter}}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:'0.75rem'}}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  <p style={{margin:0,fontWeight:'700',color:'#64748b',fontSize:'0.87rem'}}>Sin productos aún</p>
                  <p style={{margin:'0.3rem 0 0',fontSize:'0.78rem',color:'#94a3b8'}}>Busca arriba para agregar ítems</p>
                </div>
              ):(
                <div style={{overflowX:'auto'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 80px 115px 95px 68px 90px 34px',gap:'0.55rem',padding:'0.55rem 0.7rem',background:'#f8fafc',borderRadius:'9px',marginBottom:'0.5rem'}}>
                    {['Producto','Cant.','Precio Unit.','Descuento','IVA%','Total',''].map(h=>(
                      <span key={h} style={{fontSize:'0.66rem',fontWeight:'800',color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</span>
                    ))}
                  </div>
                  {lineas.map((l,i)=>{
                    const c=calcLinea(l);const hayError=errores[`cant_${i}`]||errores[`precio_${i}`];
                    return(
                      <div key={l.id_producto}
                        style={{display:'grid',gridTemplateColumns:'1fr 80px 115px 95px 68px 90px 34px',gap:'0.55rem',alignItems:'center',padding:'0.65rem 0.7rem',borderRadius:'11px',marginBottom:'0.4rem',background:hayError?'#fff5f5':'white',border:`1px solid ${hayError?'#fecaca':'#f1f5f9'}`,transition:'background 0.15s'}}
                        onMouseEnter={e=>{if(!hayError)e.currentTarget.style.background='#f8fbff';}}
                        onMouseLeave={e=>{if(!hayError)e.currentTarget.style.background='white';}}>
                        <div>
                          <div style={{fontSize:'0.86rem',fontWeight:'800',color:'#0f172a'}}>{l.nombre}</div>
                          <div style={{fontSize:'0.69rem',color:'#94a3b8',fontWeight:'600'}}>{l.codigo&&<span style={{marginRight:'0.4rem',color:C.mid}}>{l.codigo}</span>}Stock: {l.stock}</div>
                          {hayError&&<span style={{fontSize:'0.69rem',color:'#ef4444',fontWeight:'700'}}>⚠ {errores[`cant_${i}`]||errores[`precio_${i}`]}</span>}
                        </div>
                        <input type="number" min="1" max={l.stock} step="1" value={l.cantidad} onChange={e=>actualizarLinea(i,'cantidad',e.target.value)}
                          style={{...inputBase,textAlign:'center',borderColor:errores[`cant_${i}`]?'#ef4444':'#e2e8f0',padding:'0.48rem 0.4rem'}}
                          onFocus={e=>{e.target.style.borderColor=C.mid;e.target.style.boxShadow=`0 0 0 3px rgba(37,99,235,0.08)`;}}
                          onBlur={e=>{e.target.style.borderColor=errores[`cant_${i}`]?'#ef4444':'#e2e8f0';e.target.style.boxShadow='none';}}/>
                        <input type="number" min="0" step="0.01" value={l.precio} onChange={e=>actualizarLinea(i,'precio',e.target.value)}
                          style={{...inputBase,padding:'0.48rem 0.5rem'}}
                          onFocus={e=>{e.target.style.borderColor=C.mid;e.target.style.boxShadow=`0 0 0 3px rgba(37,99,235,0.08)`;}}
                          onBlur={e=>{e.target.style.borderColor='#e2e8f0';e.target.style.boxShadow='none';}}/>
                        <input type="number" min="0" step="0.01" value={l.descuento} onChange={e=>actualizarLinea(i,'descuento',e.target.value)}
                          style={{...inputBase,padding:'0.48rem 0.5rem'}}
                          onFocus={e=>{e.target.style.borderColor=C.mid;e.target.style.boxShadow=`0 0 0 3px rgba(37,99,235,0.08)`;}}
                          onBlur={e=>{e.target.style.borderColor='#e2e8f0';e.target.style.boxShadow='none';}}/>
                        <div style={{display:'flex',flexDirection:'column',gap:'0.2rem',alignItems:'center'}}>
                          {tarifasIVA.map(t=>{
                            const sel=Math.abs(parseFloat(l.porcentaje_iva)-t.valor)<0.001;
                            const col=t.valor===0?{p:'#059669',ll:'#ecfdf5',b:'#6ee7b7'}:t.valor<=5?{p:'#0891b2',ll:'#ecfeff',b:'#67e8f9'}:t.valor<=12?{p:'#d97706',ll:'#fffbeb',b:'#fcd34d'}:{p:'#15389a',ll:'#eff6ff',b:'#93c5fd'};
                            return(
                              <button key={t.valor} type="button" title={t.descripcion}
                                onClick={()=>actualizarLinea(i,'porcentaje_iva',t.valor)}
                                style={{padding:'2px 7px',borderRadius:'99px',border:`1.5px solid ${sel?col.b:'#e2e8f0'}`,background:sel?col.ll:'white',color:sel?col.p:'#94a3b8',fontWeight:sel?'800':'500',fontSize:'0.68rem',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',lineHeight:1.4,transition:'all 0.12s'}}>
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{textAlign:'right'}}>
                          <span style={{fontSize:'0.87rem',fontWeight:'800',color:'#0f172a'}}>{fmtMoney(c.total)}</span>
                          {c.iva>0&&<div style={{fontSize:'0.67rem',color:'#f59e0b',fontWeight:'700'}}>+{fmtMoney(c.iva)} IVA</div>}
                        </div>
                        <button onClick={()=>eliminarLinea(i)}
                          style={{width:'28px',height:'28px',borderRadius:'7px',border:'1.5px solid #fecaca',background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'#ef4444',transition:'all 0.15s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='#fef2f2';e.currentTarget.style.borderColor='#f87171';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='white';e.currentTarget.style.borderColor='#fecaca';}}>
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

        {/* RESUMEN */}
        <div style={{position:'sticky',top:'1rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div style={{background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 4px 20px rgba(0,0,0,0.08)',border:'1px solid #f1f5f9'}}>
            <div style={{padding:'1rem 1.3rem',background:`linear-gradient(135deg,${C.primary},${C.mid})`,position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:'-20px',right:'-20px',width:'70px',height:'70px',borderRadius:'50%',background:'rgba(255,255,255,0.06)'}}/>
              <h3 style={{margin:0,fontSize:'0.88rem',fontWeight:'800',color:'white',position:'relative'}}>Resumen de Factura</h3>
              <p style={{margin:'0.2rem 0 0',fontSize:'0.7rem',color:'rgba(255,255,255,0.5)',position:'relative'}}>{lineas.length} ítem{lineas.length!==1?'s':''} agregado{lineas.length!==1?'s':''}</p>
            </div>
            <div style={{padding:'1.1rem 1.3rem'}}>
              {[
                {label:'Subtotal (0%)',value:fmtMoney(totales.sub0),show:totales.sub0>0,color:'#475569'},
                {label:'Subtotal (IVA)',value:fmtMoney(totales.subIva),show:totales.subIva>0,color:'#475569'},
                {label:'Descuentos',value:`- ${fmtMoney(totales.desc)}`,show:totales.desc>0,color:'#16a34a'},
                {label:`IVA (${ivaGeneral}%)`,value:fmtMoney(totales.iva),show:totales.iva>0,color:'#f59e0b'},
              ].filter(r=>r.show).map(r=>(
                <div key={r.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0',borderBottom:'1px solid #f8fafc'}}>
                  <span style={{fontSize:'0.81rem',color:'#64748b',fontWeight:'600'}}>{r.label}</span>
                  <span style={{fontSize:'0.83rem',fontWeight:'700',color:r.color}}>{r.value}</span>
                </div>
              ))}
              {lineas.length===0&&<p style={{textAlign:'center',color:'#cbd5e1',fontSize:'0.79rem',padding:'0.9rem 0',margin:0}}>Agrega productos para ver el resumen</p>}
              <div style={{margin:'0.9rem 0 0',padding:'0.9rem 1rem',background:C.lighter,borderRadius:'12px',border:`1.5px solid ${C.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'0.82rem',fontWeight:'800',color:C.primary,textTransform:'uppercase',letterSpacing:'0.5px'}}>Total</span>
                  <span style={{fontSize:'1.55rem',fontWeight:'900',color:C.primary,letterSpacing:'-0.5px'}}>{fmtMoney(totales.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <button onClick={()=>guardar('finalizada')} disabled={guardando}
            style={{padding:'0.88rem',borderRadius:'12px',border:'none',cursor:guardando?'not-allowed':'pointer',background:guardando?C.border:`linear-gradient(135deg,${C.primary},${C.mid})`,color:'white',fontWeight:'800',fontSize:'0.92rem',fontFamily:'inherit',boxShadow:guardando?'none':`0 8px 24px rgba(21,56,154,0.35)`,display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',transition:'all 0.2s'}}
            onMouseEnter={e=>{if(!guardando){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 12px 32px rgba(21,56,154,0.45)`;} }}
            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=guardando?'none':`0 8px 24px rgba(21,56,154,0.35)`;}}>
            {guardando
              ?<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:'spin 1s linear infinite'}}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>Guardando...</>
              :<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Emitir Factura</>
            }
          </button>

          <button onClick={()=>guardar('borrador')} disabled={guardando}
            style={{padding:'0.76rem',borderRadius:'12px',border:'1.5px solid #e2e8f0',cursor:guardando?'not-allowed':'pointer',background:'white',color:'#475569',fontWeight:'700',fontSize:'0.87rem',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',transition:'all 0.2s'}}
            onMouseEnter={e=>{if(!guardando){e.currentTarget.style.borderColor=C.mid;e.currentTarget.style.color=C.mid;e.currentTarget.style.background=C.lighter;}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#475569';e.currentTarget.style.background='white';}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Guardar como Borrador
          </button>

          <div style={{padding:'0.82rem 1rem',background:'#f8fafc',borderRadius:'11px',border:'1px solid #f1f5f9',fontSize:'0.74rem',color:'#64748b',lineHeight:'1.65'}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.4rem',marginBottom:'0.28rem'}}>
              <div style={{width:'7px',height:'7px',borderRadius:'2px',background:`linear-gradient(135deg,${C.primary},${C.mid})`,flexShrink:0}}/>
              <strong style={{color:'#334155'}}>Emitir</strong> — finaliza y descuenta stock
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.4rem'}}>
              <div style={{width:'7px',height:'7px',borderRadius:'2px',background:'#e2e8f0',flexShrink:0}}/>
              <strong style={{color:'#334155'}}>Borrador</strong> — guarda sin afectar inventario
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourFadeIn{ from{opacity:0} to{opacity:1} }
        @keyframes tourPopIn { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
        * { -webkit-font-smoothing:antialiased; }
      `}</style>
    </div>
  );
};

const lbl = { fontSize:'0.72rem', fontWeight:'800', color:'#475569', letterSpacing:'0.3px', textTransform:'uppercase', display:'block', marginBottom:'0.38rem' };
const inputBase = { padding:'0.62rem 0.85rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.86rem', color:'#1e293b', background:'white', width:'100%', boxSizing:'border-box', fontFamily:'inherit', outline:'none' };
const inputRO = { ...inputBase, borderColor:'#f1f5f9', color:'#94a3b8', background:'#fafafa' };

const printCSS = `
  @keyframes popIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
  #print-area { display:none; font-family:Arial,Helvetica,sans-serif; font-size:8pt; color:#000; }
  .sri-wrap { max-width:21cm; margin:0 auto; }
  .sri-header { width:100%; border-collapse:collapse; border:1px solid #000; }
  .sri-header-left { width:55%; padding:8px 10px; vertical-align:top; border-right:1px solid #000; }
  .sri-header-right { width:45%; padding:8px 10px; vertical-align:top; }
  .sri-logo { max-height:75px; max-width:150px; object-fit:contain; display:block; margin-bottom:5px; }
  .sri-logo-box { width:110px; height:55px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:8pt; font-weight:700; color:#64748b; text-align:center; border:1px solid #e2e8f0; margin-bottom:5px; border-radius:3px; }
  .sri-nombre-grande { margin:0 0 2px; font-size:13pt; font-weight:900; }
  .sri-dato { margin:0 0 1px; font-size:7.5pt; }
  .sri-comp-box { width:100%; border-collapse:collapse; border:1px solid #000; font-size:7.5pt; }
  .sri-comp-box td { padding:3px 6px; border-bottom:1px solid #ccc; }
  .sri-comp-row { font-weight:600; }
  .sri-factura-title { font-size:12pt; font-weight:900; }
  .sri-clave-box { border:1px solid #000; padding:4px; margin-top:5px; text-align:center; }
  .sri-clave-titulo { margin:0 0 2px; font-weight:900; font-size:8pt; }
  .sri-barcode { height:30px; line-height:0; margin:3px 0; }
  .sri-receptor { width:100%; border-collapse:collapse; border:1px solid #000; border-top:none; font-size:7.5pt; }
  .sri-rec-td { padding:4px 8px; border-right:1px solid #ccc; border-bottom:1px solid #ccc; }
  .sri-rec-label { font-weight:700; }
  .sri-detalle { width:100%; border-collapse:collapse; border:1px solid #000; border-top:none; font-size:7.5pt; }
  .sri-th-row { background:#1e1b4b; color:white; }
  .sri-th { padding:4px 6px; font-size:7pt; font-weight:700; text-transform:uppercase; border-right:1px solid #444; text-align:left; }
  .sri-desc { width:35%; }
  .sri-td { padding:3px 6px; border-bottom:1px solid #eee; border-right:1px solid #eee; vertical-align:top; }
  .sri-center { text-align:center; }
  .sri-right { text-align:right; }
  .sri-mono { font-family:'Courier New',monospace; }
  .sri-small { font-size:6.5pt; }
  .sri-bottom { width:100%; border-collapse:collapse; border:1px solid #000; border-top:none; font-size:7.5pt; }
  .sri-pago-cell { width:55%; vertical-align:top; border-right:1px solid #000; padding:0; }
  .sri-totales-cell { width:45%; vertical-align:top; padding:0; }
  .sri-pago { width:100%; border-collapse:collapse; font-size:7pt; }
  .sri-section-title { background:#e5e7eb; padding:3px 6px; font-weight:700; text-align:center; border-bottom:1px solid #ccc; }
  .sri-pago-th { padding:3px 6px; border-bottom:1px solid #ccc; border-right:1px solid #ccc; font-weight:700; font-size:6.5pt; }
  .sri-pago-td { padding:3px 6px; border-bottom:1px solid #eee; border-right:1px solid #eee; font-size:6.5pt; }
  .sri-totales { width:100%; border-collapse:collapse; font-size:7.5pt; }
  .sri-obs { padding:4px 8px; font-size:7.5pt; border:1px solid #000; border-top:none; }
  .sri-footer { display:flex; justify-content:space-between; font-size:6.5pt; color:#666; padding:3px 8px; border:1px solid #000; border-top:none; }
  @media print {
    * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    body * { visibility:hidden !important; }
    #print-area { visibility:visible !important; display:block !important; position:absolute !important; top:0 !important; left:0 !important; width:100% !important; background:white !important; padding:0.5cm 1cm !important; box-sizing:border-box !important; }
    #print-area * { visibility:visible !important; }
    .no-print { display:none !important; }
  }
`;

export default NuevaFactura;
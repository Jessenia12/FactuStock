import React, { useState, useEffect, useCallback } from 'react';
import { guiasRemisionService, clientesService, facturasService, productosService } from '../services/api';

// ─── Tema: Índigo/Azul ─────────────────────────────────────
const C = {
  primary:  '#6366f1',
  dark:     '#4f46e5',
  darker:   '#3730a3',
  light:    '#e0e7ff',
  lighter:  '#eef2ff',
  border:   '#a5b4fc',
  text:     '#312e81',
};

const UNIDADES = ['UNIDAD','CAJA','PAQUETE','KILOGRAMO','GRAMO','LITRO','METRO','PAR','DOCENA','FARDO','SACO','CANASTA','ATADO'];

const fmtMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (s) => { if (!s) return '—'; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }); };
const today    = () => new Date().toISOString().split('T')[0];
const addDays  = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0]; };

// ─── Indicador de pasos ────────────────────────────────────
const StepIndicator = ({ paso }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.8rem' }}>
    {[
      { n: 1, label: 'Destinatario' },
      { n: 2, label: 'Transporte' },
      { n: 3, label: 'Mercadería' },
      { n: 4, label: 'Confirmar' },
    ].map((s, i) => (
      <React.Fragment key={s.n}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', fontSize: '0.85rem',
            background: paso >= s.n ? C.primary : '#e2e8f0',
            color:      paso >= s.n ? 'white' : '#94a3b8',
            border:     paso === s.n ? `3px solid ${C.dark}` : '3px solid transparent',
            transition: 'all 0.3s',
          }}>
            {paso > s.n
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : s.n}
          </div>
          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: paso >= s.n ? C.dark : '#94a3b8', whiteSpace: 'nowrap' }}>{s.label}</span>
        </div>
        {i < 3 && <div style={{ flex: 1, height: '3px', margin: '0 0.35rem 1.4rem', borderRadius: '2px', background: paso > s.n ? C.primary : '#e2e8f0', transition: 'background 0.4s' }} />}
      </React.Fragment>
    ))}
  </div>
);

// ─── Botones de navegación ────────────────────────────────
const NavBtns = ({ onPrev, onNext, nextLabel = 'Siguiente', nextDisabled = false, loading = false }) => (
  <div style={{ display: 'flex', justifyContent: onPrev ? 'space-between' : 'flex-end', marginTop: '1rem' }}>
    {onPrev && (
      <button onClick={onPrev}
        style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Anterior
      </button>
    )}
    <button onClick={onNext} disabled={nextDisabled || loading}
      style={{ padding: '0.65rem 1.7rem', borderRadius: '10px', border: 'none', background: nextDisabled || loading ? '#e2e8f0' : `linear-gradient(135deg, ${C.primary}, ${C.dark})`, color: nextDisabled || loading ? '#94a3b8' : 'white', fontWeight: '700', fontSize: '0.85rem', cursor: nextDisabled || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: nextDisabled || loading ? 'none' : `0 4px 14px ${C.primary}55`, display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s' }}>
      {loading
        ? <><div style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Procesando...</>
        : <>{nextLabel}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></>
      }
    </button>
  </div>
);

// ─── Componente principal ─────────────────────────────────
const GuiaRemision = ({ onVolver }) => {
  const [paso,    setPaso]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [exito,   setExito]   = useState(null);

  // ── PASO 1: Destinatario + factura origen ──────────────
  const [busqDest,      setBusqDest]      = useState('');
  const [destinatarios, setDestinatarios] = useState([]);
  const [destSel,       setDestSel]       = useState(null);
  const [cargandoDest,  setCargandoDest]  = useState(false);
  const [facturas,      setFacturas]      = useState([]);
  const [facturaSel,    setFacturaSel]    = useState(null);
  const [cargandoFact,  setCargandoFact]  = useState(false);

  // ── PASO 2: Datos del transporte ───────────────────────
  const [transporte, setTransporte] = useState({
    numero_comprobante:         '',
    numero_autorizacion:        '',
    fecha_emision:              today(),
    fecha_inicio_transporte:    today(),
    fecha_fin_transporte:       addDays(today(), 3),
    razon_social_transportista: '',
    tipo_id_transportista:      'RUC',
    ruc_transportista:          '',
    placa_vehiculo:             '',
    direccion_partida:          '',
    direccion_destino:          '',
    observaciones:              '',
  });

  // ── PASO 3: Ítems de mercadería ────────────────────────
  const [items,          setItems]          = useState([{ id: Date.now(), id_producto: null, codigo: '', descripcion: '', cantidad: '1', unidad: 'UNIDAD', _nombre: '' }]);
  const [busqProd,       setBusqProd]       = useState('');
  const [resultsProd,    setResultsProd]    = useState([]);
  const [activeProdIdx,  setActiveProdIdx]  = useState(null);
  const [cargandoProd,   setCargandoProd]   = useState(false);

  // ── Buscar destinatario ────────────────────────────────
  const buscarDest = useCallback(async (q) => {
    if (!q || q.length < 2) { setDestinatarios([]); return; }
    setCargandoDest(true);
    try {
      const res = await clientesService.listar({ buscar: q, porPagina: 20 });
      setDestinatarios(res.items || res);
    } catch { setDestinatarios([]); }
    finally { setCargandoDest(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscarDest(busqDest), 350);
    return () => clearTimeout(t);
  }, [busqDest, buscarDest]);

  const seleccionarDest = async (d) => {
    setDestSel(d);
    setDestinatarios([]);
    setBusqDest('');
    setFacturaSel(null);
    setCargandoFact(true);
    try {
      const res = await facturasService.listar({ porPagina: 50, estado: 'finalizada' });
      const facs = (res.items || res).filter(f =>
        f.id_persona_comercial === d.id_persona_comercial ||
        f.cliente?.id_persona_comercial === d.id_persona_comercial
      );
      setFacturas(facs);
    } catch { setFacturas([]); }
    finally { setCargandoFact(false); }
  };

  // ── Buscar producto ────────────────────────────────────
  const buscarProducto = useCallback(async (q) => {
    if (!q || q.length < 2) { setResultsProd([]); return; }
    setCargandoProd(true);
    try {
      const res = await productosService.listar({ buscar: q, por_pagina: 10 });
      setResultsProd(res.items || res);
    } catch { setResultsProd([]); }
    finally { setCargandoProd(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscarProducto(busqProd), 300);
    return () => clearTimeout(t);
  }, [busqProd, buscarProducto]);

  const seleccionarProducto = (idx, prod) => {
    setItems(prev => prev.map((item, i) => i !== idx ? item : {
      ...item,
      id_producto: prod.id_producto,
      codigo:      prod.codigo,
      descripcion: prod.nombre,
      _nombre:     prod.nombre,
    }));
    setActiveProdIdx(null);
    setBusqProd('');
    setResultsProd([]);
  };

  const updateItem = (idx, campo, valor) => {
    setItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, [campo]: valor }));
  };

  const agregarItem = () => setItems(prev => [...prev, { id: Date.now(), id_producto: null, codigo: '', descripcion: '', cantidad: '1', unidad: 'UNIDAD', _nombre: '' }]);
  const eliminarItem = (idx) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)); };

  // Auto-llenar mercadería desde factura
  const cargarItemsDesdeFactura = async (factura) => {
    try {
      const detalle = await facturasService.obtener(factura.id_factura);
      if (detalle?.detalles?.length) {
        setItems(detalle.detalles.map(d => ({
          id:          d.id_detalle,
          id_producto: d.id_producto,
          codigo:      d.producto?.codigo || '',
          descripcion: d.producto?.nombre || d.descripcion || '',
          cantidad:    String(d.cantidad),
          unidad:      'UNIDAD',
          _nombre:     d.producto?.nombre || '',
        })));
      }
    } catch { /* silencioso */ }
  };

  // ── Validaciones ───────────────────────────────────────
  const puedeAvanzar1 = !!destSel;
  const puedeAvanzar2 = (
    transporte.numero_comprobante.trim() &&
    transporte.razon_social_transportista.trim() &&
    transporte.ruc_transportista.trim() &&
    transporte.direccion_partida.trim() &&
    transporte.direccion_destino.trim() &&
    transporte.fecha_inicio_transporte <= transporte.fecha_fin_transporte
  );
  const puedeAvanzar3 = items.every(it => it.descripcion.trim() && parseFloat(it.cantidad) > 0);

  // ── Emitir ─────────────────────────────────────────────
  const emitir = async () => {
    setLoading(true); setError('');
    try {
      const payload = {
        id_destinatario:             destSel.id_persona_comercial,
        id_factura:                  facturaSel?.id_factura || null,
        numero_comprobante:          transporte.numero_comprobante.trim(),
        numero_autorizacion:         transporte.numero_autorizacion.trim() || null,
        fecha_emision:               transporte.fecha_emision,
        fecha_inicio_transporte:     transporte.fecha_inicio_transporte,
        fecha_fin_transporte:        transporte.fecha_fin_transporte,
        razon_social_transportista:  transporte.razon_social_transportista.trim(),
        tipo_id_transportista:       transporte.tipo_id_transportista,
        ruc_transportista:           transporte.ruc_transportista.trim(),
        placa_vehiculo:              transporte.placa_vehiculo.trim() || null,
        direccion_partida:           transporte.direccion_partida.trim(),
        direccion_destino:           transporte.direccion_destino.trim(),
        observaciones:               transporte.observaciones.trim() || null,
        detalles: items.map(it => ({
          id_producto: it.id_producto || null,
          codigo:      it.codigo || null,
          descripcion: it.descripcion.trim(),
          cantidad:    parseFloat(it.cantidad),
          unidad:      it.unidad,
        })),
      };
      const res = await guiasRemisionService.crear(payload);
      setExito(res);
    } catch (e) {
      setError(e?.detail || e?.message || 'Error al emitir la guía.');
    } finally { setLoading(false); }
  };

  // ── Pantalla éxito ─────────────────────────────────────
  if (exito) return (
    <div style={{ padding: '2rem', maxWidth: '680px', margin: '0 auto', animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '2.5rem', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.4rem' }}>¡Guía de remisión emitida!</h2>
        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1.5rem' }}>N° <strong>{exito.numero_comprobante}</strong></p>
        <div style={{ background: C.lighter, borderRadius: '12px', padding: '1.1rem 1.4rem', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {[
              { label: 'Destinatario',   value: exito.destinatario?.nombre },
              { label: 'Transportista',  value: exito.razon_social_transportista },
              { label: 'Inicio transp.', value: fmtFecha(exito.fecha_inicio_transporte) },
              { label: 'Fin transp.',    value: fmtFecha(exito.fecha_fin_transporte) },
              { label: 'Origen',         value: exito.direccion_partida },
              { label: 'Destino',        value: exito.direccion_destino },
              { label: 'Ítems',          value: `${exito.detalles?.length || 0} producto(s)` },
              { label: 'Placa',          value: exito.placa_vehiculo || '—' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ fontSize: '0.87rem', fontWeight: '700', color: '#0f172a' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={() => { setExito(null); setPaso(1); setDestSel(null); setFacturaSel(null); setTransporte({ numero_comprobante: '', numero_autorizacion: '', fecha_emision: today(), fecha_inicio_transporte: today(), fecha_fin_transporte: addDays(today(), 3), razon_social_transportista: '', tipo_id_transportista: 'RUC', ruc_transportista: '', placa_vehiculo: '', direccion_partida: '', direccion_destino: '', observaciones: '' }); setItems([{ id: Date.now(), id_producto: null, codigo: '', descripcion: '', cantidad: '1', unidad: 'UNIDAD', _nombre: '' }]); }}
            style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: `2px solid ${C.border}`, background: C.lighter, color: C.text, fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>
            Nueva Guía
          </button>
          <button onClick={onVolver}
            style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${C.primary}, ${C.dark})`, color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit', boxShadow: `0 4px 14px ${C.primary}55` }}>
            Volver a Documentos
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto', animation: 'fadeUp 0.3s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Guía de Remisión</h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>Amparo el traslado de mercadería</p>
        </div>
        <button onClick={onVolver}
          style={{ padding: '0.45rem 1rem', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'white'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
      </div>

      <StepIndicator paso={paso} />

      {/* ══════════════ PASO 1 — DESTINATARIO ══════════════ */}
      {paso === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease both' }}>

          {/* Buscar destinatario */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Destinatario
            </h3>

            {!destSel ? (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <input value={busqDest} onChange={e => setBusqDest(e.target.value)}
                    placeholder="Buscar destinatario por nombre, RUC o cédula..."
                    style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.5rem', border: `1.5px solid ${busqDest ? C.border : '#e2e8f0'}`, borderRadius: '10px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = C.primary}
                    onBlur={e => e.target.style.borderColor = busqDest ? C.border : '#e2e8f0'} />
                  <svg style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {cargandoDest && <div style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: `2px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />}
                </div>
                {destinatarios.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'white', borderRadius: '10px', border: '1.5px solid #e2e8f0', boxShadow: '0 8px 28px rgba(0,0,0,0.10)', marginTop: '4px', maxHeight: '240px', overflowY: 'auto' }}>
                    {destinatarios.map(d => (
                      <div key={d.id_persona_comercial} onClick={() => seleccionarDest(d)}
                        style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = C.lighter}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>{d.razon_social || d.nombres_apellidos}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{d.tipo_identificacion}: {d.identificacion} · {[d.flag_cliente && 'Cliente', d.flag_proveedor && 'Proveedor'].filter(Boolean).join(' / ')}</div>
                      </div>
                    ))}
                  </div>
                )}
                {busqDest.length >= 2 && !cargandoDest && destinatarios.length === 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#94a3b8' }}>No se encontraron resultados.</div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.1rem', background: C.lighter, borderRadius: '10px', border: `1.5px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `linear-gradient(135deg, ${C.primary}, ${C.dark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: '800', color: 'white' }}>
                    {(destSel.razon_social || destSel.nombres_apellidos || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#0f172a' }}>{destSel.razon_social || destSel.nombres_apellidos}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{destSel.tipo_identificacion}: {destSel.identificacion}</div>
                  </div>
                </div>
                <button onClick={() => { setDestSel(null); setFacturaSel(null); setFacturas([]); }}
                  style={{ background: 'white', border: `1.5px solid ${C.border}`, borderRadius: '8px', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', color: C.text, fontFamily: 'inherit' }}>
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* Factura de origen (opcional) */}
          {destSel && (
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.35rem' }}>
                Factura de Origen <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8' }}>(opcional — carga automáticamente la mercadería)</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 1rem' }}>Selecciona si esta guía ampara una factura ya emitida</p>
              {cargandoFact ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <div style={{ width: '16px', height: '16px', border: `2px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Cargando facturas...
                </div>
              ) : facturas.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '0.6rem', background: '#f8fafc', borderRadius: '8px' }}>No hay facturas finalizadas para este destinatario.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '200px', overflowY: 'auto' }}>
                  <div onClick={() => { setFacturaSel(null); }} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${!facturaSel ? C.primary : '#e2e8f0'}`, background: !facturaSel ? C.lighter : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${!facturaSel ? C.primary : '#cbd5e1'}`, background: !facturaSel ? C.primary : 'white', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.83rem', color: '#64748b', fontWeight: '500' }}>Sin factura de origen</span>
                  </div>
                  {facturas.map(f => (
                    <div key={f.id_factura}
                      onClick={async () => { setFacturaSel(f); await cargarItemsDesdeFactura(f); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${facturaSel?.id_factura === f.id_factura ? C.primary : '#e2e8f0'}`, background: facturaSel?.id_factura === f.id_factura ? C.lighter : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${facturaSel?.id_factura === f.id_factura ? C.primary : '#cbd5e1'}`, background: facturaSel?.id_factura === f.id_factura ? C.primary : 'white', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>{f.numero_comprobante}</span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: '0.7rem' }}>{fmtFecha(f.fecha_emision)}</span>
                      </div>
                      <span style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a' }}>{fmtMoney(f.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <NavBtns onNext={() => setPaso(2)} nextLabel="Siguiente: Transporte" nextDisabled={!puedeAvanzar1} />
        </div>
      )}

      {/* ══════════════ PASO 2 — TRANSPORTE ══════════════ */}
      {paso === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease both' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>

            {/* Comprobante */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Datos del Comprobante
              </h3>
              {[
                { label: 'N° Comprobante *', key: 'numero_comprobante', placeholder: 'Ej: 001-001-000000001' },
                { label: 'N° Autorización SRI', key: 'numero_autorizacion', placeholder: 'Número de 49 dígitos' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '0.85rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>{f.label}</label>
                  <input value={transporte[f.key]} onChange={e => setTransporte(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: `1.5px solid ${transporte[f.key] ? '#e2e8f0' : (f.label.includes('*') ? '#fca5a5' : '#e2e8f0')}`, borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.primary}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                {[
                  { label: 'Fecha Emisión *', key: 'fecha_emision', type: 'date' },
                  { label: 'Inicio Transporte *', key: 'fecha_inicio_transporte', type: 'date' },
                  { label: 'Fin Transporte *', key: 'fecha_fin_transporte', type: 'date' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>{f.label}</label>
                    <input type="date" value={transporte[f.key]} onChange={e => setTransporte(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '0.55rem 0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = C.primary}
                      onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                  </div>
                ))}
              </div>
              {transporte.fecha_fin_transporte < transporte.fecha_inicio_transporte && (
                <div style={{ fontSize: '0.78rem', color: '#ef4444', marginTop: '0.4rem' }}>⚠ La fecha fin no puede ser anterior a la fecha inicio.</div>
              )}
            </div>

            {/* Transportista */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                Datos del Transportista
              </h3>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Razón Social *</label>
                <input value={transporte.razon_social_transportista} onChange={e => setTransporte(p => ({ ...p, razon_social_transportista: e.target.value }))}
                  placeholder="Nombre o razón social del transportista"
                  style={{ width: '100%', padding: '0.6rem 0.8rem', border: `1.5px solid ${transporte.razon_social_transportista ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '0.6rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Tipo ID *</label>
                  <select value={transporte.tipo_id_transportista} onChange={e => setTransporte(p => ({ ...p, tipo_id_transportista: e.target.value }))}
                    style={{ width: '100%', padding: '0.6rem 0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                    <option value="RUC">RUC</option>
                    <option value="CEDULA">Cédula</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>RUC / Identificación *</label>
                  <input value={transporte.ruc_transportista} onChange={e => setTransporte(p => ({ ...p, ruc_transportista: e.target.value }))}
                    placeholder="Número de identificación"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: `1.5px solid ${transporte.ruc_transportista ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.primary}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Placa del Vehículo</label>
                <input value={transporte.placa_vehiculo} onChange={e => setTransporte(p => ({ ...p, placa_vehiculo: e.target.value.toUpperCase() }))}
                  placeholder="Ej: ABC-1234"
                  maxLength={8}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box', letterSpacing: '1px' }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>

            {/* Rutas */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Rutas de Traslado
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: '0.7rem', alignItems: 'start' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Dirección de Partida *</label>
                  <textarea value={transporte.direccion_partida} onChange={e => setTransporte(p => ({ ...p, direccion_partida: e.target.value }))}
                    placeholder="Ej: Av. 6 de Diciembre N45-23, Quito, Pichincha"
                    rows={2}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: `1.5px solid ${transporte.direccion_partida ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.primary}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '1.5rem' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Dirección de Destino *</label>
                  <textarea value={transporte.direccion_destino} onChange={e => setTransporte(p => ({ ...p, direccion_destino: e.target.value }))}
                    placeholder="Ej: Calle Bolívar 123, Guayaquil, Guayas"
                    rows={2}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', border: `1.5px solid ${transporte.direccion_destino ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = C.primary}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
              <div style={{ marginTop: '0.85rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Observaciones</label>
                <textarea value={transporte.observaciones} onChange={e => setTransporte(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Instrucciones adicionales (opcional)"
                  rows={2}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid #e2e8f0', borderRadius: '9px', fontSize: '0.87rem', fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
            </div>
          </div>

          <NavBtns onPrev={() => setPaso(1)} onNext={() => setPaso(3)} nextLabel="Siguiente: Mercadería" nextDisabled={!puedeAvanzar2} />
        </div>
      )}

      {/* ══════════════ PASO 3 — MERCADERÍA ══════════════ */}
      {paso === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease both' }}>

          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                Detalle de Mercadería
              </h3>
              <button onClick={agregarItem}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.9rem', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.lighter, color: C.text, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = C.light}
                onMouseLeave={e => e.currentTarget.style.background = C.lighter}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar ítem
              </button>
            </div>

            {/* Cabecera */}
            <div style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr 110px 110px 36px', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '2px solid #f1f5f9', marginBottom: '0.5rem' }}>
              {['Producto (buscar)','Código','Descripción','Cantidad','Unidad',''].map(col => (
                <span key={col} style={{ fontSize: '0.67rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{col}</span>
              ))}
            </div>

            {items.map((item, idx) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '180px 80px 1fr 110px 110px 36px', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: idx < items.length - 1 ? '1px solid #f8fafc' : 'none' }}>

                {/* Buscar producto */}
                <div style={{ position: 'relative' }}>
                  {item.id_producto ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.38rem 0.5rem', background: C.lighter, borderRadius: '8px', border: `1.5px solid ${C.border}` }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item._nombre || item.descripcion}</span>
                      <button onClick={() => updateItem(idx, 'id_producto', null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0', flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={activeProdIdx === idx ? busqProd : ''}
                        onChange={e => { setActiveProdIdx(idx); setBusqProd(e.target.value); }}
                        onFocus={() => setActiveProdIdx(idx)}
                        placeholder="Buscar producto..."
                        style={{ width: '100%', padding: '0.42rem 0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                      {activeProdIdx === idx && resultsProd.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: 'white', borderRadius: '8px', border: '1.5px solid #e2e8f0', boxShadow: '0 6px 20px rgba(0,0,0,0.10)', marginTop: '2px', maxHeight: '180px', overflowY: 'auto' }}>
                          {resultsProd.map(p => (
                            <div key={p.id_producto} onMouseDown={() => seleccionarProducto(idx, p)}
                              style={{ padding: '0.5rem 0.7rem', cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = C.lighter}
                              onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>{p.nombre}</div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.codigo} · Stock: {p.stock}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {activeProdIdx === idx && cargandoProd && (
                        <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', border: `2px solid ${C.border}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      )}
                    </>
                  )}
                </div>

                {/* Código */}
                <input value={item.codigo} onChange={e => updateItem(idx, 'codigo', e.target.value)}
                  placeholder="Cód."
                  style={{ padding: '0.42rem 0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'monospace', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />

                {/* Descripción */}
                <input value={item.descripcion} onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                  placeholder="Descripción del ítem *"
                  style={{ padding: '0.42rem 0.6rem', border: `1.5px solid ${item.descripcion ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = item.descripcion ? '#e2e8f0' : '#fca5a5'} />

                {/* Cantidad */}
                <input type="number" min="0.001" step="0.001" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                  style={{ padding: '0.42rem 0.5rem', border: `1.5px solid ${parseFloat(item.cantidad) > 0 ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '8px', fontSize: '0.88rem', fontWeight: '700', textAlign: 'right', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = C.primary}
                  onBlur={e => e.target.style.borderColor = parseFloat(item.cantidad) > 0 ? '#e2e8f0' : '#fca5a5'} />

                {/* Unidad */}
                <select value={item.unidad} onChange={e => updateItem(idx, 'unidad', e.target.value)}
                  style={{ padding: '0.42rem 0.4rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>

                {/* Eliminar */}
                <button onClick={() => eliminarItem(idx)} disabled={items.length === 1}
                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: items.length === 1 ? '#f8fafc' : '#fee2e2', color: items.length === 1 ? '#cbd5e1' : '#ef4444', cursor: items.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  onMouseEnter={e => { if (items.length > 1) e.currentTarget.style.background = '#fecaca'; }}
                  onMouseLeave={e => { if (items.length > 1) e.currentTarget.style.background = '#fee2e2'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}

            <div style={{ marginTop: '0.8rem', padding: '0.7rem 0.9rem', background: C.lighter, borderRadius: '9px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '600' }}>Total ítems</span>
              <span style={{ fontSize: '1rem', fontWeight: '800', color: C.dark }}>{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
            </div>
          </div>

          <NavBtns onPrev={() => setPaso(2)} onNext={() => setPaso(4)} nextLabel="Siguiente: Confirmar" nextDisabled={!puedeAvanzar3} />
        </div>
      )}

      {/* ══════════════ PASO 4 — CONFIRMAR ══════════════ */}
      {paso === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'fadeUp 0.3s ease both' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>

            {/* Resumen general */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem' }}>Resumen del Documento</h3>
              {[
                { label: 'N° Comprobante',   value: transporte.numero_comprobante || '—' },
                { label: 'Fecha Emisión',    value: fmtFecha(transporte.fecha_emision) },
                { label: 'Destinatario',     value: destSel?.razon_social || destSel?.nombres_apellidos },
                { label: 'Identificación',   value: `${destSel?.tipo_identificacion}: ${destSel?.identificacion}` },
                { label: 'Factura origen',   value: facturaSel?.numero_comprobante || '—' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>{item.label}</span>
                  <span style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a', textAlign: 'right', maxWidth: '55%' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Resumen transporte */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem' }}>Datos de Transporte</h3>
              {[
                { label: 'Transportista',     value: transporte.razon_social_transportista },
                { label: 'RUC/ID',            value: transporte.ruc_transportista },
                { label: 'Placa',             value: transporte.placa_vehiculo || '—' },
                { label: 'Inicio',            value: fmtFecha(transporte.fecha_inicio_transporte) },
                { label: 'Fin',               value: fmtFecha(transporte.fecha_fin_transporte) },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>{item.label}</span>
                  <span style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a' }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Rutas */}
            <div style={{ background: C.lighter, borderRadius: '14px', padding: '1.1rem 1.3rem', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Origen</div>
                <div style={{ fontSize: '0.87rem', fontWeight: '700', color: '#0f172a' }}>{transporte.direccion_partida}</div>
              </div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Destino</div>
                <div style={{ fontSize: '0.87rem', fontWeight: '700', color: '#0f172a' }}>{transporte.direccion_destino}</div>
              </div>
            </div>

            {/* Mercadería preview */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.8rem' }}>Mercadería ({items.length} ítems)</h3>
              <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {item.codigo && <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#94a3b8', marginRight: '0.4rem' }}>{item.codigo}</span>}
                      <span style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a' }}>{item.descripcion}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{parseFloat(item.cantidad).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {item.unidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '0.85rem 1.1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <NavBtns
            onPrev={() => setPaso(3)}
            onNext={emitir}
            nextLabel="Emitir Guía de Remisión"
            loading={loading}
          />
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin   { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
};

export default GuiaRemision;
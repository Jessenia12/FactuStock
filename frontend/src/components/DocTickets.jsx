import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

/* ══════════════════════════════════════════════════════════
   DocTickets.jsx
   Tickets de soporte + Solicitudes de recuperación de contraseña
══════════════════════════════════════════════════════════ */

const API     = 'https://factustock-efdi.onrender.com/api';
const API_AUTH= 'https://factustock-efdi.onrender.com/api/auth';
const tok     = () => localStorage.getItem('token');
const hdrs    = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` });

const AZUL  = { p: '#15389a', m: '#2563eb', l: '#dbeafe', ll: '#eff6ff', b: '#93c5fd' };
const VERDE = { p: '#059669', m: '#10b981', l: '#d1fae5', ll: '#ecfdf5', b: '#6ee7b7' };
const ROJO  = { p: '#dc2626', m: '#ef4444', l: '#fecaca', ll: '#fef2f2', b: '#fca5a5' };
const AMBER = { p: '#d97706', m: '#f59e0b', l: '#fde68a', ll: '#fffbeb', b: '#fcd34d' };

const CAT_INFO = {
  error_tecnico:   { label: 'Error técnico',   color: ROJO.p,  bg: ROJO.ll,  icono: '🐛' },
  duda_modulo:     { label: 'Duda de módulo',  color: AZUL.p,  bg: AZUL.ll,  icono: '❓' },
  dato_incorrecto: { label: 'Dato incorrecto', color: AMBER.p, bg: AMBER.ll, icono: '⚠️' },
  sugerencia:      { label: 'Sugerencia',      color: VERDE.p, bg: VERDE.ll, icono: '💡' },
  otro:            { label: 'Otro',            color: '#7c3aed', bg: '#f5f3ff', icono: '📌' },
};
const ESTADO_INFO = {
  pendiente: { label: 'Pendiente', color: AMBER.p, bg: AMBER.ll },
  visto:     { label: 'Visto',     color: AZUL.p,  bg: AZUL.ll  },
  resuelto:  { label: 'Resuelto',  color: VERDE.p, bg: VERDE.ll },
};

const AvatarDoc = ({ n, a, size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: '800', color: 'white', flexShrink: 0 }}>
    {n?.charAt(0)}{a?.charAt(0)}
  </div>
);

/* ── Tour ───────────────────────────────────────────────── */
const TourDocente = ({ titulo, subtitulo, pasos, onCerrar }) => {
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(10,18,40,0.78)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 40px 100px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#1d4ed8)', padding: '1.6rem 1.8rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white' }}>{titulo}</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO DOCENTE</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            {subtitulo}<br /><span style={{ color: '#93c5fd', fontSize: '0.95rem', fontWeight: '600' }}>FactuStock</span>
          </p>
          <button onClick={onCerrar} style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', width: '32px', height: '32px', borderRadius: '9px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', padding: '0.9rem 1.8rem 0' }}>
          {pasos.map((_, i) => <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= paso ? '#2563eb' : '#e2e8f0', transition: 'background 0.3s' }} />)}
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
            {paso > 0 && <button onClick={() => setPaso(p => p-1)} style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.82rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>← Atrás</button>}
            {paso < pasos.length - 1
              ? <button onClick={() => setPaso(p => p+1)} style={{ padding: '0.55rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#15389a,#2563eb)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>Siguiente →</button>
              : <button onClick={onCerrar} style={{ padding: '0.55rem 1.6rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>¡Entendido! 🚀</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Modal Responder ticket ─────────────────────────────── */
const ModalResponder = ({ ticket, onClose, onGuardado }) => {
  const [resp, setResp]           = useState(ticket.respuesta_docente || '');
  const [est, setEst]             = useState(ticket.estado || 'pendiente');
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState('');
  const cat = CAT_INFO[ticket.categoria] || { label: ticket.categoria, icono: '📌', color: '#64748b', bg: '#f1f5f9' };

  const guardar = async () => {
    if (!resp.trim()) { setError('Escribe una respuesta antes de guardar.'); return; }
    setGuardando(true); setError('');
    try {
      const r = await fetch(`${API}/docente/tickets/${ticket.id_ticket}`, { method: 'PATCH', headers: hdrs(), body: JSON.stringify({ respuesta: resp, estado: est }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Error al guardar');
      onGuardado({ ...ticket, respuesta_docente: resp, estado: est });
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '560px', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#2563eb)', padding: '1.4rem 1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Responder ticket #{ticket.id_ticket}</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'white', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.asunto}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '1.4rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.71rem', fontWeight: '800', padding: '0.15rem 0.55rem', borderRadius: '99px', color: cat.color, background: cat.bg }}>{cat.icono} {cat.label}</span>
              {ticket.modulo && <span style={{ fontSize: '0.71rem', color: '#64748b' }}>· {ticket.modulo}</span>}
              <span style={{ fontSize: '0.71rem', fontWeight: '800', padding: '0.15rem 0.55rem', borderRadius: '99px', color: ESTADO_INFO[ticket.estado]?.color || '#64748b', background: ESTADO_INFO[ticket.estado]?.bg || '#f1f5f9' }}>{ticket.estado}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AvatarDoc n={ticket.estudiante?.nombres} a={ticket.estudiante?.apellidos} size={28} />
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>{ticket.estudiante?.nombres} {ticket.estudiante?.apellidos}</span>
              {ticket.estudiante?.curso && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>· {ticket.estudiante.curso} {ticket.estudiante.paralelo}</span>}
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.65 }}>{ticket.descripcion}</p>
          </div>
          {error && <div style={{ padding: '0.6rem 0.85rem', background: ROJO.ll, border: `1.5px solid ${ROJO.b}`, borderRadius: '8px', color: ROJO.p, fontSize: '0.8rem', fontWeight: '700' }}>⚠️ {error}</div>}
          <div>
            <label style={{ fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '0.35rem' }}>Tu respuesta *</label>
            <textarea value={resp} onChange={e => setResp(e.target.value)} rows={4} placeholder="Escribe aquí tu respuesta..."
              style={{ width: '100%', padding: '0.62rem 0.9rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '0.35rem' }}>Estado</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['pendiente', 'visto', 'resuelto'].map(s => (
                <button key={s} onClick={() => setEst(s)} style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: `1.5px solid ${est === s ? AZUL.b : '#e2e8f0'}`, background: est === s ? AZUL.ll : 'white', fontSize: '0.75rem', fontWeight: '700', color: est === s ? AZUL.p : '#64748b', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>{s}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button onClick={onClose} style={{ padding: '0.7rem 1.4rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.84rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding: '0.7rem 1.6rem', borderRadius: '10px', border: 'none', background: guardando ? '#e2e8f0' : `linear-gradient(135deg,${AZUL.p},${AZUL.m})`, color: guardando ? '#94a3b8' : 'white', fontSize: '0.84rem', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {guardando ? 'Guardando...' : '✓ Enviar respuesta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Modal Aprobar recuperación ─────────────────────────── */
const ModalAprobar = ({ solicitud, onClose, onAprobado }) => {
  // paso: 'elegir' | 'resultado'
  const [paso, setPaso]                   = useState('elegir');
  const [resultado, setResultado]         = useState(null);
  const [aprobando, setAprobando]         = useState(false);
  const [enviandoCorreo, setEnviandoCorreo] = useState(false);
  const [correoOk, setCorreoOk]           = useState(null); // null | true | false
  const [copiado, setCopiado]             = useState(false);

  /* Paso 1: aprobar (sin correo) */
  const aprobar = async () => {
    setAprobando(true);
    try {
      const r = await fetch(`${API_AUTH}/aprobar-recuperacion/${solicitud.id_solicitud}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_docente: tok() }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setResultado(data);
        setPaso('resultado');
        onAprobado(); // refresca la lista
      }
    } catch { /* silencioso */ }
    finally { setAprobando(false); }
  };

  /* Paso 1 alternativo: aprobar Y enviar correo en una sola acción */
  const aprobarYEnviar = async () => {
    setAprobando(true);
    try {
      // 1. Aprobar
      const r1 = await fetch(`${API_AUTH}/aprobar-recuperacion/${solicitud.id_solicitud}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_docente: tok() }),
      });
      const data1 = await r1.json();
      if (!r1.ok || !data1.ok) { setAprobando(false); return; }

      setResultado(data1);
      setPaso('resultado');
      onAprobado();

      // 2. Enviar correo desde el endpoint separado
      setEnviandoCorreo(true);
      const r2 = await fetch(`${API_AUTH}/enviar-correo-recuperacion/${solicitud.id_solicitud}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_docente: tok() }),
      });
      const data2 = await r2.json();
      setCorreoOk(r2.ok && data2.ok);
    } catch { setCorreoOk(false); }
    finally { setAprobando(false); setEnviandoCorreo(false); }
  };

  /* Enviar correo después de aprobar (botón secundario en resultado) */
  const enviarCorreo = async () => {
    setEnviandoCorreo(true);
    try {
      const r = await fetch(`${API_AUTH}/enviar-correo-recuperacion/${solicitud.id_solicitud}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_docente: tok() }),
      });
      const data = await r.json();
      setCorreoOk(r.ok && data.ok);
    } catch { setCorreoOk(false); }
    finally { setEnviandoCorreo(false); }
  };

  const copiar = () => {
    if (resultado?.password_temporal) {
      navigator.clipboard.writeText(resultado.password_temporal);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '2rem', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>

        {/* Info estudiante siempre visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
          <AvatarDoc n={solicitud.nombre?.split(' ')[0]} a={solicitud.nombre?.split(' ')[1]} size={42} />
          <div>
            <p style={{ margin: 0, fontWeight: '800', fontSize: '0.95rem', color: '#0f172a' }}>{solicitud.nombre}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
              {solicitud.cedula}
              {solicitud.email && <> · {solicitud.email}</>}
            </p>
          </div>
        </div>

        {/* ── PASO: ELEGIR ── */}
        {paso === 'elegir' && (
          <>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              ¿Cómo quieres entregar la contraseña temporal al estudiante?
            </p>

            {/* Opción: dictar en clase */}
            <button onClick={aprobar} disabled={aprobando}
              style={{ width: '100%', marginBottom: '0.65rem', padding: '0.9rem 1rem', borderRadius: '12px', border: `1.5px solid ${AZUL.b}`, background: AZUL.ll, cursor: aprobando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', opacity: aprobando ? 0.6 : 1 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: AZUL.l, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🗣️</div>
              <div>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '0.84rem', color: AZUL.p }}>Solo generar (dictar en clase)</p>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>Genero la clave y tú se la dices en persona.</p>
              </div>
            </button>

            {/* Opción: generar y enviar correo */}
            <button onClick={aprobarYEnviar} disabled={aprobando || !solicitud.email}
              style={{ width: '100%', marginBottom: '1rem', padding: '0.9rem 1rem', borderRadius: '12px', border: `1.5px solid ${VERDE.b}`, background: VERDE.ll, cursor: (aprobando || !solicitud.email) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left', opacity: !solicitud.email ? 0.45 : aprobando ? 0.6 : 1 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: VERDE.l, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>📧</div>
              <div>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '0.84rem', color: VERDE.p }}>
                  Generar y enviar por correo
                  {!solicitud.email && <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#94a3b8' }}> (sin email registrado)</span>}
                </p>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                  {solicitud.email ? `Se enviará a ${solicitud.email}` : 'El estudiante no tiene correo en su cuenta.'}
                </p>
              </div>
            </button>

            {aprobando && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                {enviandoCorreo ? 'Enviando correo...' : 'Procesando...'}
              </p>
            )}

            <button onClick={onClose} disabled={aprobando}
              style={{ width: '100%', padding: '0.7rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.84rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancelar
            </button>
          </>
        )}

        {/* ── PASO: RESULTADO ── */}
        {paso === 'resultado' && resultado && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: VERDE.ll, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.6rem' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={VERDE.p} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>¡Contraseña generada!</h3>
            </div>

            {/* Caja con contraseña + copiar */}
            <div style={{ background: VERDE.ll, border: `2px solid ${VERDE.b}`, borderRadius: '12px', padding: '1rem', marginBottom: '0.85rem' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Contraseña temporal</p>
              <p style={{ margin: '0 0 0.75rem', fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: '900', color: VERDE.p, letterSpacing: '3px', textAlign: 'center' }}>{resultado.password_temporal}</p>
              <button onClick={copiar}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: `1.5px solid ${copiado ? VERDE.b : '#d1d5db'}`, background: copiado ? '#dcfce7' : 'white', color: copiado ? VERDE.p : '#475569', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}>
                {copiado
                  ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> ¡Copiado!</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar contraseña</>
                }
              </button>
            </div>

            {/* Estado del correo */}
            {correoOk === true && (
              <div style={{ background: VERDE.ll, border: `1px solid ${VERDE.b}`, borderRadius: '8px', padding: '0.6rem 0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={VERDE.p} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <p style={{ margin: 0, fontSize: '0.78rem', color: VERDE.p, fontWeight: '700' }}>Correo enviado a {resultado.email} · Revisa spam si no aparece.</p>
              </div>
            )}
            {correoOk === false && (
              <div style={{ background: ROJO.ll, border: `1px solid ${ROJO.b}`, borderRadius: '8px', padding: '0.6rem 0.85rem', marginBottom: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: ROJO.p, fontWeight: '700' }}>No se pudo enviar el correo. Dicta la contraseña manualmente.</p>
              </div>
            )}

            {/* Botón enviar correo si no se envió aún */}
            {correoOk !== true && solicitud.email && (
              <button onClick={enviarCorreo} disabled={enviandoCorreo}
                style={{ width: '100%', marginBottom: '0.65rem', padding: '0.75rem', borderRadius: '10px', border: `1.5px solid ${VERDE.b}`, background: 'white', color: VERDE.p, fontSize: '0.84rem', fontWeight: '700', cursor: enviandoCorreo ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', transition: 'background 0.2s' }}
                onMouseEnter={e => { if (!enviandoCorreo) e.currentTarget.style.background = VERDE.ll; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {enviandoCorreo ? 'Enviando...' : `Enviar por correo (${solicitud.email})`}
              </button>
            )}

            <div style={{ background: AMBER.ll, border: `1px solid ${AMBER.b}`, borderRadius: '8px', padding: '0.55rem 0.8rem', marginBottom: '0.85rem' }}>
              <p style={{ margin: 0, fontSize: '0.74rem', color: AMBER.p, fontWeight: '700' }}>⚠️ Pídele al estudiante que cambie esta contraseña desde su Perfil al ingresar.</p>
            </div>

            <button onClick={onClose}
              style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${AZUL.p},${AZUL.m})`, color: 'white', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ── Sección Recuperaciones ─────────────────────────────── */
const SeccionRecuperaciones = () => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando]       = useState(false);
  const [procesando, setProcesando]   = useState(null);
  const [modalAprobar, setModalAprobar] = useState(null);
  const [filtro, setFiltro]           = useState('pendiente');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`${API_AUTH}/solicitudes-recuperacion?token=${tok()}`);
      if (r.ok) setSolicitudes(await r.json());
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const rechazar = async (id) => {
    setProcesando(id);
    try {
      await fetch(`${API_AUTH}/rechazar-recuperacion/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_docente: tok() }),
      });
      cargar();
    } catch { /* silencioso */ }
    finally { setProcesando(null); }
  };

  const filtradas  = filtro ? solicitudes.filter(s => s.estado === filtro) : solicitudes;
  const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <p style={{ margin: 0, fontSize: '0.83rem', color: '#64748b' }}>
          Cuando un estudiante olvida su contraseña, aparece aquí.
          {pendientes > 0 && <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', borderRadius: '99px', background: ROJO.ll, color: ROJO.p, fontWeight: '800', fontSize: '0.76rem' }}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
        </p>
        <button onClick={cargar} style={{ padding: '0.4rem 0.85rem', borderRadius: '9px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.77rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Actualizar
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[['pendiente','🕐 Pendientes'],['aprobada','✅ Aprobadas'],['rechazada','❌ Rechazadas'],['','📋 Todas']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFiltro(val)}
            style={{ padding: '0.35rem 0.85rem', borderRadius: '99px', border: '1.5px solid', fontSize: '0.75rem', fontWeight: '700', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', borderColor: filtro === val ? AZUL.m : '#e2e8f0', background: filtro === val ? `linear-gradient(90deg,${AZUL.p},${AZUL.m})` : 'white', color: filtro === val ? 'white' : '#64748b' }}>
            {lbl}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Cargando solicitudes...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '3rem', textAlign: 'center', color: '#94a3b8', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔑</div>
          <p style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem' }}>
            {filtro === 'pendiente' ? 'No hay solicitudes pendientes' : 'No hay solicitudes en esta categoría'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtradas.map(s => (
            <div key={s.id_solicitud} style={{ background: 'white', borderRadius: '14px', padding: '1rem 1.2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: `1px solid ${s.estado === 'pendiente' ? AMBER.b : '#f1f5f9'}`, display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
              <AvatarDoc n={s.nombre?.split(' ')[0]} a={s.nombre?.split(' ')[1]} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.87rem', fontWeight: '800', color: '#0f172a' }}>{s.nombre}</span>
                  <span style={{ fontSize: '0.69rem', fontWeight: '700', padding: '0.1rem 0.45rem', borderRadius: '99px',
                    color: s.estado === 'pendiente' ? AMBER.p : s.estado === 'aprobada' ? VERDE.p : ROJO.p,
                    background: s.estado === 'pendiente' ? AMBER.ll : s.estado === 'aprobada' ? VERDE.ll : ROJO.ll }}>
                    {s.estado === 'pendiente' ? '🕐 Pendiente' : s.estado === 'aprobada' ? '✅ Aprobada' : '❌ Rechazada'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                  Cédula: <strong>{s.cedula}</strong>
                  {s.email && <> · {s.email}</>}
                  {s.curso && <> · {s.curso} {s.paralelo}</>}
                  {s.created_at && <> · {new Date(s.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</>}
                </p>
                {s.motivo && s.motivo !== 'Sin motivo especificado' && (
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#475569', fontStyle: 'italic' }}>"{s.motivo}"</p>
                )}
                {s.estado === 'aprobada' && s.password_temp && (
                  <div style={{ marginTop: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: VERDE.ll, borderRadius: '6px', padding: '0.2rem 0.5rem' }}>
                    <span style={{ fontSize: '0.71rem', color: '#64748b' }}>Contraseña temporal:</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: '800', color: VERDE.p, letterSpacing: '1px' }}>{s.password_temp}</span>
                  </div>
                )}
              </div>

              {s.estado === 'pendiente' && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={() => rechazar(s.id_solicitud)} disabled={procesando === s.id_solicitud}
                    style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: `1.5px solid ${ROJO.b}`, background: 'white', color: ROJO.p, fontSize: '0.76rem', fontWeight: '700', cursor: procesando === s.id_solicitud ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    Rechazar
                  </button>
                  <button onClick={() => setModalAprobar(s)} disabled={procesando === s.id_solicitud}
                    style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: 'none', background: `linear-gradient(135deg,${VERDE.p},${VERDE.m})`, color: 'white', fontSize: '0.76rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(5,150,105,0.3)' }}>
                    ✓ Aprobar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalAprobar && (
        <ModalAprobar
          solicitud={modalAprobar}
          onClose={() => setModalAprobar(null)}
          onAprobado={cargar}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
const DocTickets = () => {
  const isMobile = useIsMobile();
  const [tickets, setTickets]         = useState([]);
  const [vista, setVista]             = useState('tickets');
  const getTourKey = () => {
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); return `doc-tic-tour-${u?.id_usuario || u?.email || 'default'}`; }
    catch { return 'doc-tic-tour-default'; }
  };
  const [tourVisto, setTourVisto]     = useState(() => !!localStorage.getItem(getTourKey()));
  const cerrarTour  = () => { localStorage.setItem(getTourKey(), '1'); setTourVisto(true); };
  const verTutorial = () => { localStorage.removeItem(getTourKey()); setTourVisto(false); };
  const [cargando, setCargando]       = useState(false);
  const [filtro, setFiltro]           = useState('');
  const [modalTicket, setModalTicket] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const url = filtro ? `${API}/docente/tickets?estado=${filtro}` : `${API}/docente/tickets`;
      const r = await fetch(url, { headers: hdrs() });
      if (r.ok) { const d = await r.json(); setTickets(d.tickets || []); }
    } catch { /* silencioso */ } finally { setCargando(false); }
  }, [filtro]);

  useEffect(() => { if (vista === 'tickets') cargar(); }, [cargar, vista]);

  const pendientes = tickets.filter(t => t.estado === 'pendiente').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '1rem 0.85rem' : '1.8rem 2rem', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>

      {!tourVisto && (
        <TourDocente
          titulo="TICKETS DE SOPORTE"
          subtitulo="Consultas de estudiantes"
          pasos={[
            { emoji: '📨', titulo: '¿Qué son los tickets?', texto: 'Son las consultas que los estudiantes envían desde "Ayuda y Soporte". Cada ticket tiene una categoría, el módulo afectado y una descripción del problema.' },
            { emoji: '✏️', titulo: 'Responder un ticket', texto: 'Haz clic en "Responder" para escribir tu respuesta. El estudiante la verá en "Mis consultas" dentro de Ayuda y Soporte.' },
            { emoji: '🔑', titulo: 'Recuperación de contraseñas', texto: 'En la pestaña "Recuperaciones" verás cuando un estudiante olvidó su contraseña. Puedes generar una clave temporal y dictarla en clase o enviarla directo a su correo.' },
            { emoji: '🏷️', titulo: 'Estados', texto: 'Pendiente = sin respuesta. Visto = lo revisaste. Resuelto = respondiste y el estudiante puede continuar.' },
          ]}
          onCerrar={cerrarTour}
        />
      )}

      <div style={{ background: 'linear-gradient(90deg,#fffbeb,#fef3c7)', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ fontSize: '0.95rem' }}>👨‍🏫</span>
        <p style={{ margin: 0, fontSize: '0.77rem', color: '#92400e', fontWeight: '700', flex: 1 }}>Panel Docente — Revisa las consultas y solicitudes de recuperación de tus estudiantes.</p>
        <button onClick={verTutorial} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: '1.5px solid #fbbf24', background: 'white', color: '#92400e', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>📖 Ver tutorial</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>Soporte y Recuperaciones</h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: '#64748b' }}>
            {vista === 'tickets'
              ? `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}${pendientes > 0 ? ` · ${pendientes} pendiente${pendientes !== 1 ? 's' : ''}` : ''}`
              : 'Solicitudes de recuperación de contraseña de estudiantes'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', background: '#f1f5f9', borderRadius: '12px', padding: '3px', width: 'fit-content' }}>
        {[['tickets','📨 Tickets de soporte'],['recuperaciones','🔑 Recuperaciones']].map(([k, lbl]) => (
          <button key={k} onClick={() => setVista(k)}
            style={{ padding: '0.5rem 1.1rem', borderRadius: '9px', border: 'none', background: vista === k ? 'white' : 'transparent', color: vista === k ? '#0f172a' : '#64748b', fontWeight: vista === k ? '800' : '600', fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: vista === k ? '0 1px 6px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── TICKETS ── */}
      {vista === 'tickets' && (
        <>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
            {['', 'pendiente', 'visto', 'resuelto'].map(f => (
              <button key={f} onClick={() => setFiltro(f)}
                style={{ padding: '0.4rem 0.85rem', borderRadius: '99px', border: '1.5px solid', fontSize: '0.76rem', fontWeight: '700', fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s', borderColor: filtro === f ? AZUL.m : '#e2e8f0', background: filtro === f ? `linear-gradient(90deg,${AZUL.p},${AZUL.m})` : 'white', color: filtro === f ? 'white' : '#64748b' }}>
                {f === '' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Cargando tickets...</div>
          ) : tickets.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '16px', padding: '4rem', textAlign: 'center', color: '#94a3b8', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
              <p style={{ margin: 0, fontWeight: '700' }}>No hay tickets {filtro ? `con estado "${filtro}"` : ''}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {tickets.map(t => {
                const cat = CAT_INFO[t.categoria] || { label: t.categoria, icono: '📌', color: '#64748b', bg: '#f1f5f9' };
                const est = ESTADO_INFO[t.estado] || { label: t.estado, color: '#64748b', bg: '#f1f5f9' };
                return (
                  <div key={t.id_ticket} style={{ background: 'white', borderRadius: '14px', padding: '1.1rem 1.3rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: `1px solid ${t.estado === 'pendiente' ? AMBER.b : '#f1f5f9'}`, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <AvatarDoc n={t.estudiante?.nombres} a={t.estudiante?.apellidos} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>{t.asunto}</span>
                        <span style={{ fontSize: '0.69rem', fontWeight: '800', padding: '0.12rem 0.5rem', borderRadius: '99px', color: cat.color, background: cat.bg }}>{cat.icono} {cat.label}</span>
                        <span style={{ fontSize: '0.69rem', fontWeight: '800', padding: '0.12rem 0.5rem', borderRadius: '99px', color: est.color, background: est.bg }}>{est.label}</span>
                      </div>
                      <p style={{ margin: '0 0 0.35rem', fontSize: '0.79rem', color: '#64748b' }}>
                        <strong style={{ color: '#334155' }}>{t.estudiante?.nombres} {t.estudiante?.apellidos}</strong>
                        {t.estudiante?.curso && <> · {t.estudiante.curso} {t.estudiante.paralelo}</>}
                        {t.modulo && <> · {t.modulo}</>}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.79rem', color: '#475569', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.descripcion}</p>
                      {t.respuesta_docente && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: AZUL.ll, borderRadius: '8px', borderLeft: `3px solid ${AZUL.m}` }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: AZUL.p, fontWeight: '700' }}>Tu respuesta: <span style={{ fontWeight: '500', color: '#334155' }}>{t.respuesta_docente}</span></p>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <button onClick={() => setModalTicket(t)}
                        style={{ padding: '0.4rem 0.85rem', borderRadius: '8px', border: `1.5px solid ${AZUL.b}`, background: AZUL.ll, color: AZUL.p, fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        {t.respuesta_docente ? 'Editar respuesta' : 'Responder'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── RECUPERACIONES ── */}
      {vista === 'recuperaciones' && <SeccionRecuperaciones />}

      {modalTicket && (
        <ModalResponder
          ticket={modalTicket}
          onClose={() => setModalTicket(null)}
          onGuardado={(updated) => { setTickets(prev => prev.map(t => t.id_ticket === updated.id_ticket ? updated : t)); setModalTicket(null); }}
        />
      )}

      <style>{`
        @keyframes tourFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tourPopIn { from { opacity: 0; transform: scale(0.92) translateY(16px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
};

export default DocTickets;
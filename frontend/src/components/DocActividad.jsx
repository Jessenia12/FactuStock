import React, { useState, useEffect, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════
   DocActividad.jsx
   Actividad del curso y estadísticas para el docente
══════════════════════════════════════════════════════════ */

const API = 'https://factustock-efdi.onrender.com/api';
const tok = () => localStorage.getItem('token');
const hdrs = () => ({ Authorization: `Bearer ${tok()}` });

const AZUL  = { p: '#15389a', m: '#2563eb', l: '#dbeafe', ll: '#eff6ff', b: '#93c5fd' };
const VERDE = { p: '#059669', m: '#10b981', l: '#d1fae5', ll: '#ecfdf5', b: '#6ee7b7' };
const ROJO  = { p: '#dc2626', m: '#ef4444', l: '#fecaca', ll: '#fef2f2', b: '#fca5a5' };
const AMBER = { p: '#d97706', m: '#f59e0b', l: '#fde68a', ll: '#fffbeb', b: '#fcd34d' };

const AvatarDoc = ({ n, a, size = 34 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: '800', color: 'white', flexShrink: 0 }}>
    {n?.charAt(0)}{a?.charAt(0)}
  </div>
);

const StatCard = ({ label, value, sub, color, bg, icono }) => (
  <div style={{ background: 'white', borderRadius: '16px', padding: '1.1rem 1.3rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>{icono}</div>
    <div>
      <p style={{ margin: 0, fontSize: '0.69rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
      <p style={{ margin: '0.1rem 0 0', fontSize: '1.4rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.3px' }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: '0.72rem', color, fontWeight: '700' }}>{sub}</p>}
    </div>
  </div>
);


/* ── Tour educativo ─────────────────────────────────────── */
const TourDocente = ({ titulo, subtitulo, pasos, onCerrar }) => {
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(10,18,40,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'tourFadeIn 0.25s ease' }}>
      <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: '0 40px 100px rgba(0,0,0,0.4)', overflow: 'hidden', animation: 'tourPopIn 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#1d4ed8)', padding: '1.6rem 1.8rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '30px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(96,165,250,0.12)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>{titulo}</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO DOCENTE</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            {subtitulo}<br /><span style={{ color: '#93c5fd', fontSize: '0.95rem', fontWeight: '600' }}>FactuStock</span>
          </p>
          <button onClick={onCerrar} style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', width: '32px', height: '32px', borderRadius: '9px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.28)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
              ? <button onClick={() => setPaso(p => p+1)} style={{ padding: '0.55rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#15389a,#2563eb)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(15,31,75,0.35)' }}>Siguiente →</button>
              : <button onClick={onCerrar} style={{ padding: '0.55rem 1.6rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>¡Entendido! 🚀</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

const DocActividad = () => {
  const [estudiantes, setEstudiantes] = useState([]);
  const getTourKey = () => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return `doc-act-tour-${u?.id_usuario || u?.email || 'default'}`;
    } catch { return 'doc-act-tour-default'; }
  };
  const [tourVisto, setTourVisto] = useState(() => !!localStorage.getItem(getTourKey()));
  const cerrarTour = () => { localStorage.setItem(getTourKey(), '1'); setTourVisto(true); };
  const verTutorial = () => { localStorage.removeItem(getTourKey()); setTourVisto(false); };

  const [resumen, setResumen]         = useState(null);
  const [cargando, setCargando]       = useState(false);
  const [vista, setVista]             = useState('ranking'); // 'ranking' | 'alertas'

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [resR, estR] = await Promise.all([
        fetch(`${API}/docente/resumen`, { headers: hdrs() }),
        fetch(`${API}/docente/estudiantes`, { headers: hdrs() }),
      ]);
      if (resR.ok) setResumen(await resR.json());
      if (estR.ok) { const d = await estR.json(); setEstudiantes(d.estudiantes || []); }
    } catch { /* silencioso */ } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const porFacturas    = [...estudiantes].sort((a, b) => b.stats.total_facturas - a.stats.total_facturas);
  const porFacturado   = [...estudiantes].sort((a, b) => b.stats.total_facturado - a.stats.total_facturado);
  const sinActividad   = estudiantes.filter(e => e.stats.total_facturas === 0 && e.estado);
  const conTickets     = estudiantes.filter(e => e.stats.tickets_pendientes > 0);
  const maxFacturas    = porFacturas[0]?.stats.total_facturas || 1;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1.8rem 2rem', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>

      {/* Tour */}
      {!tourVisto && (
        <TourDocente
          titulo="ACTIVIDAD DEL CURSO"
          subtitulo="Seguimiento de estudiantes"
          pasos={[
            { emoji: '📊', titulo: '¿Qué muestra este módulo?', texto: 'Un resumen de la actividad de facturación de cada estudiante: cuántas facturas han creado, cuánto han facturado en total y quiénes necesitan atención.' },
            { emoji: '🏆', titulo: 'Vista Ranking', texto: 'Ordena a los estudiantes por número de facturas creadas y por monto total facturado. La barra de progreso muestra el avance relativo respecto al más activo del grupo.' },
            { emoji: '🔔', titulo: 'Vista Alertas', texto: 'Muestra dos listas importantes: estudiantes sin ninguna factura (0 actividad) y estudiantes con tickets pendientes que necesitan tu respuesta.' },
            { emoji: '📈', titulo: 'Indicadores clave', texto: 'Las tarjetas superiores muestran totales del curso: estudiantes activos, facturas emitidas, monto facturado y cuántos están sin actividad.' },
          ]}
          onCerrar={cerrarTour}
        />
      )}
      {/* Barra amarilla */}
      <div style={{ background: 'linear-gradient(90deg,#fffbeb,#fef3c7)', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ fontSize: '0.95rem' }}>👨‍🏫</span>
        <p style={{ margin: 0, fontSize: '0.77rem', color: '#92400e', fontWeight: '700', flex: 1 }}>Panel Docente — Monitorea el avance y la participación de tus estudiantes.</p>
        <button onClick={verTutorial} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: '1.5px solid #fbbf24', background: 'white', color: '#92400e', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>📖 Ver tutorial</button>
      </div>
      {/* Header */}
      <div style={{ marginBottom: '1.4rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>Actividad del Curso</h1>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: '#64748b' }}>Seguimiento de facturación y participación de los estudiantes</p>
      </div>

      {/* Stats globales */}
      {resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard label="Estudiantes" value={resumen.total_estudiantes} sub={`${resumen.estudiantes_activos} activos`} color={AZUL.p} bg={AZUL.ll} icono="👥" />
          <StatCard label="Total facturas" value={resumen.total_facturas} sub="Entre todos" color={VERDE.p} bg={VERDE.ll} icono="🧾" />
          <StatCard label="Total facturado" value={`$${(resumen.total_facturado || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`} sub="Solo finalizadas" color={AMBER.p} bg={AMBER.ll} icono="💰" />
          <StatCard label="Sin actividad" value={sinActividad.length} sub="0 facturas" color={sinActividad.length > 0 ? ROJO.p : VERDE.p} bg={sinActividad.length > 0 ? ROJO.ll : VERDE.ll} icono={sinActividad.length > 0 ? '⚠️' : '✅'} />
        </div>
      )}

      {/* Tabs vista */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', background: '#f1f5f9', borderRadius: '12px', padding: '0.3rem', width: 'fit-content' }}>
        {[{ id: 'ranking', label: '🏆 Ranking' }, { id: 'alertas', label: '🔔 Alertas' }].map(t => (
          <button key={t.id} onClick={() => setVista(t.id)}
            style={{ padding: '0.5rem 1.2rem', borderRadius: '9px', border: 'none', background: vista === t.id ? 'white' : 'transparent', color: vista === t.id ? '#0f172a' : '#64748b', fontWeight: vista === t.id ? '800' : '600', fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: vista === t.id ? '0 1px 6px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.18s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Cargando actividad...</div>
      ) : vista === 'ranking' ? (
        /* ── Vista ranking ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
          {/* Por facturas */}
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.2rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: AZUL.m }} />
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>Más activos (por facturas)</h3>
            </div>
            <div style={{ padding: '0.75rem 1.2rem' }}>
              {porFacturas.slice(0, 8).map((e, i) => {
                const pct = (e.stats.total_facturas / maxFacturas) * 100;
                return (
                  <div key={e.id_usuario} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0', borderBottom: i < Math.min(porFacturas.length, 8) - 1 ? '1px solid #f8fafc' : 'none' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : AZUL.ll, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '900', color: i < 3 ? 'white' : AZUL.p, flexShrink: 0 }}>{i + 1}</div>
                    <AvatarDoc n={e.nombres} a={e.apellidos} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombres} {e.apellidos}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <div style={{ flex: 1, height: '4px', borderRadius: '99px', background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${AZUL.p},${AZUL.m})`, borderRadius: '99px' }} />
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: AZUL.p, flexShrink: 0 }}>{e.stats.total_facturas}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {porFacturas.length === 0 && <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', padding: '1.5rem 0' }}>Sin datos aún</p>}
            </div>
          </div>

          {/* Por facturado */}
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.2rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: VERDE.m }} />
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>Mayor monto facturado</h3>
            </div>
            <div style={{ padding: '0.75rem 1.2rem' }}>
              {porFacturado.slice(0, 8).map((e, i) => (
                <div key={e.id_usuario} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0', borderBottom: i < Math.min(porFacturado.length, 8) - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : VERDE.ll, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '900', color: i < 3 ? 'white' : VERDE.p, flexShrink: 0 }}>{i + 1}</div>
                  <AvatarDoc n={e.nombres} a={e.apellidos} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombres} {e.apellidos}</p>
                    {e.curso && <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8' }}>{e.curso} {e.paralelo}</p>}
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: VERDE.p, flexShrink: 0 }}>${(e.stats.total_facturado || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              {porFacturado.length === 0 && <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center', padding: '1.5rem 0' }}>Sin datos aún</p>}
            </div>
          </div>
        </div>
      ) : (
        /* ── Vista alertas ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
          {/* Sin actividad */}
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.2rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: ROJO.m }} />
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>⚠️ Sin actividad ({sinActividad.length})</h3>
            </div>
            <div style={{ padding: '0.75rem 1.2rem' }}>
              {sinActividad.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.82rem', color: VERDE.p, fontWeight: '700', textAlign: 'center', padding: '1.5rem 0' }}>✓ Todos han facturado</p>
              ) : sinActividad.map((e, i) => (
                <div key={e.id_usuario} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0', borderBottom: i < sinActividad.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <AvatarDoc n={e.nombres} a={e.apellidos} size={30} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' }}>{e.nombres} {e.apellidos}</p>
                    {e.curso && <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8' }}>{e.curso} {e.paralelo}</p>}
                  </div>
                  <span style={{ fontSize: '0.71rem', fontWeight: '800', padding: '0.14rem 0.55rem', borderRadius: '99px', color: ROJO.p, background: ROJO.ll }}>0 facturas</span>
                </div>
              ))}
            </div>
          </div>

          {/* Con tickets pendientes */}
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.2rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: AMBER.m }} />
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#0f172a' }}>🔔 Necesitan atención ({conTickets.length})</h3>
            </div>
            <div style={{ padding: '0.75rem 1.2rem' }}>
              {conTickets.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.82rem', color: VERDE.p, fontWeight: '700', textAlign: 'center', padding: '1.5rem 0' }}>✓ Sin tickets pendientes</p>
              ) : conTickets.map((e, i) => (
                <div key={e.id_usuario} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.55rem 0', borderBottom: i < conTickets.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                  <AvatarDoc n={e.nombres} a={e.apellidos} size={30} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' }}>{e.nombres} {e.apellidos}</p>
                    {e.curso && <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8' }}>{e.curso} {e.paralelo}</p>}
                  </div>
                  <span style={{ fontSize: '0.71rem', fontWeight: '800', padding: '0.14rem 0.55rem', borderRadius: '99px', color: AMBER.p, background: AMBER.ll }}>{e.stats.tickets_pendientes} pendiente{e.stats.tickets_pendientes !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocActividad;
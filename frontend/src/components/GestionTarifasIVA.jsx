import React, { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

/* ══════════════════════════════════════════════════════════
   GestionTarifasIVA.jsx
   Panel del DOCENTE para gestionar tarifas de IVA.
   Se integra dentro de ConfiguracionNegocio o como sección
   independiente en el sidebar del docente.
══════════════════════════════════════════════════════════ */

const API = 'https://factustock-efdi.onrender.com/api';
const hdrs = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const AZUL  = { p: '#15389a', m: '#2563eb', ll: '#eff6ff', b: '#93c5fd' };
const VERDE = { p: '#059669', m: '#10b981', ll: '#ecfdf5', b: '#6ee7b7' };
const ROJO  = { p: '#dc2626', m: '#ef4444', ll: '#fef2f2', b: '#fca5a5' };
const AMBER = { p: '#d97706', m: '#f59e0b', ll: '#fffbeb', b: '#fcd34d' };
const GRAY  = { p: '#64748b', ll: '#f8fafc', b: '#e2e8f0' };

const lbl = {
  fontSize: '0.71rem', fontWeight: '800', color: '#475569',
  textTransform: 'uppercase', letterSpacing: '0.4px',
  display: 'block', marginBottom: '0.35rem',
};
const inp = (extra = {}) => ({
  width: '100%', padding: '0.62rem 0.9rem',
  border: '1.5px solid #e2e8f0', borderRadius: '10px',
  fontSize: '0.85rem', color: '#1e293b', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: 'white',
  ...extra,
});

/* ── Chip de porcentaje ─────────────────────────────────── */
const PctChip = ({ pct, activa }) => {
  const num = parseFloat(pct);
  const color = !activa ? GRAY
    : num === 0   ? VERDE
    : num <= 5    ? { p: '#0891b2', m: '#06b6d4', ll: '#ecfeff', b: '#67e8f9' }
    : num <= 12   ? AMBER
    : AZUL;
  return (
    <span style={{
      padding: '0.25rem 0.75rem', borderRadius: '99px',
      fontSize: '1rem', fontWeight: '900',
      color: activa ? color.p : '#94a3b8',
      background: activa ? color.ll : '#f1f5f9',
      border: `1.5px solid ${activa ? color.b : '#e2e8f0'}`,
      minWidth: '56px', textAlign: 'center', display: 'inline-block',
    }}>
      {num % 1 === 0 ? `${num}%` : `${num}%`}
    </span>
  );
};

/* ── Modal crear tarifa ─────────────────────────────────── */
const ModalCrear = ({ onClose, onCreada }) => {
  const [form, setForm] = useState({ porcentaje: '', descripcion: '', nota: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleGuardar = async () => {
    if (!form.porcentaje || isNaN(parseFloat(form.porcentaje))) {
      setError('El porcentaje es obligatorio y debe ser un número.'); return;
    }
    if (!form.descripcion.trim()) {
      setError('La descripción es obligatoria.'); return;
    }
    setGuardando(true); setError('');
    try {
      const pct = parseFloat(form.porcentaje);
      const codigo = `IVA_${String(pct).replace('.', '_')}`;
      const etiqueta = `${pct}%`;
      const r = await fetch(`${API}/tarifas-iva/`, {
        method: 'POST', headers: hdrs(),
        body: JSON.stringify({ codigo, porcentaje: pct, descripcion: form.descripcion, etiqueta, nota: form.nota }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Error al crear tarifa');
      onCreada(d);
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#2563eb)', padding: '1.4rem 1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Nueva tarifa</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'white' }}>Agregar tarifa de IVA</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '1.4rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ padding: '0.7rem 1rem', background: ROJO.ll, border: `1.5px solid ${ROJO.b}`, borderRadius: '10px', color: ROJO.p, fontSize: '0.82rem', fontWeight: '700' }}>⚠️ {error}</div>}

          <div>
            <label style={lbl}>Porcentaje IVA *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="number" min="0" max="100" step="0.01"
                value={form.porcentaje}
                onChange={e => set('porcentaje', e.target.value)}
                placeholder="Ej: 17"
                style={{ ...inp(), width: '120px' }}
              />
              <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#0f172a' }}>%</span>
              {form.porcentaje && !isNaN(parseFloat(form.porcentaje)) && (
                <PctChip pct={form.porcentaje} activa={true} />
              )}
            </div>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
              Ingresa el porcentaje exacto según la resolución del SRI (ej: 15, 5, 0, 17).
            </p>
          </div>

          <div>
            <label style={lbl}>Descripción *</label>
            <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Ej: IVA 17% — Nueva tarifa general 2026"
              style={inp()} />
          </div>

          <div>
            <label style={lbl}>Nota educativa (opcional)</label>
            <textarea value={form.nota} onChange={e => set('nota', e.target.value)}
              rows={3} placeholder="Explica a qué productos aplica esta tarifa, la fecha de vigencia, etc."
              style={{ ...inp(), resize: 'vertical', lineHeight: 1.6 }} />
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
              Esta nota la verán los estudiantes al seleccionar la tarifa.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
            <button onClick={onClose} style={{ padding: '0.7rem 1.4rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.84rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            <button onClick={handleGuardar} disabled={guardando}
              style={{ padding: '0.7rem 1.6rem', borderRadius: '10px', border: 'none', background: guardando ? '#e2e8f0' : `linear-gradient(135deg,${AZUL.p},${AZUL.m})`, color: guardando ? '#94a3b8' : 'white', fontSize: '0.84rem', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: guardando ? 'none' : '0 4px 14px rgba(21,56,154,0.3)' }}>
              {guardando ? 'Creando...' : '✓ Crear tarifa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
const GestionTarifasIVA = () => {
  const isMobile = useIsMobile();
  const [tarifas, setTarifas]       = useState([]);
  const [cargando, setCargando]     = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [accionando, setAccionando] = useState(null); // id_tarifa en proceso
  const [exito, setExito]           = useState('');

  const mostrarExito = msg => { setExito(msg); setTimeout(() => setExito(''), 3000); };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`${API}/tarifas-iva/?solo_activas=false`, { headers: hdrs() });
      if (r.ok) setTarifas(await r.json());
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActiva = async (t) => {
    setAccionando(t.id_tarifa);
    try {
      const r = await fetch(`${API}/tarifas-iva/${t.id_tarifa}`, {
        method: 'PATCH', headers: hdrs(),
        body: JSON.stringify({ activa: !t.activa }),
      });
      if (r.ok) {
        setTarifas(prev => prev.map(x => x.id_tarifa === t.id_tarifa ? { ...x, activa: !x.activa } : x));
        mostrarExito(`Tarifa ${t.etiqueta} ${!t.activa ? 'activada' : 'desactivada'}.`);
      }
    } catch { /* silencioso */ }
    finally { setAccionando(null); }
  };

  const setDefault = async (t) => {
    if (t.es_default) return;
    setAccionando(t.id_tarifa);
    try {
      const r = await fetch(`${API}/tarifas-iva/${t.id_tarifa}`, {
        method: 'PATCH', headers: hdrs(),
        body: JSON.stringify({ es_default: true, activa: true }),
      });
      if (r.ok) {
        setTarifas(prev => prev.map(x => ({
          ...x,
          es_default: x.id_tarifa === t.id_tarifa,
          activa: x.id_tarifa === t.id_tarifa ? true : x.activa,
        })));
        mostrarExito(`${t.etiqueta} es ahora la tarifa por defecto.`);
      }
    } catch { /* silencioso */ }
    finally { setAccionando(null); }
  };

  const activas   = tarifas.filter(t => t.activa);
  const inactivas = tarifas.filter(t => !t.activa);

  return (
    <div style={{ fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.2rem' }}>
        <button onClick={() => setModalCrear(true)}
          style={{ padding: '0.6rem 1.2rem', borderRadius: '12px', border: 'none', background: `linear-gradient(90deg,${AZUL.p},${AZUL.m})`, color: 'white', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 14px rgba(21,56,154,0.3)', whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva tarifa
        </button>
      </div>

      {exito && (
        <div style={{ padding: '0.65rem 1rem', background: VERDE.ll, border: `1.5px solid ${VERDE.b}`, borderRadius: '10px', color: VERDE.p, fontSize: '0.82rem', fontWeight: '700', marginBottom: '1rem' }}>
          ✓ {exito}
        </div>
      )}

      {/* Info educativa */}
      <div style={{ background: AMBER.ll, border: `1.5px solid ${AMBER.b}`, borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.2rem', display: 'flex', gap: '0.65rem' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', lineHeight: 1.6 }}>
          <strong>¿Cambió el IVA?</strong> Crea una nueva tarifa con el porcentaje actualizado y márcala como <em>por defecto</em>. Las facturas antiguas mantienen su IVA original. No elimines las tarifas históricas — desactívalas para conservar el historial educativo.
        </p>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Cargando tarifas...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

          {/* Tarifas activas */}
          {activas.map(t => (
            <div key={t.id_tarifa} style={{
              background: 'white', borderRadius: '14px', padding: '1rem 1.2rem',
              border: `1.5px solid ${t.es_default ? AZUL.b : '#f1f5f9'}`,
              boxShadow: t.es_default ? '0 0 0 3px rgba(37,99,235,0.08)' : '0 2px 10px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
            }}>
              <PctChip pct={t.porcentaje} activa={true} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: '800', color: '#0f172a' }}>{t.descripcion}</p>
                  {t.es_default && (
                    <span style={{ fontSize: '0.68rem', fontWeight: '800', padding: '0.12rem 0.5rem', borderRadius: '99px', color: AZUL.p, background: AZUL.ll, border: `1px solid ${AZUL.b}` }}>
                      ⭐ Por defecto
                    </span>
                  )}
                </div>
                {t.nota && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>{t.nota}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                {!t.es_default && (
                  <button
                    onClick={() => setDefault(t)}
                    disabled={accionando === t.id_tarifa}
                    title="Marcar como tarifa por defecto"
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: `1.5px solid ${AZUL.b}`, background: AZUL.ll, color: AZUL.p, fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    ⭐ Usar por defecto
                  </button>
                )}
                <button
                  onClick={() => toggleActiva(t)}
                  disabled={t.es_default || accionando === t.id_tarifa}
                  title={t.es_default ? 'No puedes desactivar la tarifa por defecto' : 'Desactivar tarifa'}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: `1.5px solid ${AMBER.b}`, background: AMBER.ll, color: AMBER.p, fontSize: '0.72rem', fontWeight: '700', cursor: t.es_default ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: t.es_default ? 0.5 : 1 }}>
                  {accionando === t.id_tarifa ? '...' : 'Desactivar'}
                </button>
              </div>
            </div>
          ))}

          {/* Tarifas inactivas */}
          {inactivas.length > 0 && (
            <>
              <p style={{ margin: '0.8rem 0 0.2rem', fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Tarifas inactivas (historial)
              </p>
              {inactivas.map(t => (
                <div key={t.id_tarifa} style={{
                  background: '#fafafa', borderRadius: '14px', padding: '0.85rem 1.2rem',
                  border: '1.5px solid #f1f5f9',
                  display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.7,
                }}>
                  <PctChip pct={t.porcentaje} activa={false} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: '700', color: '#64748b' }}>{t.descripcion}</p>
                    {t.nota && <p style={{ margin: '0.2rem 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>{t.nota}</p>}
                  </div>
                  <button
                    onClick={() => toggleActiva(t)}
                    disabled={accionando === t.id_tarifa}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: `1.5px solid ${VERDE.b}`, background: VERDE.ll, color: VERDE.p, fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {accionando === t.id_tarifa ? '...' : 'Reactivar'}
                  </button>
                </div>
              ))}
            </>
          )}

          {tarifas.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: 'white', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>No hay tarifas configuradas.</p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem' }}>Ejecuta el script <code>seed_tarifas.py</code> para cargar las tarifas base.</p>
            </div>
          )}
        </div>
      )}

      {modalCrear && (
        <ModalCrear
          onClose={() => setModalCrear(false)}
          onCreada={nueva => { setTarifas(prev => [...prev, nueva]); setModalCrear(false); mostrarExito(`Tarifa ${nueva.etiqueta} creada correctamente.`); }}
        />
      )}
    </div>
  );
};

export default GestionTarifasIVA;
import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useIsMobile } from '../hooks/useIsMobile';

/* ══════════════════════════════════════════════════════════
   DocEstudiantes.jsx — con Tabs Activos/Inactivos + Paginación
══════════════════════════════════════════════════════════ */

const API = 'https://factustock-efdi.onrender.com/api';
const tok = () => localStorage.getItem('token');
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` });

const AZUL  = { p: '#15389a', m: '#2563eb', l: '#dbeafe', ll: '#eff6ff', b: '#93c5fd' };
const VERDE = { p: '#059669', m: '#10b981', l: '#d1fae5', ll: '#ecfdf5', b: '#6ee7b7' };
const ROJO  = { p: '#dc2626', m: '#ef4444', l: '#fecaca', ll: '#fef2f2', b: '#fca5a5' };
const AMBER = { p: '#d97706', m: '#f59e0b', l: '#fde68a', ll: '#fffbeb', b: '#fcd34d' };
const MORADO= { p: '#7c3aed', l: '#ede9fe', b: '#c4b5fd' };

const PAGE_SIZE = 8; // filas por página

const MODULOS_INFO = {
  inicio:                 { label: 'Inicio',               icono: '🏠' },
  comprobantes_emitidos:  { label: 'Comp. Emitidos',       icono: '🧾' },
  comprobantes_recibidos: { label: 'Comp. Recibidos',      icono: '📥' },
  pendientes_emitir:      { label: 'Pendientes Emitir',    icono: '⏳' },
  clientes:               { label: 'Clientes',             icono: '👥' },
  productos:              { label: 'Productos',            icono: '📦' },
  reportes:               { label: 'Reportes',             icono: '📊' },
  generar_ats:            { label: 'Generar ATS',          icono: '📋' },
  configuracion:          { label: 'Configuración',        icono: '⚙️' },
  ayuda_soporte:          { label: 'Ayuda y Soporte',      icono: '❓' },
};

const lbl = { fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '0.35rem' };
const inp = () => ({ width: '100%', padding: '0.62rem 0.9rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.85rem', color: '#1e293b', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'white' });

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
    <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
  </svg>
);

const AvatarDoc = ({ n, a, size = 34 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#60a5fa,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: '800', color: 'white', flexShrink: 0 }}>
    {n?.charAt(0)}{a?.charAt(0)}
  </div>
);

/* ── Paginación ─────────────────────────────────────────── */
const PaginBtn = ({ children, onClick, disabled, active }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      minWidth: '32px', height: '32px', padding: '0 6px', borderRadius: '8px',
      border: '1.5px solid', fontSize: '0.78rem', fontWeight: '700',
      fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
      borderColor: active ? '#15389a' : '#e2e8f0',
      background: active ? 'linear-gradient(135deg,#15389a,#2563eb)' : disabled ? '#f8fafc' : 'white',
      color: active ? 'white' : disabled ? '#cbd5e1' : '#64748b',
      boxShadow: active ? '0 2px 8px rgba(21,56,154,0.35)' : 'none',
    }}>
    {children}
  </button>
);

const Paginacion = ({ total, pagina, setPagina, pageSize }) => {
  const totalPags = Math.ceil(total / pageSize);
  if (totalPags <= 1) return null;
  const desde = (pagina - 1) * pageSize + 1;
  const hasta  = Math.min(pagina * pageSize, total);

  // Ventana deslizante de máx 5 páginas
  const inicio = Math.max(1, Math.min(pagina - 2, totalPags - 4));
  const fin    = Math.min(totalPags, inicio + 4);
  const paginas = Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.2rem', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
      <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>
        Mostrando {Math.min(desde, total)}–{hasta} de {total}
      </span>
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <PaginBtn onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </PaginBtn>
        {paginas.map(p => (
          <PaginBtn key={p} onClick={() => setPagina(p)} active={pagina === p}>{p}</PaginBtn>
        ))}
        <PaginBtn onClick={() => setPagina(p => Math.min(totalPags, p + 1))} disabled={pagina === totalPags}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </PaginBtn>
      </div>
    </div>
  );
};

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

/* ── Modal Crear/Editar ─────────────────────────────────── */
const ModalEstudiante = ({ estudiante, onClose, onGuardado }) => {
  const esEdicion = !!estudiante?.id_usuario;
  const [form, setForm] = useState({
    cedula: estudiante?.cedula || '', nombres: estudiante?.nombres || '',
    apellidos: estudiante?.apellidos || '', email: estudiante?.email || '',
    password: '', curso: estudiante?.curso || '', paralelo: estudiante?.paralelo || '',
    modulos: estudiante?.modulos || Object.keys(MODULOS_INFO),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleMod = mod => set('modulos', form.modulos.includes(mod) ? form.modulos.filter(m => m !== mod) : [...form.modulos, mod]);

  const handleGuardar = async () => {
    setError('');
    if (!form.cedula || !form.nombres || !form.apellidos || !form.email) { setError('Cédula, nombres, apellidos y email son obligatorios.'); return; }
    if (!esEdicion && !form.password) { setError('La contraseña es obligatoria al crear un estudiante.'); return; }
    setGuardando(true);
    try {
      const url = esEdicion ? `${API}/docente/estudiantes/${estudiante.id_usuario}` : `${API}/docente/estudiantes`;
      const method = esEdicion ? 'PATCH' : 'POST';
      const body = esEdicion
        ? { nombres: form.nombres, apellidos: form.apellidos, email: form.email, curso: form.curso, paralelo: form.paralelo, ...(form.password ? { password: form.password } : {}) }
        : { cedula: form.cedula, nombres: form.nombres, apellidos: form.apellidos, email: form.email, password: form.password, curso: form.curso, paralelo: form.paralelo, modulos: form.modulos };
      const r = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Error al guardar');
      if (esEdicion) {
        await fetch(`${API}/docente/estudiantes/${estudiante.id_usuario}/modulos`, { method: 'PUT', headers: hdrs(), body: JSON.stringify({ modulos: form.modulos }) });
      }
      onGuardado();
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#2563eb)', padding: '1.4rem 1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>{esEdicion ? 'Editar' : 'Nuevo'} Estudiante</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'white' }}>{esEdicion ? `${estudiante.nombres} ${estudiante.apellidos}` : 'Crear cuenta de estudiante'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '1.4rem 1.6rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ padding: '0.75rem 1rem', background: ROJO.ll, border: `1.5px solid ${ROJO.b}`, borderRadius: '10px', color: ROJO.p, fontSize: '0.83rem', fontWeight: '700' }}>⚠️ {error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            {!esEdicion && <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Cédula *</label><input value={form.cedula} onChange={e => set('cedula', e.target.value)} maxLength={10} placeholder="10 dígitos" style={inp()} /></div>}
            <div><label style={lbl}>Nombres *</label><input value={form.nombres} onChange={e => set('nombres', e.target.value)} placeholder="Nombres completos" style={inp()} /></div>
            <div><label style={lbl}>Apellidos *</label><input value={form.apellidos} onChange={e => set('apellidos', e.target.value)} placeholder="Apellidos completos" style={inp()} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Email *</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" style={inp()} /></div>
            <div><label style={lbl}>{esEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label><input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mínimo 6 caracteres" style={inp()} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><label style={lbl}>Curso</label><input value={form.curso} onChange={e => set('curso', e.target.value)} placeholder="3ro Bach." style={inp()} /></div>
              <div><label style={lbl}>Paralelo</label><input value={form.paralelo} onChange={e => set('paralelo', e.target.value)} placeholder="A" style={inp()} /></div>
            </div>
          </div>
          <div>
            <label style={lbl}>Módulos habilitados</label>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.72rem', color: '#64748b' }}>Activa solo los módulos que el estudiante debe usar en el sistema.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.4rem' }}>
              {Object.entries(MODULOS_INFO).map(([key, info]) => {
                const activo = form.modulos.includes(key);
                return (
                  <button key={key} onClick={() => toggleMod(key)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0.75rem', borderRadius: '10px', border: `1.5px solid ${activo ? AZUL.b : '#e2e8f0'}`, background: activo ? AZUL.ll : 'white', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '0.9rem' }}>{info.icono}</span>
                    <span style={{ fontSize: '0.76rem', fontWeight: '700', color: activo ? AZUL.p : '#64748b', flex: 1 }}>{info.label}</span>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${activo ? AZUL.m : '#e2e8f0'}`, background: activo ? AZUL.m : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {activo && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ padding: '1rem 1.6rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} style={{ padding: '0.7rem 1.4rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.84rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={handleGuardar} disabled={guardando} style={{ padding: '0.7rem 1.6rem', borderRadius: '10px', border: 'none', background: guardando ? '#e2e8f0' : `linear-gradient(135deg,${AZUL.p},${AZUL.m})`, color: guardando ? '#94a3b8' : 'white', fontSize: '0.84rem', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: guardando ? 'none' : '0 4px 14px rgba(21,56,154,0.35)' }}>
            {guardando ? <><Spinner />Guardando...</> : `✓ ${esEdicion ? 'Guardar cambios' : 'Crear estudiante'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Modal solo Módulos ─────────────────────────────────── */
const ModalModulos = ({ estudiante, onClose, onGuardado }) => {
  const [modulos, setModulos] = useState(estudiante?.modulos || Object.keys(MODULOS_INFO));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const toggle = mod => setModulos(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]);

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      const r = await fetch(`${API}/docente/estudiantes/${estudiante.id_usuario}/modulos`, {
        method: 'PUT', headers: hdrs(), body: JSON.stringify({ modulos })
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
      onGuardado();
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#2563eb)', padding: '1.4rem 1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Módulos habilitados</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'white' }}>{estudiante.nombres} {estudiante.apellidos}</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '1.4rem 1.6rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Activa solo los módulos que <strong>{estudiante.nombres}</strong> debe ver en el sistema.</p>
          {error && <div style={{ padding: '0.6rem 0.85rem', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '0.8rem', fontWeight: '700' }}>⚠️ {error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.4rem' }}>
            {Object.entries(MODULOS_INFO).map(([key, info]) => {
              const activo = modulos.includes(key);
              return (
                <button key={key} onClick={() => toggle(key)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '10px', border: `1.5px solid ${activo ? '#93c5fd' : '#e2e8f0'}`, background: activo ? '#eff6ff' : 'white', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '0.9rem' }}>{info.icono}</span>
                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: activo ? '#15389a' : '#64748b', flex: 1, textAlign: 'left' }}>{info.label}</span>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${activo ? '#2563eb' : '#e2e8f0'}`, background: activo ? '#2563eb' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {activo && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => setModulos(Object.keys(MODULOS_INFO))} style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.73rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Todos</button>
              <button onClick={() => setModulos([])} style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.73rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Ninguno</button>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={onClose} style={{ padding: '0.65rem 1.2rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.83rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', border: 'none', background: guardando ? '#e2e8f0' : 'linear-gradient(135deg,#15389a,#2563eb)', color: guardando ? '#94a3b8' : 'white', fontSize: '0.83rem', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: guardando ? 'none' : '0 4px 14px rgba(21,56,154,0.35)' }}>
                {guardando ? 'Guardando...' : '✓ Guardar módulos'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Modal Importar Excel ───────────────────────────────── */
const ModalImportar = ({ onClose, onGuardado }) => {
  const [importando, setImportando] = useState(false);
  const [result, setResult] = useState(null);

  const descargarPlantilla = () => {
    const datos = [
      ['cedula', 'nombres', 'apellidos', 'email', 'curso', 'paralelo'],
      ['1750123456', 'Juan Carlos', 'Pérez López', 'juan@escuela.edu.ec', '3ro Bachillerato', 'A'],
      ['1750234567', 'María Elena', 'González Vera', 'maria@escuela.edu.ec', '3ro Bachillerato', 'A'],
      ['1750345678', 'Carlos Andrés', 'Rodríguez Mora', 'carlos@escuela.edu.ec', '3ro Bachillerato', 'B'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 18 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes');
    XLSX.writeFile(wb, 'plantilla_estudiantes.xlsx');
  };

  const procesar = async (file) => {
    setImportando(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (rows.length < 2) {
        setResult({ creados: 0, omitidos: 0, errores: [{ fila: 0, mensaje: 'El archivo está vacío o no tiene datos.' }] });
        return;
      }

      const headers = rows[0].map(h => String(h).trim().toLowerCase());
      const idx = {
        cedula:    headers.indexOf('cedula'),
        nombres:   headers.indexOf('nombres'),
        apellidos: headers.indexOf('apellidos'),
        email:     headers.indexOf('email'),
        curso:     headers.indexOf('curso'),
        paralelo:  headers.indexOf('paralelo'),
      };

      let creados = 0, omitidos = 0;
      const errores = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => String(cell).trim() === '')) continue;

        const cedula    = idx.cedula    >= 0 ? String(row[idx.cedula]    || '').trim() : '';
        const nombres   = idx.nombres   >= 0 ? String(row[idx.nombres]   || '').trim() : '';
        const apellidos = idx.apellidos >= 0 ? String(row[idx.apellidos] || '').trim() : '';
        const email     = idx.email     >= 0 ? String(row[idx.email]     || '').trim() : '';
        const curso     = idx.curso     >= 0 ? String(row[idx.curso]     || '').trim() : '';
        const paralelo  = idx.paralelo  >= 0 ? String(row[idx.paralelo]  || '').trim() : '';

        if (!cedula || !nombres || !apellidos || !email) {
          errores.push({ fila: i + 1, mensaje: 'Faltan campos obligatorios (cédula, nombres, apellidos, email)' });
          continue;
        }

        try {
          const r = await fetch(`${API}/docente/estudiantes`, {
            method: 'POST', headers: hdrs(),
            body: JSON.stringify({ cedula, nombres, apellidos, email, password: cedula, curso, paralelo })
          });
          if (r.ok) {
            creados++;
          } else {
            const d = await r.json().catch(() => ({}));
            (d.detail && (d.detail.includes('cédula') || d.detail.includes('email')))
              ? omitidos++
              : errores.push({ fila: i + 1, mensaje: d.detail || 'Error desconocido' });
          }
        } catch {
          errores.push({ fila: i + 1, mensaje: 'Error de conexión' });
        }
      }

      setResult({ creados, omitidos, errores });
    } catch (e) {
      setResult({ creados: 0, omitidos: 0, errores: [{ fila: 0, mensaje: 'No se pudo leer el archivo. Verifica que sea un Excel o CSV válido.' }] });
    } finally {
      setImportando(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#2563eb)', padding: '1.4rem 1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Registro masivo</p><p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'white' }}>Importar estudiantes desde Excel</p></div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '1.6rem' }}>
          {!result ? (<>
            <div style={{ background: AZUL.ll, border: `1.5px solid ${AZUL.b}`, borderRadius: '12px', padding: '1rem', marginBottom: '1.2rem' }}>
              <p style={{ margin: '0 0 0.4rem', fontWeight: '900', fontSize: '0.82rem', color: AZUL.p }}>📋 Columnas requeridas en orden:</p>
              <code style={{ display: 'block', background: 'white', borderRadius: '8px', padding: '0.5rem 0.8rem', fontSize: '0.74rem', color: '#0f172a', border: '1px solid #e2e8f0' }}>cedula, nombres, apellidos, email, curso, paralelo</code>
              <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>💡 Contraseña inicial = cédula del estudiante. Puede cambiarla en Mi Perfil.</p>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem', border: `2px dashed ${AZUL.b}`, borderRadius: '14px', cursor: 'pointer', background: importando ? AZUL.ll : '#fafcff' }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = AZUL.ll; }}
              onDragLeave={e => { e.currentTarget.style.background = '#fafcff'; }}
              onDrop={async e => { e.preventDefault(); e.currentTarget.style.background = '#fafcff'; const f = e.dataTransfer.files[0]; if (f) await procesar(f); }}>
              {importando ? <><Spinner /><span style={{ fontSize: '0.85rem', fontWeight: '700', color: AZUL.p }}>Procesando...</span></> : <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={AZUL.m} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/></svg>
                <div style={{ textAlign: 'center' }}><p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: AZUL.p }}>Arrastra tu archivo aquí</p><p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>o haz clic · .csv, .xlsx, .xls</p></div>
              </>}
              <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={async e => { if (e.target.files[0]) await procesar(e.target.files[0]); }} />
            </label>
            <button onClick={descargarPlantilla} style={{ width: '100%', marginTop: '0.85rem', padding: '0.6rem', borderRadius: '10px', border: `1.5px solid ${VERDE.b}`, background: 'white', color: VERDE.p, fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              onMouseEnter={e => e.currentTarget.style.background = VERDE.ll} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
              ⬇ Descargar plantilla de ejemplo
            </button>
          </>) : (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div><div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{result.errores.length === 0 ? '✅' : '⚠️'}</div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>{result.creados} estudiante{result.creados !== 1 ? 's' : ''} creado{result.creados !== 1 ? 's' : ''}</h3>
                {result.omitidos > 0 && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>{result.omitidos} omitidos (ya existían)</p>}
              </div>
              {result.errores.length > 0 && <div style={{ background: ROJO.ll, border: `1.5px solid ${ROJO.b}`, borderRadius: '10px', padding: '0.85rem', textAlign: 'left' }}><p style={{ margin: '0 0 0.35rem', fontSize: '0.76rem', fontWeight: '800', color: ROJO.p }}>Filas con error:</p>{result.errores.map((er, i) => <p key={i} style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: '#334155' }}>· Fila {er.fila}: {er.mensaje}</p>)}</div>}
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center' }}>
                <button onClick={() => setResult(null)} style={{ padding: '0.6rem 1.1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.81rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Importar otro</button>
                <button onClick={() => { onClose(); onGuardado(); }} style={{ padding: '0.6rem 1.3rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${AZUL.p},${AZUL.m})`, color: 'white', fontSize: '0.81rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>Listo</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Tabla de estudiantes reutilizable ──────────────────── */
const TablaEstudiantes = ({ lista, onEditar, onToggleEstado, onModulos, onEliminar }) => {
  const [pagina, setPagina] = useState(1);

  // Reset página si cambia la lista (búsqueda)
  useEffect(() => { setPagina(1); }, [lista.length]);

  const totalPags = Math.ceil(lista.length / PAGE_SIZE);
  const paginados = lista.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  if (lista.length === 0) return null; // el padre maneja empty state

  return (
    <>
      {paginados.map((e, i) => (
        <div key={e.id_usuario}
          style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr 160px', padding: '0.82rem 1.2rem', alignItems: 'center', borderBottom: i < paginados.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.1s', minWidth: '580px' }}
          onMouseEnter={ev => ev.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AvatarDoc n={e.nombres} a={e.apellidos} />
            <div>
              <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{e.nombres} {e.apellidos}</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>{e.cedula}</p>
            </div>
          </div>
          <span style={{ fontSize: '0.77rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.email}</span>
          <span style={{ fontSize: '0.77rem', color: '#64748b' }}>{e.curso ? `${e.curso} ${e.paralelo || ''}` : '—'}</span>
          <span style={{ fontSize: '0.71rem', fontWeight: '800', padding: '0.16rem 0.55rem', borderRadius: '99px', color: e.estado ? VERDE.p : '#94a3b8', background: e.estado ? VERDE.ll : '#f1f5f9' }}>{e.estado ? 'Activo' : 'Inactivo'}</span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button title="Editar" onClick={() => onEditar(e)}
              style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={ev => { ev.currentTarget.style.borderColor='#2563eb'; ev.currentTarget.style.color='#2563eb'; }}
              onMouseLeave={ev => { ev.currentTarget.style.borderColor='#e2e8f0'; ev.currentTarget.style.color='#64748b'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button title={e.estado ? 'Desactivar' : 'Activar'} onClick={() => onToggleEstado(e)}
              style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={ev => { ev.currentTarget.style.borderColor='#f59e0b'; ev.currentTarget.style.color='#f59e0b'; }}
              onMouseLeave={ev => { ev.currentTarget.style.borderColor='#e2e8f0'; ev.currentTarget.style.color='#64748b'; }}>
              {e.estado
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="8" cy="12" r="3" fill="currentColor"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="5" width="22" height="14" rx="7"/><circle cx="16" cy="12" r="3" fill="currentColor"/></svg>}
            </button>
            <button title="Módulos" onClick={() => onModulos(e)}
              style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={ev => { ev.currentTarget.style.borderColor='#7c3aed'; ev.currentTarget.style.color='#7c3aed'; }}
              onMouseLeave={ev => { ev.currentTarget.style.borderColor='#e2e8f0'; ev.currentTarget.style.color='#64748b'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button title="Eliminar" onClick={() => onEliminar(e)}
              style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
              onMouseEnter={ev => { ev.currentTarget.style.borderColor='#ef4444'; ev.currentTarget.style.color='#ef4444'; }}
              onMouseLeave={ev => { ev.currentTarget.style.borderColor='#e2e8f0'; ev.currentTarget.style.color='#64748b'; }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>
      ))}
      <Paginacion total={lista.length} pagina={pagina} setPagina={setPagina} pageSize={PAGE_SIZE} />
    </>
  );
};

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
const DocEstudiantes = () => {
  const isMobile = useIsMobile();
  const [estudiantes, setEstudiantes] = useState([]);
  const [tabActiva, setTabActiva] = useState('activos'); // 'activos' | 'inactivos'

  const getTourKey = () => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return `doc-est-tour-${u?.id_usuario || u?.email || 'default'}`;
    } catch { return 'doc-est-tour-default'; }
  };
  const [tourVisto, setTourVisto] = useState(() => !!localStorage.getItem(getTourKey()));
  const cerrarTour = () => { localStorage.setItem(getTourKey(), '1'); setTourVisto(true); };
  const verTutorial = () => { localStorage.removeItem(getTourKey()); setTourVisto(false); };

  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [modalEst, setModalEst] = useState(null);
  const [modalImport, setModalImport] = useState(false);
  const [modalModulos, setModalModulos] = useState(null);
  const [confirmElim, setConfirmElim] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`${API}/docente/estudiantes`, { headers: hdrs() });
      if (r.ok) { const d = await r.json(); setEstudiantes(d.estudiantes || []); }
    } catch { /* silencioso */ } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleEstado = async (e) => {
    await fetch(`${API}/docente/estudiantes/${e.id_usuario}/estado`, { method: 'PATCH', headers: hdrs() });
    setEstudiantes(prev => prev.map(x => x.id_usuario === e.id_usuario ? { ...x, estado: !x.estado } : x));
  };

  const eliminar = async () => {
    if (!confirmElim) return;
    await fetch(`${API}/docente/estudiantes/${confirmElim.id_usuario}`, { method: 'DELETE', headers: hdrs() });
    setEstudiantes(prev => prev.filter(e => e.id_usuario !== confirmElim.id_usuario));
    setConfirmElim(null);
  };

  // Separar activos e inactivos, aplicando búsqueda a cada grupo
  const filtrar = (lista) => lista.filter(e =>
    `${e.nombres} ${e.apellidos} ${e.cedula} ${e.email} ${e.curso || ''} ${e.paralelo || ''}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  const activos   = filtrar(estudiantes.filter(e => e.estado));
  const inactivos = filtrar(estudiantes.filter(e => !e.estado));

  // Cambiar tab también resetea búsqueda para no confundir
  const cambiarTab = (t) => { setTabActiva(t); setBusqueda(''); };

  const listaActual = tabActiva === 'activos' ? activos : inactivos;

  const tabStyle = (activa) => ({
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.52rem 1.1rem', borderRadius: '10px 10px 0 0',
    border: '1.5px solid', borderBottom: activa ? '1.5px solid white' : '1.5px solid #e2e8f0',
    background: activa ? 'white' : '#f8fafc',
    borderColor: activa ? '#e2e8f0' : '#e2e8f0',
    cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '0.8rem', fontWeight: '800',
    color: activa ? AZUL.p : '#94a3b8',
    marginBottom: '-1.5px', position: 'relative', zIndex: activa ? 2 : 1,
    transition: 'all 0.15s',
  });

  const badgeStyle = (color, bg) => ({
    minWidth: '20px', height: '20px', borderRadius: '99px',
    background: bg, color: color,
    fontSize: '0.67rem', fontWeight: '900',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 5px',
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '1rem 0.85rem' : '1.8rem 2rem', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>

      {/* Tour */}
      {!tourVisto && (
        <TourDocente
          titulo="ESTUDIANTES"
          subtitulo="Gestión de estudiantes"
          pasos={[
            { emoji: '👥', titulo: '¿Qué puedo hacer aquí?', texto: 'Gestiona las cuentas de tus estudiantes: crear nuevas cuentas, editar datos, activar o desactivar el acceso y controlar qué módulos puede ver cada uno.' },
            { emoji: '➕', titulo: 'Crear estudiante', texto: 'Usa "Nuevo Estudiante" para registrar uno a uno, o "Importar Excel" para cargar toda la lista del paralelo de una sola vez. La contraseña inicial es su cédula.' },
            { emoji: '🔒', titulo: 'Asignar módulos', texto: 'Con el botón de cuadrícula puedes definir exactamente qué secciones del sistema verá cada estudiante: solo Clientes, solo Facturación, todo, etc.' },
            { emoji: '🔄', titulo: 'Activar / Desactivar', texto: 'El botón de palanca bloquea temporalmente el acceso sin eliminar datos. Los inactivos aparecen en la pestaña "Inactivos" para mantener la lista principal limpia.' },
          ]}
          onCerrar={cerrarTour}
        />
      )}

      {/* Barra amarilla */}
      <div style={{ background: 'linear-gradient(90deg,#fffbeb,#fef3c7)', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '0.65rem 1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <span style={{ fontSize: '0.95rem' }}>👨‍🏫</span>
        <p style={{ margin: 0, fontSize: '0.77rem', color: '#92400e', fontWeight: '700', flex: 1 }}>Panel Docente — Gestiona los estudiantes y sus módulos habilitados.</p>
        <button onClick={verTutorial} style={{ padding: '0.28rem 0.65rem', borderRadius: '8px', border: '1.5px solid #fbbf24', background: 'white', color: '#92400e', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>📖 Ver tutorial</button>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.4rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', color: '#0f172a' }}>Estudiantes</h1>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: '#64748b' }}>
            {estudiantes.filter(e=>e.estado).length} activo{estudiantes.filter(e=>e.estado).length !== 1 ? 's' : ''}
            {estudiantes.filter(e=>!e.estado).length > 0 && <span style={{ color: '#94a3b8' }}> · {estudiantes.filter(e=>!e.estado).length} inactivo{estudiantes.filter(e=>!e.estado).length !== 1 ? 's' : ''}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={() => setModalImport(true)} style={{ padding: '0.6rem 1rem', borderRadius: '12px', border: `1.5px solid ${VERDE.b}`, background: 'white', color: VERDE.p, fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onMouseEnter={e => e.currentTarget.style.background = VERDE.ll} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/></svg>
            Importar Excel
          </button>
          <button onClick={() => setModalEst({})} style={{ padding: '0.6rem 1.3rem', borderRadius: '12px', border: 'none', background: `linear-gradient(90deg,${AZUL.p},${AZUL.m})`, color: 'white', fontWeight: '800', fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 14px rgba(21,56,154,0.35)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo Estudiante
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder={`Buscar ${tabActiva === 'activos' ? 'activos' : 'inactivos'} por nombre, cédula, email, curso...`}
          style={{ width: '100%', padding: '0.62rem 1rem 0.62rem 2.5rem', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => e.target.style.borderColor = AZUL.m} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
        <svg style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-end', marginBottom: '0' }}>
        <button style={tabStyle(tabActiva === 'activos')} onClick={() => cambiarTab('activos')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Activos
          <span style={badgeStyle(tabActiva === 'activos' ? AZUL.p : '#94a3b8', tabActiva === 'activos' ? AZUL.ll : '#f1f5f9')}>
            {activos.length}
          </span>
        </button>
        <button style={tabStyle(tabActiva === 'inactivos')} onClick={() => cambiarTab('inactivos')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Inactivos
          {inactivos.length > 0 && (
            <span style={badgeStyle('#dc2626', '#fef2f2')}>
              {inactivos.length}
            </span>
          )}
        </button>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div style={{ background: 'white', borderRadius: '0 16px 16px 16px', border: '1px solid #e2e8f0', padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Cargando estudiantes...</div>
      ) : (
        <div style={{ background: 'white', borderRadius: tabActiva === 'activos' ? '0 16px 16px 16px' : '16px 16px 16px 16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {/* Cabecera de columnas */}
          <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 0.8fr 160px', padding: '0.55rem 1.2rem', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', minWidth: '580px' }}>
            {['Estudiante', 'Email', 'Curso', 'Estado', 'Acciones'].map(h => (
              <span key={h} style={{ fontSize: '0.67rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</span>
            ))}
          </div>

          {listaActual.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              {tabActiva === 'activos' ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>{busqueda ? 'Sin resultados en activos.' : 'No hay estudiantes activos.'}</p>
                  {!busqueda && <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Crea un estudiante o importa desde Excel para comenzar.</p>}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                  <p style={{ margin: 0, fontWeight: '800', fontSize: '0.88rem', color: '#0f172a' }}>{busqueda ? 'Sin resultados en inactivos.' : '¡Ningún estudiante inactivo!'}</p>
                  {!busqueda && <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Los estudiantes desactivados aparecerán aquí.</p>}
                </div>
              )}
            </div>
          ) : (
            <TablaEstudiantes
              lista={listaActual}
              onEditar={setModalEst}
              onToggleEstado={toggleEstado}
              onModulos={setModalModulos}
              onEliminar={setConfirmElim}
            />
          )}
          </div>{/* cierre overflowX */}
        </div>
      )}

      {/* Modales */}
      {modalEst !== null && <ModalEstudiante estudiante={modalEst?.id_usuario ? modalEst : null} onClose={() => setModalEst(null)} onGuardado={() => { setModalEst(null); cargar(); }} />}
      {modalModulos && <ModalModulos estudiante={modalModulos} onClose={() => setModalModulos(null)} onGuardado={() => { setModalModulos(null); cargar(); }} />}
      {modalImport && <ModalImportar onClose={() => setModalImport(false)} onGuardado={cargar} />}
      {confirmElim && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '400px', padding: '1.8rem', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: ROJO.ll, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ROJO.p} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.97rem', fontWeight: '900', color: '#0f172a' }}>¿Eliminar a {confirmElim.nombres} {confirmElim.apellidos}?</h3>
            <p style={{ margin: '0 0 1.3rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>Se eliminarán su cuenta y todos sus datos. Esta acción <strong>no se puede deshacer</strong>.</p>
            <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center' }}>
              <button onClick={() => setConfirmElim(null)} style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.83rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={eliminar} style={{ padding: '0.65rem 1.3rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${ROJO.p},${ROJO.m})`, color: 'white', fontSize: '0.83rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tourFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tourPopIn { from { opacity: 0; transform: scale(0.92) translateY(16px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
};

export default DocEstudiantes;
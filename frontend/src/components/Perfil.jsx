import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';


/* ════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — Mi Perfil de Usuario
   Primera visita: muestra el modal explicativo al estudiante
   localStorage key: perf_tour_visto_<userId>
════════════════════════════════════════════════════════ */
const _getTourKey_PERF = (uid) => `perf_tour_visto_${uid || 'default'}`;



const API = 'http://localhost:8000/api';
const getToken = () => localStorage.getItem('token');
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });
const hdrsMultipart = () => ({ Authorization: `Bearer ${getToken()}` });

const fmtMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFechaCorta = (s) => { if (!s) return '—'; const d = new Date(s); return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtFechaLarga = (s) => { if (!s) return '—'; const d = new Date(s); return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

const C = { primary: '#15389a', mid: '#2563eb', light: '#dbeafe', lighter: '#eff6ff', border: '#93c5fd' };
const inputBase = { padding: '0.68rem 0.9rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.86rem', color: '#1e293b', background: 'white', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' };
const lbl = { fontSize: '0.71rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '0.38rem' };

const TABS = [
  { id: 'perfil',    label: 'Mi Perfil',  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { id: 'seguridad', label: 'Contraseña', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  { id: 'actividad', label: 'Actividad',  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
];

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
    <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
  </svg>
);

const StatCard = ({ label, value, icon, color, bg }) => (
  <div style={{ background: 'white', borderRadius: '14px', padding: '1rem 1.2rem', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0.9rem', border: '1px solid #f1f5f9' }}>
    <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
    </div>
    <div>
      <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
      <p style={{ margin: '0.1rem 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' }}>{value}</p>
    </div>
  </div>
);

const Input = ({ label, value, onChange, readOnly, type = 'text', placeholder }) => (
  <div>
    <label style={lbl}>{label}</label>
    <input type={type} value={value} onChange={onChange} readOnly={readOnly} placeholder={placeholder}
      style={{ ...inputBase, ...(readOnly ? { background: '#f8fafc', color: '#94a3b8', borderColor: '#f1f5f9', cursor: 'default' } : {}) }}
      onFocus={e => { if (!readOnly) { e.target.style.borderColor = C.mid; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'; } }}
      onBlur={e => { e.target.style.borderColor = readOnly ? '#f1f5f9' : '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
    />
  </div>
);

const PasswordInput = ({ label, value, onChange, placeholder, hint }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
<label style={lbl}>{label}</label>
      {hint && <p style={{ margin: '-0.2rem 0 0.4rem', fontSize: '0.71rem', color: '#94a3b8' }}>{hint}</p>}
      <div style={{ position: 'relative' }}>
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder}
          style={{ ...inputBase, paddingRight: '2.8rem' }}
          onFocus={e => { e.target.style.borderColor = C.mid; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'; }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: show ? C.mid : '#94a3b8', display: 'flex', alignItems: 'center' }}>
          {show
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>
    </div>
  );
};

const StrengthBar = ({ password }) => {
  const calc = (p) => { if (!p) return 0; let s = 0; if (p.length >= 6) s++; if (p.length >= 10) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; return s; };
  const strength = calc(password);
  const colors = ['#e2e8f0','#ef4444','#f97316','#f59e0b','#10b981','#10b981'];
  const labels = ['','Muy débil','Débil','Regular','Fuerte','Muy fuerte'];
  if (!password) return null;
  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0.3rem' }}>
        {[1,2,3,4,5].map(i => <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= strength ? colors[strength] : '#e2e8f0', transition: 'background 0.3s' }} />)}
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: colors[strength] }}>{labels[strength]}</span>
    </div>
  );
};

/* ══ AVATAR UPLOADER — VERSIÓN CORREGIDA ══════════════════ */
const AvatarUploader = ({ initials, fotoUrl, onFotoActualizada }) => {
  const fileInputRef = useRef(null);
  const [preview,   setPreview]   = useState(null);
  const [uploading, setUploading] = useState(false);
  const [hovered,   setHovered]   = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  // ✅ FIX 1: Cuando llega fotoUrl del servidor, construir URL absoluta con
  // timestamp para evitar caché del navegador y mostrarla en el círculo.
  useEffect(() => {
    if (fotoUrl) {
      const base = fotoUrl.startsWith('http')
        ? fotoUrl
        : `http://localhost:8000${fotoUrl}`;
      setPreview(`${base}?t=${Date.now()}`);
    } else {
      setPreview(null);
    }
  }, [fotoUrl]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      setUploadErr('Solo se permiten imágenes JPG, PNG, WEBP o GIF.'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadErr('La imagen no debe superar 2 MB.'); return;
    }

    // ✅ FIX 2: Mostrar preview base64 INMEDIATAMENTE en el círculo,
    // sin esperar la respuesta del servidor.
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true); setUploadErr('');
    try {
      const form = new FormData();
      form.append('foto', file);
      const r = await fetch(`${API}/perfil/foto`, {
        method: 'POST', headers: hdrsMultipart(), body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al subir la imagen');

      // ✅ FIX 3: Una vez confirmado el servidor, actualizar con URL real + cache-bust
      const base = data.foto_url.startsWith('http')
        ? data.foto_url
        : `http://localhost:8000${data.foto_url}`;
      setPreview(`${base}?t=${Date.now()}`);
      if (onFotoActualizada) onFotoActualizada(data.foto_url);
    } catch (err) {
      setUploadErr(err.message);
      // Revertir al estado anterior si falla
      if (fotoUrl) {
        const base = fotoUrl.startsWith('http') ? fotoUrl : `http://localhost:8000${fotoUrl}`;
        setPreview(`${base}?t=${Date.now()}`);
      } else {
        setPreview(null);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const eliminarFoto = async () => {
    setUploading(true); setUploadErr('');
    try {
      const r = await fetch(`${API}/perfil/foto`, { method: 'DELETE', headers: hdrs() });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Error'); }
      setPreview(null);
      if (onFotoActualizada) onFotoActualizada(null);
    } catch (err) { setUploadErr(err.message); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem' }}>
      <div style={{ position: 'relative', cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onClick={() => !uploading && fileInputRef.current?.click()}
        title="Cambiar foto de perfil">

        {/* ✅ FIX 4: El div principal usa overflow:hidden + renderiza img cuando hay preview */}
        <div style={{
          width: '88px', height: '88px', borderRadius: '50%',
          background: preview ? '#000' : 'linear-gradient(135deg,#60a5fa,#34d399)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.6rem', fontWeight: '900', color: 'white',
          border: '4px solid white',
          boxShadow: hovered ? '0 0 0 3px #93c5fd, 0 8px 24px rgba(0,0,0,0.16)' : '0 8px 24px rgba(0,0,0,0.14)',
          overflow: 'hidden', transition: 'box-shadow 0.2s', flexShrink: 0,
        }}>
          {preview
            ? <img src={preview} alt="Foto de perfil"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => setPreview(null)} />
            : initials
          }
        </div>

        {/* Overlay hover */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(15,23,42,0.52)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none',
        }}>
          {uploading ? <Spinner />
            : <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span style={{ fontSize: '0.58rem', color: 'white', fontWeight: '700' }}>Cambiar</span>
              </>
          }
        </div>

        {/* Badge cámara */}
        <div style={{
          position: 'absolute', bottom: '2px', right: '2px',
          width: '26px', height: '26px', borderRadius: '50%',
          background: C.mid, border: '2px solid white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transform: hovered ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.2s',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }} onChange={handleFile} />

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          style={{ fontSize: '0.7rem', fontWeight: '700', color: C.primary, background: C.lighter, border: `1px solid ${C.border}`, borderRadius: '99px', padding: '0.28rem 0.75rem', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = C.light; }}
          onMouseLeave={e => e.currentTarget.style.background = C.lighter}>
          {uploading ? 'Subiendo...' : '📷 Subir foto'}
        </button>
        {preview && (
          <button onClick={eliminarFoto} disabled={uploading}
            style={{ fontSize: '0.7rem', fontWeight: '700', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '99px', padding: '0.28rem 0.75rem', cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = '#fee2e2'; }}
            onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}>
            🗑 Quitar
          </button>
        )}
      </div>
      {uploadErr && <p style={{ margin: 0, fontSize: '0.71rem', color: '#ef4444', fontWeight: '700', textAlign: 'center', maxWidth: '200px' }}>⚠️ {uploadErr}</p>}
      <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8', textAlign: 'center' }}>JPG, PNG o WEBP · máx. 2 MB</p>
    </div>
  );
};

/* ══ COMPONENTE PRINCIPAL ══════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   TOUR BIENVENIDA — Mi Perfil de Usuario
   localStorage key: perf_tour_<userId>
════════════════════════════════════════════════════════ */
const getTOUR_KEY_PERF = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `perf-tour-${uid}`;
  } catch { return 'perf-tour'; }
};
const TOUR_KEY_PERF = getTOUR_KEY_PERF();

const TourBienvenida_PERF = ({ onCerrar }) => {
  const pasos = [
    { emoji: '👤', titulo: '¿Qué puedes hacer aquí?', texto: 'Administras tu información personal: nombre, correo y foto de perfil. También puedes cambiar tu contraseña y revisar el historial de actividad.' },
    { emoji: '🖼️', titulo: 'Foto de Perfil', texto: 'Sube una foto que aparece en el sidebar y menú del sistema. Formatos: JPG, PNG o WEBP, máximo 2 MB. Se actualiza en tiempo real sin recargar la página.' },
    { emoji: '🔒', titulo: 'Cambiar Contraseña', texto: 'En la pestaña Contraseña ingresa la clave actual y la nueva dos veces para confirmar. La barra de seguridad muestra la fortaleza de tu nueva clave.' },
    { emoji: '📊', titulo: 'Actividad Reciente', texto: 'En la pestaña Actividad ves tu historial: facturas emitidas, comprobantes registrados y movimientos realizados con tu cuenta.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'La foto de perfil es independiente del logo del negocio. El logo se configura por separado en Configuración del Negocio.' },
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
        {/* Header — color unificado azul oscuro */}
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a)', padding: '1.3rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>MI PERFIL</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: '#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', paddingRight: '2rem' }}>Mi Perfil de Usuario</p>
          <p style={{ margin: '0.18rem 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.65)' }}>Te explicamos cómo funciona este módulo</p>
          <button onClick={onCerrar}
            style={{ position: 'absolute', top: '1rem', right: '1rem', width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
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

const BannerEdu_PERF = ({ onClose, onVerTutorial }) => (
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

const BarraModoEdu_PERF = ({ onVerTutorial }) => (
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

const Perfil = ({ onVolver, onFotoActualizada }) => {

  // ── Tour educativo primera visita ─────────────────────

  // ── Tour educativo — primera visita ──────────────────────────────
  const [tourVisto_PERF, setTourVisto_PERF] = useState(
    () => !!localStorage.getItem(TOUR_KEY_PERF)
  );
  const [mostrarEdu_PERF, setMostrarEdu_PERF] = useState(false);
  const cerrarTour_PERF = () => {
    localStorage.setItem(TOUR_KEY_PERF, '1');
    setTourVisto_PERF(true);
    setMostrarEdu_PERF(true);
    setTimeout(() => setMostrarEdu_PERF(false), 30000);
  };
  const verTutorial_PERF = () => {
    localStorage.removeItem(TOUR_KEY_PERF);
    setTourVisto_PERF(false);
    setMostrarEdu_PERF(false);
  };
  const [_mostrarEdu_PERF, _setMostrarEdu_PERF] = useState(false);
  const [tab, setTab]             = useState('perfil');
  const [perfil, setPerfil]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito]         = useState('');
  const [errorMsg, setErrorMsg]   = useState('');
  const [nombres, setNombres]     = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail]         = useState('');
  const [curso, setCurso]         = useState('');
  const [paralelo, setParalelo]   = useState('');
  const [passEtapa, setPassEtapa]       = useState(1);
  const [passActual, setPassActual]     = useState('');
  const [passVerifErr, setPassVerifErr] = useState('');
  const [verificando, setVerificando]   = useState(false);
  const [passNueva, setPassNueva]       = useState('');
  const [passConfirm, setPassConfirm]   = useState('');
  const [sesiones, setSesiones]         = useState([]);

  useEffect(() => { cargarPerfil(); }, []);

  const cargarPerfil = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/perfil/`, { headers: hdrs() });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setPerfil(data);
      setNombres(data.nombres || ''); setApellidos(data.apellidos || '');
      setEmail(data.email || ''); setCurso(data.curso || ''); setParalelo(data.paralelo || '');
    } catch { setErrorMsg('No se pudo cargar el perfil.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'actividad') {
      fetch(`${API}/perfil/actividad`, { headers: hdrs() })
        .then(r => r.json()).then(d => setSesiones(d.sesiones || [])).catch(() => {});
    }
  }, [tab]);

  const resetTab = (t) => {
    setTab(t); setExito(''); setErrorMsg('');
    setPassEtapa(1); setPassActual(''); setPassVerifErr(''); setPassNueva(''); setPassConfirm('');
  };

  const guardarPerfil = async () => {
    if (!nombres.trim() || !apellidos.trim() || !email.trim()) { setErrorMsg('Nombre, apellido y correo son obligatorios.'); return; }
    setGuardando(true); setExito(''); setErrorMsg('');
    try {
      const r = await fetch(`${API}/perfil/`, { method: 'PATCH', headers: hdrs(), body: JSON.stringify({ nombres, apellidos, email, curso: curso || null, paralelo: paralelo || null }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al guardar');
      setExito('Perfil actualizado correctamente.');
      setPerfil(prev => ({ ...prev, ...data }));
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...u, nombres, apellidos, email }));
    } catch (e) { setErrorMsg(e.message); }
    finally { setGuardando(false); }
  };

  const verificarActual = async () => {
    if (!passActual.trim()) { setPassVerifErr('Ingresa tu contraseña actual.'); return; }
    setVerificando(true); setPassVerifErr('');
    try {
      const r = await fetch(`${API}/perfil/verificar-password`, { method: 'POST', headers: hdrs(), body: JSON.stringify({ password_actual: passActual }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Contraseña incorrecta.');
      setPassEtapa(2);
    } catch (e) { setPassVerifErr(e.message || 'Contraseña incorrecta.'); }
    finally { setVerificando(false); }
  };

  const cambiarPassword = async () => {
    if (passNueva.length < 6) { setErrorMsg('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (passNueva !== passConfirm) { setErrorMsg('Las contraseñas no coinciden.'); return; }
    setGuardando(true); setExito(''); setErrorMsg('');
    try {
      const r = await fetch(`${API}/perfil/cambiar-password`, { method: 'POST', headers: hdrs(), body: JSON.stringify({ password_actual: passActual, password_nueva: passNueva, confirmar: passConfirm }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al cambiar contraseña.');
      setExito('Contraseña cambiada correctamente.');
      setPassEtapa(1); setPassActual(''); setPassNueva(''); setPassConfirm('');
    } catch (e) { setErrorMsg(e.message); }
    finally { setGuardando(false); }
  };

  const initials = perfil ? `${perfil.nombres?.charAt(0)||''}${perfil.apellidos?.charAt(0)||''}`.toUpperCase() : '?';
  const rolColor = perfil?.rol === 'docente'
    ? { text: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' }
    : { text: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' };
  const btnPrimary = (disabled) => ({
    padding: '0.78rem 2rem', borderRadius: '12px', border: 'none',
    background: disabled ? '#e2e8f0' : `linear-gradient(135deg,${C.primary},${C.mid})`,
    color: disabled ? '#94a3b8' : 'white', fontWeight: '800', fontSize: '0.88rem',
    fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    boxShadow: disabled ? 'none' : '0 6px 20px rgba(21,56,154,0.3)', transition: 'all 0.2s',
  });

  return (
    <div style={{ padding: '1.4rem 2rem', fontFamily: "'Nunito','Segoe UI',sans-serif", background: '#f1f5f9', minHeight: '100%' }}>
      {/* ── Tour educativo ── */}
      {!tourVisto_PERF && <TourBienvenida_PERF onCerrar={cerrarTour_PERF} />}
      {mostrarEdu_PERF && <BannerEdu_PERF onClose={() => setMostrarEdu_PERF(false)} onVerTutorial={verTutorial_PERF} />}
      <BarraModoEdu_PERF onVerTutorial={verTutorial_PERF} />

      {/* ── Tour primera visita (modal educativo) ── */}
      {/* ── Banner post-tour (30 segundos) ── */}

      {/* Barra superior */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '0.85rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#15389a,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '0.67rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cuenta</p>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '900', color: '#0f172a' }}>Mi Perfil</p>
          </div>
        </div>
        <button onClick={onVolver}
          style={{ background: C.lighter, border: `1.5px solid ${C.border}`, borderRadius: '8px', padding: '0.42rem 0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: '700', color: C.primary, fontFamily: 'inherit' }}
          onMouseEnter={e => e.currentTarget.style.background = C.light}
          onMouseLeave={e => e.currentTarget.style.background = C.lighter}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#94a3b8', gap: '0.75rem' }}>
          <Spinner /> Cargando perfil...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.4rem', alignItems: 'start' }}>

          {/* Columna izquierda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '20px', overflow: 'visible', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9' }}>
              <div style={{ height: '52px', background: 'linear-gradient(135deg,#0f1f4b,#1a2d6b,#1e3a8a)', borderRadius: '20px 20px 0 0', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ position: 'absolute', width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', top: `${8+(i%3)*14}px`, left: `${60+Math.floor(i/3)*20}px` }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1.4rem 1.4rem' }}>
                <div style={{ marginTop: '-44px', marginBottom: '0.7rem' }}>
                  <AvatarUploader
                    initials={initials}
                    fotoUrl={perfil?.foto_url || null}
                    onFotoActualizada={(url) => {
                      // 1. Estado local del perfil
                      setPerfil(prev => ({ ...prev, foto_url: url }));
                      // 2. Persistir en localStorage con clave exacta
                      try {
                        const u = JSON.parse(localStorage.getItem('user') || '{}');
                        localStorage.setItem('user', JSON.stringify({ ...u, foto_url: url, foto: url }));
                      } catch { /* silencioso */ }
                      // 3. Notificar al Dashboard (que actualiza AppContext + sidebar)
                      if (onFotoActualizada) onFotoActualizada(url);
                    }}
                  />
                </div>
                <h2 style={{ margin: '0 0 0.18rem', fontSize: '0.97rem', fontWeight: '900', color: '#0f172a', textAlign: 'center' }}>{perfil?.nombres} {perfil?.apellidos}</h2>
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{perfil?.email}</p>
                <span style={{ marginTop: '0.5rem', padding: '0.22rem 0.75rem', borderRadius: '99px', fontSize: '0.71rem', fontWeight: '800', color: rolColor.text, background: rolColor.bg, border: `1px solid ${rolColor.border}` }}>
                  {perfil?.rol === 'docente' ? '👨‍🏫 Docente' : '🎓 Estudiante'}
                </span>
                <div style={{ width: '100%', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {[
                    { icon: '🪪', label: 'Cédula', value: perfil?.cedula },
                    { icon: '📅', label: 'Miembro desde', value: fmtFechaCorta(perfil?.miembro_desde) },
                    ...(perfil?.curso    ? [{ icon: '📚', label: 'Curso',    value: perfil.curso }]   : []),
                    ...(perfil?.paralelo ? [{ icon: '🔤', label: 'Paralelo', value: perfil.paralelo }] : []),
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.42rem 0.6rem', background: '#f8fafc', borderRadius: '9px' }}>
                      <span style={{ fontSize: '0.82rem', flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.63rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{r.label}</p>
                        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '700', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <StatCard label="Facturas emitidas" value={perfil?.stats?.total_facturas||0} color="#2563eb" bg="#eff6ff" icon={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>} />
            <StatCard label="Total facturado" value={fmtMoney(perfil?.stats?.total_facturado)} color="#10b981" bg="#ecfdf5" icon={<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>} />
            <StatCard label="Este mes" value={perfil?.stats?.facturas_mes||0} color="#f59e0b" bg="#fffbeb" icon={<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>} />
          </div>

          {/* Columna derecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '0.3rem', display: 'inline-flex', gap: '0.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', width: 'fit-content' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => resetTab(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.52rem 1.05rem', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700', fontFamily: 'inherit', transition: 'all 0.18s', background: tab===t.id ? 'linear-gradient(135deg,#15389a,#2563eb)' : 'transparent', color: tab===t.id ? 'white' : '#64748b', boxShadow: tab===t.id ? '0 4px 12px rgba(21,56,154,0.28)' : 'none' }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {exito && <div style={{ padding: '0.85rem 1.1rem', background: '#d1fae5', border: '1.5px solid #6ee7b7', borderRadius: '12px', color: '#065f46', fontSize: '0.84rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{exito}</div>}
            {errorMsg && <div style={{ padding: '0.85rem 1.1rem', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '12px', color: '#b91c1c', fontSize: '0.84rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{errorMsg}</div>}

            {tab === 'perfil' && (
              <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid #f8fafc', background: '#fafafa', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: C.mid }} />
                  <div><h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>Información Personal</h3><p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>Actualiza tus datos de perfil</p></div>
                </div>
                <div style={{ padding: '1.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                  <Input label="Nombres *" value={nombres} onChange={e => setNombres(e.target.value)} placeholder="Tu nombre" />
                  <Input label="Apellidos *" value={apellidos} onChange={e => setApellidos(e.target.value)} placeholder="Tu apellido" />
                  <div style={{ gridColumn: '1/-1' }}><Input label="Correo electrónico *" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com" /></div>
                  <Input label="Cédula" value={perfil?.cedula||''} readOnly />
                  <Input label="Rol" value={perfil?.rol==='docente'?'Docente':'Estudiante'} readOnly />
                  {perfil?.rol === 'estudiante' && (<>
                    <Input label="Curso" value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ej: 3ro Bachillerato" />
                    <Input label="Paralelo" value={paralelo} onChange={e => setParalelo(e.target.value)} placeholder="Ej: A" />
                  </>)}
                </div>
                <div style={{ padding: '0 1.4rem 1.4rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={guardarPerfil} disabled={guardando} style={btnPrimary(guardando)}>
                    {guardando ? <><Spinner />Guardando...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Guardar Cambios</>}
                  </button>
                </div>
              </div>
            )}

            {tab === 'seguridad' && (
              <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid #f8fafc', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: '#f59e0b' }} />
                    <div><h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>Cambiar Contraseña</h3><p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>Proceso seguro en dos pasos</p></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {[{ n:1, label:'Verificar identidad' },{ n:2, label:'Nueva contraseña' }].map((step, i) => (
                      <React.Fragment key={step.n}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '800', background: passEtapa>step.n?'#10b981':passEtapa===step.n?'linear-gradient(135deg,#15389a,#2563eb)':'#e2e8f0', color: passEtapa>=step.n?'white':'#94a3b8' }}>
                            {passEtapa>step.n?<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>:step.n}
                          </div>
                          <span style={{ fontSize: '0.73rem', fontWeight: passEtapa===step.n?'800':'600', color: passEtapa===step.n?'#0f172a':'#94a3b8' }}>{step.label}</span>
                        </div>
                        {i<1&&<div style={{ flex:1, height:'2px', margin:'0 0.6rem', background:passEtapa>1?'#10b981':'#e2e8f0', borderRadius:'1px', transition:'background 0.3s', minWidth:'24px' }}/>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  {passEtapa===1&&(<>
                    <div style={{ padding: '0.85rem 1rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', gap: '0.7rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0,marginTop:'1px' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      <div><p style={{ margin:0, fontSize:'0.78rem', fontWeight:'800', color:'#1e40af' }}>Verificación de seguridad</p><p style={{ margin:'0.2rem 0 0', fontSize:'0.73rem', color:'#3b82f6' }}>Confirma tu contraseña actual antes de establecer una nueva.</p></div>
                    </div>
                    <PasswordInput label="Contraseña actual *" value={passActual} onChange={e=>{setPassActual(e.target.value);setPassVerifErr('');}} placeholder="Ingresa tu contraseña actual" />
                    {passVerifErr&&<div style={{ display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.78rem',fontWeight:'700',color:'#dc2626',padding:'0.6rem 0.8rem',background:'#fef2f2',borderRadius:'8px',border:'1px solid #fecaca' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{passVerifErr}</div>}
                    <div style={{ display:'flex', justifyContent:'flex-end' }}>
                      <button onClick={verificarActual} disabled={verificando||!passActual.trim()} style={{ ...btnPrimary(verificando||!passActual.trim()), background:(verificando||!passActual.trim())?'#e2e8f0':'linear-gradient(135deg,#d97706,#f59e0b)', boxShadow:(!verificando&&passActual.trim())?'0 6px 20px rgba(217,119,6,0.35)':'none' }}>
                        {verificando?<><Spinner/>Verificando...</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Verificar identidad</>}
                      </button>
                    </div>
                  </>)}
                  {passEtapa===2&&(<>
                    <div style={{ padding:'0.8rem 1rem',background:'#f0fdf4',borderRadius:'12px',border:'1px solid #bbf7d0',display:'flex',gap:'0.6rem',alignItems:'center' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <p style={{ margin:0,fontSize:'0.78rem',fontWeight:'700',color:'#15803d' }}>Identidad verificada. Ingresa tu nueva contraseña.</p>
                    </div>
                    <PasswordInput label="Nueva contraseña *" value={passNueva} onChange={e=>setPassNueva(e.target.value)} placeholder="Mínimo 6 caracteres" hint="Debe ser diferente a tu contraseña actual" />
                    <StrengthBar password={passNueva} />
                    <PasswordInput label="Confirmar nueva contraseña *" value={passConfirm} onChange={e=>setPassConfirm(e.target.value)} placeholder="Repite la nueva contraseña" />
                    {passNueva&&passConfirm&&<div style={{ display:'flex',alignItems:'center',gap:'0.4rem',fontSize:'0.78rem',fontWeight:'700',color:passNueva===passConfirm?'#10b981':'#ef4444',padding:'0.5rem 0.75rem',background:passNueva===passConfirm?'#f0fdf4':'#fef2f2',borderRadius:'8px' }}>{passNueva===passConfirm?<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Las contraseñas coinciden</>:<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Las contraseñas no coinciden</>}</div>}
                    <div style={{ padding:'0.85rem 1rem',background:'#fffbeb',borderRadius:'12px',border:'1px solid #fde68a' }}>
                      <p style={{ margin:'0 0 0.4rem',fontSize:'0.73rem',fontWeight:'800',color:'#92400e' }}>💡 Contraseña segura:</p>
                      {['Mínimo 6 caracteres','Incluye mayúsculas y minúsculas','Agrega números o símbolos'].map(tip=><p key={tip} style={{ margin:'0.12rem 0 0',fontSize:'0.72rem',color:'#78350f' }}>· {tip}</p>)}
                    </div>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                      <button onClick={()=>{setPassEtapa(1);setPassActual('');setPassNueva('');setPassConfirm('');}} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'0.78rem',color:'#64748b',fontFamily:'inherit',display:'flex',alignItems:'center',gap:'0.3rem',fontWeight:'600',padding:'0.4rem 0' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Volver
                      </button>
                      <button onClick={cambiarPassword} disabled={guardando||!passNueva||!passConfirm||passNueva!==passConfirm||passNueva.length<6} style={btnPrimary(guardando||!passNueva||!passConfirm||passNueva!==passConfirm||passNueva.length<6)}>
                        {guardando?<><Spinner/>Cambiando...</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Cambiar Contraseña</>}
                      </button>
                    </div>
                  </>)}
                </div>
              </div>
            )}

            {tab === 'actividad' && (
              <div style={{ background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.05)',border:'1px solid #f1f5f9' }}>
                <div style={{ padding:'1rem 1.4rem',borderBottom:'1px solid #f8fafc',background:'#fafafa',display:'flex',alignItems:'center',gap:'0.6rem' }}>
                  <div style={{ width:'4px',height:'20px',borderRadius:'2px',background:'#10b981' }} />
                  <div><h3 style={{ margin:0,fontSize:'0.9rem',fontWeight:'800',color:'#0f172a' }}>Historial de Sesiones</h3><p style={{ margin:0,fontSize:'0.7rem',color:'#94a3b8',fontWeight:'600' }}>Últimas 10 sesiones iniciadas</p></div>
                </div>
                <div style={{ padding:'1rem 1.4rem',display:'flex',flexDirection:'column',gap:'0.55rem' }}>
                  {sesiones.length===0?(
                    <div style={{ padding:'3rem',textAlign:'center',color:'#94a3b8',fontSize:'0.85rem' }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'block',margin:'0 auto 0.75rem' }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      No hay sesiones registradas
                    </div>
                  ):sesiones.map((s,i)=>(
                    <div key={s.id} style={{ display:'flex',alignItems:'center',gap:'0.85rem',padding:'0.75rem 0.9rem',background:i===0?'#f0fdf4':'#f8fafc',borderRadius:'12px',border:`1px solid ${i===0?'#bbf7d0':'#f1f5f9'}` }}>
                      <div style={{ width:'34px',height:'34px',borderRadius:'9px',background:i===0?'#dcfce7':'#e2e8f0',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={i===0?'#16a34a':'#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ margin:0,fontSize:'0.82rem',fontWeight:'700',color:'#0f172a',display:'flex',alignItems:'center',gap:'0.4rem' }}>
                          Inicio de sesión
                          {i===0&&<span style={{ padding:'1px 7px',borderRadius:'99px',fontSize:'0.64rem',fontWeight:'800',color:'#16a34a',background:'#dcfce7' }}>Sesión actual</span>}
                        </p>
                        <p style={{ margin:'0.1rem 0 0',fontSize:'0.74rem',color:'#64748b' }}>{fmtFechaLarga(s.created_at)}</p>
                      </div>
                      <div style={{ width:'8px',height:'8px',borderRadius:'50%',background:i===0?'#16a34a':'#94a3b8',flexShrink:0 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
};

export default Perfil;
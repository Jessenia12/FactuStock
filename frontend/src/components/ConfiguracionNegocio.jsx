import React, { useState, useEffect, useContext } from 'react';
import ReactDOM from 'react-dom';
import { negocioService } from '../services/api';
import { AppContext } from '../context/AppContext';

const API      = 'http://localhost:8000/api';
const API_BASE = 'http://localhost:8000';
const getToken = () => localStorage.getItem('token');

// ── Paleta ────────────────────────────────────────────────
const C = {
  primary : '#15389a',
  mid     : '#2563eb',
  light   : '#dbeafe',
  lighter : '#eff6ff',
  border  : '#93c5fd',
  success : '#10b981',
  error   : '#ef4444',
};

const EDU_BG     = '#f0f7ff';
const EDU_BORDER = '#bfdbfe';

// ── Clave de tour por usuario ─────────────────────────────
const getTourKey = (userId) => `config_negocio_tour_visto_${userId || 'default'}`;

// ── Helper: construir URL absoluta con cache-bust ─────────
const buildLogoUrl = (url) => {
  if (!url) return null;
  const base = url.startsWith('http') ? url : `${API_BASE}${url}`;
  return `${base}?t=${Date.now()}`;
};

// ══════════════════════════════════════════════════════════
// TOUR DE BIENVENIDA
// ══════════════════════════════════════════════════════════
const TourBienvenida = ({ onCerrar }) => {
  const pasos = [
    {
      emoji: '🏢',
      titulo: '¿Para qué sirve este módulo?',
      texto:
        'Aquí configuras los datos de tu negocio que aparecerán en el encabezado de TODAS tus facturas. El SRI valida que el RUC, razón social y ambiente coincidan exactamente con tu registro tributario.',
    },
    {
      emoji: '🪪',
      titulo: 'Pestaña: Datos de la Empresa',
      texto:
        'Ingresa tu RUC o cédula (10 o 13 dígitos), razón social (nombre legal del SRI), nombre comercial (nombre de tu tienda), dirección, teléfono y correo. Estos datos se imprimen en cada factura.',
    },
    {
      emoji: '🧾',
      titulo: 'Pestaña: Facturación SRI',
      texto:
        'Configura tu régimen tributario (RIMPE, Régimen General, etc.), el ambiente (Pruebas para desarrollo / Producción para facturas reales) y la serie de tus comprobantes (generalmente 001-001).',
    },
    {
      emoji: '🖼️',
      titulo: 'Pestaña: Logo y Vista Previa',
      texto:
        'Sube el logo de tu negocio (JPG, PNG o WEBP, máx. 2 MB). Verás en tiempo real cómo quedará el encabezado de tu factura con todos los datos que ingresaste.',
    },
    {
      emoji: '💾',
      titulo: 'Guardar los cambios',
      texto:
        'Al terminar de completar los datos, presiona el botón azul "Guardar Configuración". Los cambios aplican en todas las facturas generadas a partir de ese momento.',
    },
    {
      emoji: '🏫',
      titulo: 'Modo Educativo',
      texto:
        'Este sistema es para aprendizaje. Puedes explorar sin miedo. El modo "Pruebas" no envía datos reales al SRI. Cuando estés listo para facturar de verdad, cambia el ambiente a "Producción".',
    },
  ];

  const [paso, setPaso] = useState(0);
  const actual = pasos[paso];

  return (
    // ✅ Portal: monta el overlay en document.body para escapar cualquier
    //    contenedor padre con transform/overflow que rompa position:fixed
    ReactDOM.createPortal(
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
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,#0f1f4b,${C.primary})`, padding: '1.3rem 1.5rem', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>
              CONFIGURACIÓN
            </span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: '#78350f' }}>
              EDUCATIVO
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', paddingRight: '2rem' }}>
            Bienvenido a Configuración del Negocio
          </p>
          <p style={{ margin: '0.18rem 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.62)' }}>
            Te explicamos cada sección paso a paso
          </p>
          {/* Botón X */}
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
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= paso ? C.primary : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Contenido */}
        <div style={{ padding: '1.2rem 1.5rem', minHeight: '150px' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: EDU_BG, border: `2px solid ${EDU_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', flexShrink: 0 }}>
              {actual.emoji}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '0.94rem', color: '#0f172a' }}>{actual.titulo}</p>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.65 }}>{actual.texto}</p>
            </div>
          </div>
        </div>

        {/* Pie */}
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
                style={{ padding: '0.52rem 1.2rem', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg,${C.primary},${C.mid})`, color: 'white', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(21,56,154,0.3)' }}>
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
    )
  );
};

// ══════════════════════════════════════════════════════════
// TARJETA EDUCATIVA (inline)
// ══════════════════════════════════════════════════════════
const EduCard = ({ emoji, titulo, texto, color = C.primary }) => (
  <div
    style={{
      background  : EDU_BG,
      border      : `1.5px solid ${EDU_BORDER}`,
      borderLeft  : `4px solid ${color}`,
      borderRadius: '12px',
      padding     : '0.85rem 1rem',
      display     : 'flex',
      gap         : '0.75rem',
      alignItems  : 'flex-start',
      animation   : 'cfgFadeUp 0.35s ease both',
    }}
  >
    <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{emoji}</span>
    <div>
      <p style={{ margin: 0, fontWeight: '800', fontSize: '0.82rem', color }}>
        {titulo}
      </p>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: 1.55 }}>
        {texto}
      </p>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
const ConfiguracionNegocio = () => {
  // ✅ FIX: obtenemos el usuario del contexto para clave de tour por usuario
  const { setLogoNegocio, usuario } = useContext(AppContext);

  // ✅ FIX: clave dinámica basada en el ID o email del usuario
  const TOUR_KEY = getTourKey(usuario?.id_usuario || usuario?.email || usuario?.username);

  const [form, setForm] = useState({
    ruc                  : '',
    razon_social         : '',
    nombre_comercial     : '',
    direccion_matriz     : '',
    direccion_sucursal   : '',
    telefono             : '',
    email                : '',
    contribuyente        : 'RIMPE - Emprendedores',
    ambiente             : 'Pruebas',
    serie_establecimiento: '001',
    serie_punto_emision  : '001',
    obligado_contabilidad: false,
    logo_url             : '',
  });

  const [loading,      setLoading]      = useState(true);
  const [guardando,    setGuardando]    = useState(false);
  const [ok,           setOk]           = useState(false);
  const [error,        setError]        = useState('');
  const [tab,          setTab]          = useState('empresa');
  const [logoPreview,  setLogoPreview]  = useState(null);
  const [cargandoLogo, setCargandoLogo] = useState(false);

  // ── Tour / modo educativo ──────────────────────────────
  const [tourVisto,  setTourVisto]  = useState(true);
  const [mostrarEdu, setMostrarEdu] = useState(false);

  // ✅ FIX: el effect depende de TOUR_KEY para reaccionar cuando cambia el usuario
  useEffect(() => {
    const visto = localStorage.getItem(TOUR_KEY);
    if (!visto) setTourVisto(false);
    else setTourVisto(true);
  }, [TOUR_KEY]);

  const cerrarTour = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setTourVisto(true);
    setMostrarEdu(true);
    setTimeout(() => setMostrarEdu(false), 30000);
  };

  // ── Carga inicial ──────────────────────────────────────
  useEffect(() => {
    negocioService
      .obtener()
      .then((d) => {
        setForm((f) => ({ ...f, ...d }));
        if (d.logo_url) {
          setLogoPreview(buildLogoUrl(d.logo_url));
          setLogoNegocio(d.logo_url); // ← sincronizar contexto al cargar
        }
      })
      .catch(() => setError('No se pudo cargar la configuración del negocio.'))
      .finally(() => setLoading(false));
  }, []);

  const cambiar = (campo, valor) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  // ── Guardar ────────────────────────────────────────────
  const guardar = async () => {
    if (!form.ruc || form.ruc.length < 10) {
      setError('El RUC/CI debe tener al menos 10 dígitos.');
      return;
    }
    if (!form.razon_social.trim()) {
      setError('La Razón Social es obligatoria.');
      return;
    }
    setGuardando(true);
    setError('');
    setOk(false);
    try {
      await negocioService.guardar(form);
      setOk(true);
      setTimeout(() => setOk(false), 4000);
    } catch (e) {
      setError(
        e?.response?.data?.detail || 'Error al guardar. Intenta de nuevo.'
      );
    } finally {
      setGuardando(false);
    }
  };

  // ── Subir logo ─────────────────────────────────────────
  const handleCambiarLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG, WEBP o GIF.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no debe superar 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);

    setCargandoLogo(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const r = await fetch(`${API}/negocio/logo`, {
        method : 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body   : formData,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Error al subir la imagen');

      const url = buildLogoUrl(data.logo_url);
      setLogoPreview(url);
      setForm((prev) => ({ ...prev, logo_url: data.logo_url }));
      setLogoNegocio(data.logo_url);
      setOk(true);
      setTimeout(() => setOk(false), 3000);
    } catch (err) {
      setError(err.message);
      if (form.logo_url) setLogoPreview(buildLogoUrl(form.logo_url));
      else setLogoPreview(null);
    } finally {
      setCargandoLogo(false);
      e.target.value = '';
    }
  };

  const handleQuitarLogo = async () => {
    setCargandoLogo(true);
    setError('');
    try {
      const r = await fetch(`${API}/negocio/logo`, {
        method : 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.detail || 'Error');
      }
      setLogoPreview(null);
      setForm((prev) => ({ ...prev, logo_url: '' }));
      setLogoNegocio(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargandoLogo(false);
    }
  };

  if (loading)
    return (
      <div
        style={{
          padding   : '3rem',
          display   : 'flex',
          alignItems: 'center',
          gap       : '0.8rem',
          fontFamily: "'Nunito',sans-serif",
          color     : '#64748b',
          fontSize  : '0.9rem',
        }}
      >
        <Spinner /> Cargando configuración del negocio...
      </div>
    );

  const TABS = [
    { id: 'empresa',     label: 'Datos de la Empresa', icon: '🏢' },
    { id: 'facturacion', label: 'Facturación SRI',      icon: '🧾' },
    { id: 'logo',        label: 'Logo y Vista Previa',  icon: '🖼️' },
  ];

  return (
    <div
      style={{
        padding   : '1.4rem 1.5rem',
        fontFamily: "'Nunito','Segoe UI',system-ui,sans-serif",
        animation : 'cfgFadeUp 0.3s ease both',
      }}
    >
      {/* ── Tour bienvenida (primera visita por usuario) ── */}
      {!tourVisto && <TourBienvenida onCerrar={cerrarTour} />}

      {/* ── Banner "modo educativo activo" post-tour ── */}
      {mostrarEdu && (
        <div
          style={{
            background  : 'linear-gradient(90deg,#eff6ff,#dbeafe)',
            border      : `1.5px solid ${EDU_BORDER}`,
            borderRadius: '14px',
            padding     : '0.75rem 1.1rem',
            marginBottom: '1rem',
            display     : 'flex',
            alignItems  : 'center',
            gap         : '0.75rem',
            animation   : 'cfgFadeUp 0.3s ease',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>🎓</span>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#1e3a8a', fontWeight: '700' }}>
            Las tarjetas explicativas están activas por 30 segundos. ¡Lee cada
            sección para entender qué hace!
          </p>
          <button
            onClick={() => setMostrarEdu(false)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border    : 'none',
              cursor    : 'pointer',
              color     : '#64748b',
              fontSize  : '1rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Aviso educativo global ── */}
      <div
        style={{
          background  : 'linear-gradient(90deg,#fffbeb,#fef3c7)',
          border      : '1.5px solid #fde68a',
          borderRadius: '12px',
          padding     : '0.7rem 1rem',
          marginBottom: '1.2rem',
          display     : 'flex',
          alignItems  : 'center',
          gap         : '0.7rem',
        }}
      >
        <span style={{ fontSize: '1rem' }}>🏫</span>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', fontWeight: '700' }}>
          Modo Educativo — Completa estos datos antes de generar tu primera
          factura. El ambiente "Pruebas" no envía datos reales al SRI.
        </p>
        <button
          onClick={() => {
            localStorage.removeItem(TOUR_KEY);
            setTourVisto(false);
          }}
          title="Ver tutorial de nuevo"
          style={{
            marginLeft  : 'auto',
            padding     : '0.3rem 0.7rem',
            borderRadius: '8px',
            border      : '1.5px solid #fbbf24',
            background  : 'white',
            color       : '#92400e',
            fontSize    : '0.72rem',
            fontWeight  : '800',
            cursor      : 'pointer',
            fontFamily  : 'inherit',
            whiteSpace  : 'nowrap',
          }}
        >
          📖 Ver tutorial
        </button>
      </div>

      {/* ── Título ── */}
      <div style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width      : '40px',
              height     : '40px',
              borderRadius: '12px',
              background  : `linear-gradient(135deg,${C.primary},${C.mid})`,
              display    : 'flex',
              alignItems : 'center',
              justifyContent: 'center',
              flexShrink : 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
              Configuración del Negocio
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0, fontWeight: '500' }}>
              Esta información aparece en el encabezado de todas tus facturas
            </p>
          </div>
        </div>
      </div>

      {/* ── Alertas ── */}
      {error && (
        <div
          style={{
            padding     : '0.85rem 1rem',
            background  : '#fef2f2',
            border      : '1.5px solid #fecaca',
            borderRadius: '12px',
            color       : '#b91c1c',
            fontSize    : '0.84rem',
            fontWeight  : '600',
            display     : 'flex',
            gap         : '0.6rem',
            alignItems  : 'center',
            marginBottom: '1.2rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: '1rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
      {ok && (
        <div
          style={{
            padding     : '0.85rem 1rem',
            background  : '#f0fdf4',
            border      : '1.5px solid #bbf7d0',
            borderRadius: '12px',
            color       : '#15803d',
            fontSize    : '0.84rem',
            fontWeight  : '700',
            display     : 'flex',
            gap         : '0.6rem',
            alignItems  : 'center',
            marginBottom: '1.2rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Configuración guardada correctamente. Los cambios aplican en las
          próximas facturas.
        </div>
      )}

      {/* ── Tabs ── */}
      <div
        style={{
          background  : 'white',
          borderRadius: '16px',
          boxShadow   : '0 2px 12px rgba(0,0,0,0.05)',
          overflow    : 'hidden',
          marginBottom: '1.4rem',
        }}
      >
        {/* Cabecera de tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #f1f5f9', background: '#fafafa' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex        : 1,
                padding     : '0.9rem 1rem',
                border      : 'none',
                cursor      : 'pointer',
                fontFamily  : 'inherit',
                fontSize    : '0.83rem',
                fontWeight  : tab === t.id ? '800' : '600',
                color       : tab === t.id ? C.primary : '#64748b',
                background  : 'transparent',
                borderBottom: tab === t.id ? `2.5px solid ${C.primary}` : '2.5px solid transparent',
                marginBottom: '-2px',
                display     : 'flex',
                alignItems  : 'center',
                justifyContent: 'center',
                gap         : '0.4rem',
                transition  : 'all 0.18s',
              }}
              onMouseEnter={(e) => { if (tab !== t.id) e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={(e) => { if (tab !== t.id) e.currentTarget.style.color = '#64748b'; }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.6rem' }}>

          {/* ══ TAB: EMPRESA ══ */}
          {tab === 'empresa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'cfgFadeUp 0.3s ease' }}>
              {mostrarEdu && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <EduCard emoji="🪪" titulo="RUC / Cédula"      color={C.primary}  texto="Número de identificación tributaria. Puede ser tu cédula (10 dígitos) o RUC (13 dígitos). Debe coincidir exactamente con tu registro en el SRI." />
                  <EduCard emoji="📋" titulo="Razón Social"       color={C.primary}  texto="Nombre legal registrado en el SRI. Para personas naturales es tu nombre completo en mayúsculas. Para empresas, el nombre societario." />
                  <EduCard emoji="🏪" titulo="Nombre Comercial"   color="#10b981"    texto='Es el "nombre de marca" de tu negocio. Aparece grande en el encabezado de la factura. Puede ser diferente a la razón social.' />
                  <EduCard emoji="📍" titulo="Dirección Matriz"   color="#10b981"    texto="Dirección registrada en el SRI. Escríbela tal como aparece en tu RUC. Aparecerá en todas las facturas como Dir. Matriz." />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                <Campo label="RUC / Cédula" requerido ayuda="El número que aparecerá como RUC del emisor en la factura">
                  <Input value={form.ruc} onChange={(v) => cambiar('ruc', v)} placeholder="Ej: 1792345678001" maxLength={13} />
                </Campo>
                <Campo label="Razón Social" requerido ayuda="Nombre legal registrado en el SRI">
                  <Input value={form.razon_social} onChange={(v) => cambiar('razon_social', v)} placeholder="Ej: GARCÍA LÓPEZ SARA PATRICIA" />
                </Campo>
                <Campo label="Nombre Comercial" span={2} ayuda="Nombre que aparece grande en el encabezado (puede diferir de la razón social)">
                  <Input value={form.nombre_comercial} onChange={(v) => cambiar('nombre_comercial', v)} placeholder="Ej: Tienda Sara · FrutiMart · AgroSur" />
                </Campo>
                <Campo label="Dirección Matriz" span={2} ayuda="Dirección principal del negocio tal como figura en el SRI">
                  <Input value={form.direccion_matriz} onChange={(v) => cambiar('direccion_matriz', v)} placeholder="Ej: AV CHONE KM 37 ENTRADA DE SEPA" />
                </Campo>
                <Campo label="Dirección Sucursal" ayuda="Opcional — solo si tienes una sucursal diferente">
                  <Input value={form.direccion_sucursal} onChange={(v) => cambiar('direccion_sucursal', v)} placeholder="Opcional" />
                </Campo>
                <Campo label="Teléfono de Contacto">
                  <Input value={form.telefono} onChange={(v) => cambiar('telefono', v)} placeholder="0967357684" maxLength={15} />
                </Campo>
                <Campo label="Correo Electrónico" span={2} ayuda="Aparece en la sección Información Adicional de la factura">
                  <Input value={form.email} onChange={(v) => cambiar('email', v)} tipo="email" placeholder="negocio@correo.com" />
                </Campo>
              </div>
            </div>
          )}

          {/* ══ TAB: FACTURACIÓN SRI ══ */}
          {tab === 'facturacion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', animation: 'cfgFadeUp 0.3s ease' }}>
              {mostrarEdu && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <EduCard emoji="🏷️" titulo="Tipo de Contribuyente" color={C.primary}  texto="Define tu régimen tributario en el SRI. La mayoría de emprendedores y negocios pequeños están en RIMPE. Consulta tu RUC para confirmarlo." />
                  <EduCard emoji="🌐" titulo="Ambiente SRI"           color="#8b5cf6"   texto='Usa "Pruebas" mientras aprendes o desarrollas. Cambia a "Producción" solo cuando vayas a emitir facturas reales con validez tributaria.' />
                  <EduCard emoji="🔢" titulo="Serie del Comprobante"  color="#10b981"   texto='El número de tu factura tiene formato 001-001-000000001. El primer 001 es el establecimiento, el segundo el punto de emisión. Generalmente ambos son "001".' />
                  <EduCard emoji="🔑" titulo="Clave de Acceso"        color="#f59e0b"   texto="Se genera automáticamente con 49 dígitos: fecha + tipo (01=factura) + RUC + ambiente + serie + secuencial. Es el identificador único de cada factura ante el SRI." />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                <Campo label="Tipo de Contribuyente" span={2} ayuda="Régimen tributario al que perteneces según el SRI">
                  <select value={form.contribuyente} onChange={(e) => cambiar('contribuyente', e.target.value)} style={selectStyle}>
                    <option value="RIMPE - Emprendedores">RIMPE — Emprendedores</option>
                    <option value="RIMPE - Negocios Populares">RIMPE — Negocios Populares</option>
                    <option value="Régimen General">Régimen General</option>
                    <option value="Contribuyente Especial">Contribuyente Especial</option>
                    <option value="Microempresa">Microempresa</option>
                  </select>
                </Campo>

                <Campo label="Ambiente SRI" ayuda='Usa "Pruebas" durante el desarrollo; "Producción" al emitir facturas reales'>
                  <select value={form.ambiente} onChange={(e) => cambiar('ambiente', e.target.value)} style={selectStyle}>
                    <option value="Pruebas">Pruebas</option>
                    <option value="Producción">Producción</option>
                  </select>
                </Campo>

                <Campo label="¿Obligado a llevar Contabilidad?">
                  <div
                    style={{
                      display    : 'flex',
                      alignItems : 'center',
                      gap        : '0.7rem',
                      padding    : '0.7rem 0.9rem',
                      border     : '1.5px solid #e2e8f0',
                      borderRadius: '10px',
                      background : 'white',
                      cursor     : 'pointer',
                    }}
                    onClick={() => cambiar('obligado_contabilidad', !form.obligado_contabilidad)}
                  >
                    <div
                      style={{
                        width      : '20px',
                        height     : '20px',
                        borderRadius: '6px',
                        background  : form.obligado_contabilidad ? `linear-gradient(135deg,${C.primary},${C.mid})` : 'white',
                        border      : form.obligado_contabilidad ? 'none' : '2px solid #cbd5e1',
                        display    : 'flex',
                        alignItems : 'center',
                        justifyContent: 'center',
                        flexShrink : 0,
                        transition : 'all 0.2s',
                      }}
                    >
                      {form.obligado_contabilidad && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: '0.87rem', fontWeight: '600', color: '#334155', userSelect: 'none' }}>
                      {form.obligado_contabilidad ? 'SÍ, obligado a llevar contabilidad' : 'NO obligado a llevar contabilidad'}
                    </span>
                  </div>
                </Campo>

                <Campo label="Código de Establecimiento" ayuda="Generalmente 001 para el establecimiento principal">
                  <Input value={form.serie_establecimiento} onChange={(v) => cambiar('serie_establecimiento', v.replace(/\D/g, '').slice(0, 3))} placeholder="001" maxLength={3} />
                </Campo>

                <Campo label="Punto de Emisión" ayuda="Generalmente 001 para la primera caja/punto">
                  <Input value={form.serie_punto_emision} onChange={(v) => cambiar('serie_punto_emision', v.replace(/\D/g, '').slice(0, 3))} placeholder="001" maxLength={3} />
                </Campo>

                {/* Nota clave de acceso */}
                <div style={{ gridColumn: '1/-1', background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '12px', padding: '1rem 1.2rem' }}>
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Nota sobre la Clave de Acceso
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#075985', lineHeight: 1.6 }}>
                    La clave de acceso de 49 dígitos se genera automáticamente
                    con: fecha de emisión + tipo de comprobante (01=factura) +
                    tu RUC + ambiente (1=pruebas / 2=producción) + serie (
                    {form.serie_establecimiento || '001'}
                    {form.serie_punto_emision || '001'}) + número secuencial. En
                    producción real debes conectar el sistema al SRI mediante HTTPS.
                  </p>
                </div>

                {/* Resumen visual del régimen */}
                {mostrarEdu && (
                  <div style={{ gridColumn: '1/-1', background: 'white', border: `1.5px solid ${EDU_BORDER}`, borderRadius: '12px', padding: '1rem 1.2rem' }}>
                    <p style={{ margin: '0 0 0.8rem', fontWeight: '800', fontSize: '0.85rem', color: C.primary, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      🧮 ¿Cuál régimen me corresponde?
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.78rem' }}>
                      {[
                        { r: 'RIMPE — Negocios Populares', d: 'Ingresos ≤ $20.000/año. Sin IVA. Sin declaraciones mensuales.',            c: '#10b981' },
                        { r: 'RIMPE — Emprendedores',      d: 'Ingresos entre $20.000 y $300.000/año. Facturas con IVA.',                 c: C.primary },
                        { r: 'Régimen General',             d: 'Ingresos > $300.000/año o actividades excluidas del RIMPE.',              c: '#8b5cf6' },
                        { r: 'Contribuyente Especial',      d: 'Designado por el SRI por el volumen de sus operaciones.',                  c: '#ef4444' },
                      ].map(({ r, d, c }) => (
                        <div key={r} style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.65rem 0.85rem', borderLeft: `3px solid ${c}` }}>
                          <p style={{ margin: 0, fontWeight: '800', fontSize: '0.78rem', color: c }}>{r}</p>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>{d}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ TAB: LOGO Y VISTA PREVIA ══ */}
          {tab === 'logo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.6rem', animation: 'cfgFadeUp 0.3s ease' }}>
              {mostrarEdu && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <EduCard emoji="🖼️" titulo="¿Para qué sirve el logo?" color={C.primary} texto="El logo aparece en la esquina superior izquierda del encabezado de cada factura impresa o en PDF. Usa un fondo blanco o transparente para mejor resultado." />
                  <EduCard emoji="📐" titulo="Formato recomendado"       color="#10b981"   texto="Imagen cuadrada (1:1), fondo blanco o transparente, PNG o WEBP para mejor calidad. Máximo 2 MB. La miniatura se escala automáticamente." />
                </div>
              )}

              {/* Aviso informativo */}
              <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '1rem 1.2rem', display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `linear-gradient(135deg,${C.primary},${C.mid})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.86rem', fontWeight: '800', color: '#1e40af' }}>Logo del negocio</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#3b82f6', lineHeight: 1.6 }}>
                    Este logo aparecerá en el encabezado de todas tus facturas y
                    comprobantes PDF. Sube aquí el logotipo de tu negocio
                    (recomendado: fondo blanco o transparente). La foto de
                    perfil de tu cuenta es independiente y no afecta este logo.
                  </p>
                </div>
              </div>

              {/* Panel logo + acciones */}
              <div style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '1.4rem', display: 'flex', alignItems: 'center', gap: '1.6rem' }}>
                {/* Preview */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    style={{
                      width      : '96px',
                      height     : '96px',
                      borderRadius: '12px',
                      background  : logoPreview ? '#f8fafc' : 'linear-gradient(135deg,#e2e8f0,#cbd5e1)',
                      border     : '3px solid #e2e8f0',
                      display    : 'flex',
                      alignItems : 'center',
                      justifyContent: 'center',
                      overflow   : 'hidden',
                      boxShadow  : '0 4px 16px rgba(0,0,0,0.08)',
                    }}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo del negocio" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} onError={(e) => (e.target.style.display = 'none')} />
                    ) : (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    )}
                  </div>
                  <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '24px', height: '24px', borderRadius: '50%', background: logoPreview ? '#10b981' : '#e2e8f0', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {logoPreview ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    )}
                  </div>
                </div>

                {/* Info + botones */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 0.3rem', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>
                    {logoPreview ? 'Logo activo' : 'Sin logo configurado'}
                  </p>
                  <p style={{ margin: '0 0 0.9rem', fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                    {logoPreview
                      ? 'Este logo aparecerá en el encabezado de todas tus facturas y reportes PDF.'
                      : 'Sube el logo de tu negocio. Recomendamos fondo blanco o transparente, formato cuadrado.'}
                  </p>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        display    : 'flex',
                        alignItems : 'center',
                        gap        : '0.45rem',
                        padding    : '0.55rem 1.1rem',
                        borderRadius: '10px',
                        border     : `1.5px solid ${C.border}`,
                        background : C.lighter,
                        color      : C.primary,
                        fontSize   : '0.8rem',
                        fontWeight : '700',
                        cursor     : cargandoLogo ? 'not-allowed' : 'pointer',
                        fontFamily : 'inherit',
                        opacity    : cargandoLogo ? 0.6 : 1,
                        transition : 'all 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!cargandoLogo) e.currentTarget.style.background = C.light; }}
                      onMouseLeave={(e) => (e.currentTarget.style.background = C.lighter)}
                    >
                      {cargandoLogo ? (
                        <><Spinner color={C.primary} /> Subiendo...</>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          {logoPreview ? 'Cambiar logo' : 'Subir logo'}
                        </>
                      )}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleCambiarLogo} disabled={cargandoLogo} />
                    </label>

                    {logoPreview && (
                      <button
                        onClick={handleQuitarLogo}
                        disabled={cargandoLogo}
                        style={{
                          display    : 'flex',
                          alignItems : 'center',
                          gap        : '0.45rem',
                          padding    : '0.55rem 1.1rem',
                          borderRadius: '10px',
                          border     : '1.5px solid #fecaca',
                          background : '#fef2f2',
                          color      : '#dc2626',
                          fontSize   : '0.8rem',
                          fontWeight : '700',
                          cursor     : cargandoLogo ? 'not-allowed' : 'pointer',
                          fontFamily : 'inherit',
                          opacity    : cargandoLogo ? 0.6 : 1,
                          transition : 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!cargandoLogo) e.currentTarget.style.background = '#fee2e2'; }}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fef2f2')}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                        </svg>
                        Quitar logo
                      </button>
                    )}
                  </div>
                  <p style={{ margin: '0.6rem 0 0', fontSize: '0.69rem', color: '#94a3b8' }}>
                    JPG, PNG o WEBP · máx. 2 MB · recomendado fondo blanco o transparente
                  </p>
                </div>
              </div>

              {/* Vista previa encabezado */}
              <div>
                <p style={{ margin: '0 0 0.7rem', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '4px', height: '14px', background: C.primary, borderRadius: '2px', display: 'inline-block' }} />
                  Vista Previa — Encabezado de Factura
                </p>
                <CabeceraPreview negocio={form} logoPreview={logoPreview} />
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                  Esta es una simulación. El PDF final puede variar ligeramente en tipografía.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Botón guardar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={guardar}
          disabled={guardando}
          style={{
            padding     : '0.88rem 2.5rem',
            borderRadius: '12px',
            border      : 'none',
            cursor      : guardando ? 'not-allowed' : 'pointer',
            background  : guardando ? '#a5b4fc' : `linear-gradient(135deg,${C.primary},${C.mid})`,
            color       : 'white',
            fontWeight  : '800',
            fontSize    : '0.93rem',
            fontFamily  : 'inherit',
            boxShadow   : guardando ? 'none' : '0 8px 24px rgba(21,56,154,0.35)',
            display     : 'flex',
            alignItems  : 'center',
            gap         : '0.6rem',
            transition  : 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!guardando) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(21,56,154,0.45)';
            }
          }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {guardando ? (
            <><Spinner color="white" /> Guardando...</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              Guardar Configuración
            </>
          )}
        </button>
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
          Los cambios aplican en las facturas generadas a partir de ahora
        </p>
      </div>

      <p style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '2rem', textAlign: 'center' }}>
        Sistema de Facturación Electrónica · Ecuador SRI 2026
      </p>

      <style>{`
        @keyframes cfgFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cfgPopIn  { from{opacity:0;transform:scale(0.92)}       to{opacity:1;transform:scale(1)} }
        @keyframes tourFadeIn{ from{opacity:0} to{opacity:1} }
        @keyframes tourPopIn { from{opacity:0;transform:scale(0.93) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ══════════════════════════════════════════════════════════

const Campo = ({ label, children, requerido, span = 1, ayuda }) => (
  <div style={{ gridColumn: `span ${span}` }}>
    <label style={{ fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '0.32rem' }}>
      {label} {requerido && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
    {children}
    {ayuda && (
      <p style={{ margin: '0.28rem 0 0', fontSize: '0.69rem', color: '#94a3b8', lineHeight: 1.4 }}>
        {ayuda}
      </p>
    )}
  </div>
);

const inputStyle = {
  padding    : '0.65rem 0.9rem',
  border     : '1.5px solid #e2e8f0',
  borderRadius: '10px',
  fontSize   : '0.87rem',
  color      : '#1e293b',
  background : 'white',
  width      : '100%',
  boxSizing  : 'border-box',
  fontFamily : 'inherit',
  outline    : 'none',
  transition : 'all 0.2s',
};
const selectStyle = { ...inputStyle, cursor: 'pointer', appearance: 'auto' };

const Input = ({ value, onChange, placeholder, tipo = 'text', maxLength }) => (
  <input
    type={tipo}
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    style={inputStyle}
    onFocus={(e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'; }}
    onBlur={(e)  => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
  />
);

const Spinner = ({ color = '#6366f1' }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
    <line x1="12" y1="2"    x2="12" y2="6"    />
    <line x1="12" y1="18"   x2="12" y2="22"   />
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
    <line x1="2"  y1="12"   x2="6"  y2="12"  />
    <line x1="18" y1="12"   x2="22" y2="12"  />
  </svg>
);

// ── Vista previa del encabezado de factura ────────────────
const CabeceraPreview = ({ negocio, logoPreview }) => {
  const ruc13   = (negocio.ruc || '').padEnd(13, '0').slice(0, 13);
  const amb     = negocio.ambiente === 'Producción' ? '2' : '1';
  const serie   = `${negocio.serie_establecimiento || '001'}${negocio.serie_punto_emision || '001'}`;
  const claveEj = `01042026 01 ${ruc13} ${amb} ${serie} 000000001 12345678`.replace(/ /g, '');

  const logoSrc =
    logoPreview ||
    (negocio.logo_url
      ? negocio.logo_url.startsWith('http')
        ? negocio.logo_url
        : `${API_BASE}${negocio.logo_url}`
      : null);

  return (
    <div style={{ border: '1px solid #000', fontFamily: 'Arial,Helvetica,sans-serif', fontSize: '8pt', color: '#000', borderRadius: '4px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            {/* Columna emisor */}
            <td style={{ width: '55%', padding: '10px 12px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
              {logoSrc ? (
                <img src={logoSrc} alt="logo" style={{ maxHeight: '65px', maxWidth: '140px', objectFit: 'contain', display: 'block', marginBottom: '5px', borderRadius: '4px' }} onError={(e) => (e.target.style.display = 'none')} />
              ) : (
                <div style={{ width: '110px', height: '50px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7pt', color: '#94a3b8', border: '1px dashed #cbd5e1', marginBottom: '5px', borderRadius: '3px', fontFamily: 'inherit' }}>
                  SIN LOGO
                </div>
              )}
              <p style={{ margin: '0 0 2px', fontSize: '12pt', fontWeight: '900' }}>
                {negocio.nombre_comercial || negocio.razon_social || 'NOMBRE DEL NEGOCIO'}
              </p>
              {negocio.razon_social && negocio.razon_social !== negocio.nombre_comercial && (
                <p style={{ margin: '0 0 1px', fontWeight: '700', fontSize: '7.5pt' }}>{negocio.razon_social}</p>
              )}
              {negocio.direccion_matriz  && <p style={{ margin: '0 0 1px', fontSize: '7.5pt' }}><b>Dir. Matriz:</b> {negocio.direccion_matriz}</p>}
              {negocio.direccion_sucursal && <p style={{ margin: '0 0 1px', fontSize: '7.5pt' }}><b>Dir. Sucursal:</b> {negocio.direccion_sucursal}</p>}
              {negocio.telefono          && <p style={{ margin: '0 0 1px', fontSize: '7.5pt' }}><b>Teléfono:</b> {negocio.telefono}</p>}
              {negocio.email             && <p style={{ margin: '0 0 1px', fontSize: '7.5pt' }}><b>Email:</b> {negocio.email}</p>}
              <p style={{ margin: '0 0 1px', fontSize: '7.5pt' }}><b>Obligado A Llevar Contabilidad:</b> {negocio.obligado_contabilidad ? 'SÍ' : 'NO'}</p>
              {negocio.contribuyente && <p style={{ margin: 0, fontSize: '7.5pt' }}><b>Contribuyente Régimen {negocio.contribuyente}</b></p>}
            </td>

            {/* Columna comprobante */}
            <td style={{ width: '45%', padding: '8px 10px', verticalAlign: 'top' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '7.5pt' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontWeight: '700' }}>R.U.C:</td>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontWeight: '700' }}>{negocio.ruc || '—'}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ padding: '4px 6px', borderBottom: '1px solid #ccc', fontWeight: '900', fontSize: '11pt', textAlign: 'center' }}>FACTURA</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontWeight: '700' }}>No.</td>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontFamily: 'monospace' }}>
                      {negocio.serie_establecimiento || '001'}-{negocio.serie_punto_emision || '001'}-000000001
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontWeight: '700', fontSize: '7pt' }}>NÚMERO AUTORIZACIÓN</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontFamily: 'monospace', fontSize: '5.5pt', wordBreak: 'break-all' }}>{claveEj}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontWeight: '700', fontSize: '7pt' }}>FECHA Y HORA</td>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontSize: '7pt' }}>{new Date().toLocaleDateString('es-EC')} 00:00:00</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc', fontWeight: '700' }}>AMBIENTE:</td>
                    <td style={{ padding: '3px 6px', borderBottom: '1px solid #ccc' }}>{negocio.ambiente || 'Pruebas'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '3px 6px', fontWeight: '700' }}>EMISIÓN:</td>
                    <td style={{ padding: '3px 6px' }}>Normal</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ border: '1px solid #000', padding: '4px', marginTop: '4px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 2px', fontWeight: '900', fontSize: '7.5pt' }}>CLAVE DE ACCESO</p>
                <div style={{ fontFamily: 'Courier New,monospace', fontSize: '9pt', fontWeight: '900', lineHeight: 1.3, color: '#000' }}>
                  {[...claveEj].map((ch, i) => {
                    const v = parseInt(ch) || 0;
                    return (
                      <span key={i} style={{ display: 'inline-block', width: `${(v % 3 + 1) * 3}px`, height: '20px', background: '#000', marginRight: '1px', verticalAlign: 'middle' }} />
                    );
                  })}
                </div>
                <p style={{ margin: '2px 0 0', fontFamily: 'Courier New,monospace', fontSize: '5.5pt', wordBreak: 'break-all' }}>{claveEj}</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ margin: 0, padding: '3px 10px', background: '#f8fafc', textAlign: 'center', fontSize: '6.5pt', color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
        ↑ Vista previa del encabezado — así aparecerá en tus facturas impresas
      </p>
    </div>
  );
};

export default ConfiguracionNegocio;
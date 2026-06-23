import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

/* ══════════════════════════════════════════════
   MÓDULO SELECTOR — FactuStock
   Nombre técnico: ModuleSelector.jsx
══════════════════════════════════════════════ */
const ModuleSelector = ({ userName = 'Usuario Demo', userAvatar = null }) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  const modules = [
    {
      id: 'facturacion',
      label: 'Facturación',
      description: 'Crea y gestiona facturas, clientes y ventas.',
      route: '/facturacion',
      color: '#15389a',
      colorLight: 'rgba(15,31,75,0.08)',
      colorBorder: 'rgba(15,31,75,0.18)',
      colorShadow: 'rgba(15,31,75,0.28)',
      icon: (
        <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
          <rect x="10" y="14" width="52" height="64" rx="7" fill="#dbeafe" />
          <rect x="18" y="22" width="52" height="64" rx="7" fill="#bfdbfe" />
          <rect x="26" y="10" width="52" height="66" rx="7" fill="white" stroke="#93c5fd" strokeWidth="1.5"/>
          <rect x="34" y="24" width="28" height="4" rx="2" fill="#93c5fd"/>
          <rect x="34" y="32" width="22" height="3" rx="1.5" fill="#bfdbfe"/>
          <rect x="34" y="39" width="26" height="3" rx="1.5" fill="#bfdbfe"/>
          <rect x="34" y="46" width="20" height="3" rx="1.5" fill="#bfdbfe"/>
          <circle cx="68" cy="62" r="13" fill="#fbbf24"/>
          <text x="68" y="67" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">$</text>
        </svg>
      ),
    },
    {
      id: 'inventario',
      label: 'Inventario',
      description: 'Controla productos, stock y movimientos del almacén.',
      route: '/inventario',
      color: '#0d9488',
      colorLight: 'rgba(13,148,136,0.08)',
      colorBorder: 'rgba(13,148,136,0.18)',
      colorShadow: 'rgba(13,148,136,0.28)',
      icon: (
        <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
          <rect x="8" y="44" width="32" height="28" rx="5" fill="#d4b896"/>
          <rect x="8" y="44" width="32" height="10" rx="5" fill="#c4a882"/>
          <rect x="20" y="44" width="8" height="10" rx="2" fill="#b8976e"/>
          <rect x="44" y="52" width="28" height="20" rx="5" fill="#c9a87c"/>
          <rect x="44" y="52" width="28" height="9" rx="5" fill="#b8976e"/>
          <rect x="54" y="52" width="8" height="9" rx="2" fill="#a07850"/>
          <rect x="38" y="30" width="36" height="30" rx="6" fill="#e8c99a"/>
          <rect x="38" y="30" width="36" height="12" rx="6" fill="#d4b47a"/>
          <rect x="51" y="30" width="10" height="12" rx="3" fill="#c4a060"/>
          <path d="M56 8 L56 26 M48 16 L56 8 L64 16" stroke="#0d9488" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="52" y="42" width="26" height="22" rx="4" fill="white" stroke="#5eead4" strokeWidth="1.5"/>
          <rect x="60" y="38" width="10" height="6" rx="3" fill="#99f6e4"/>
          <rect x="57" y="50" width="14" height="2.5" rx="1.2" fill="#5eead4"/>
          <rect x="57" y="55" width="10" height="2.5" rx="1.2" fill="#99f6e4"/>
          <path d="M56 51.2 L58 53.2 L62 49" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M56 56.2 L58 58.2 L62 54" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      fontFamily: "'Nunito', 'Segoe UI', system-ui, sans-serif",
      background: 'linear-gradient(160deg, #e8f0fe 0%, #f0f7ff 40%, #e6f4f1 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Blob decorativo fondo */}
      <div style={{
        position: 'absolute', top: '-120px', left: '-100px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(147,197,253,0.25) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-80px', right: '-80px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(94,234,212,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── NAVBAR ── */}
      <nav style={{
        width: '100%',
        background: 'linear-gradient(90deg, #0f1f4b 0%, #1a2d6b 55%, #1e3a8a 100%)',
        padding: '0 2rem',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 16px rgba(15,31,75,0.35)',
        boxSizing: 'border-box',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img
            src={logo}
            alt="FactuStock logo"
            style={{ width: '52px', height: '52px', objectFit: 'contain', borderRadius: '8px', mixBlendMode: 'screen' }}
          />
          <span style={{ color: 'white', fontWeight: '700', fontSize: '1.1rem', letterSpacing: '-0.3px' }}>
            FactuStock
          </span>
        </div>

        {/* Íconos derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Campana */}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', color: 'rgba(255,255,255,0.75)', display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
          {/* Ayuda */}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '8px', color: 'rgba(255,255,255,0.75)', display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
          {/* Separador */}
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />
          {/* Avatar + nombre */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '99px', padding: '0.3rem 0.8rem 0.3rem 0.3rem',
            cursor: 'pointer', color: 'white',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #60a5fa, #34d399)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: '700', color: 'white', overflow: 'hidden',
            }}>
              {userAvatar
                ? <img src={userAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : userName.charAt(0).toUpperCase()
              }
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{userName}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 60px)', padding: '2rem',
      }}>

        {/* Encabezado */}
        <div style={{ textAlign: 'center', marginBottom: '3rem', animation: 'fadeUp 0.6s ease both' }}>
          <h1 style={{ fontSize: '2.4rem', fontWeight: '300', color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.5px' }}>
            <span style={{ fontWeight: '700' }}>Bienvenido</span>, selecciona un módulo
          </h1>
          <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>
            ¿Qué módulo deseas empezar a usar?
          </p>
        </div>

        {/* Tarjetas */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {modules.map((mod, i) => (
            <div
              key={mod.id}
              onMouseEnter={() => setHovered(mod.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: '300px', backgroundColor: '#ffffff', borderRadius: '20px',
                padding: '2.5rem 2rem 2rem', display: 'flex', flexDirection: 'column',
                alignItems: 'center', textAlign: 'center', cursor: 'default',
                border: `1.5px solid ${hovered === mod.id ? mod.colorBorder : 'rgba(226,232,240,0.8)'}`,
                boxShadow: hovered === mod.id
                  ? `0 20px 60px ${mod.colorShadow}, 0 4px 16px rgba(0,0,0,0.06)`
                  : '0 4px 24px rgba(0,0,0,0.06)',
                transform: hovered === mod.id ? 'translateY(-6px)' : 'translateY(0)',
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                animation: `fadeUp 0.6s ease ${i * 0.12}s both`,
                background: hovered === mod.id
                  ? `linear-gradient(160deg, white 60%, ${mod.colorLight})`
                  : 'white',
              }}
            >
              {/* Ícono */}
              <div style={{
                width: '130px', height: '130px', borderRadius: '24px',
                background: hovered === mod.id ? mod.colorLight : 'rgba(248,250,252,1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.5rem', transition: 'background 0.3s',
                border: `1px solid ${hovered === mod.id ? mod.colorBorder : 'transparent'}`,
              }}>
                {mod.icon}
              </div>

              {/* Nombre */}
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem', letterSpacing: '-0.3px' }}>
                {mod.label}
              </h2>

              {/* Descripción */}
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 1.75rem', lineHeight: 1.55 }}>
                {mod.description}
              </p>

              {/* Botón */}
              <button
                onClick={() => navigate(mod.route)}
                style={{
                  width: '100%', padding: '0.85rem 1rem',
                  backgroundColor: mod.color,
                  color: 'white', fontWeight: '600', fontSize: '0.95rem',
                  borderRadius: '12px', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: `0 4px 14px ${mod.colorShadow}`,
                  transition: 'background-color 0.2s',
                  letterSpacing: '0.1px',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = mod.id === 'facturacion' ? '#102056' : '#0b7a70'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = mod.color; }}
              >
                Ingresar a {mod.label}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ModuleSelector;
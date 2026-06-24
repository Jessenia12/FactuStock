import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import logo from '../assets/logo.png';
import { authService, dashboardService } from '../services/api';
import DocEstudiantes from './DocEstudiantes';
import GestionTarifasIVA from './GestionTarifasIVA';
import DocTickets from './DocTickets';
import DocActividad from './DocActividad';
import GestionClientes from './GestionClientes';
import GestionProductos from './GestionProductos';
import ConfiguracionNegocio from './ConfiguracionNegocio';
import FacturasEmitidas from './FacturasEmitidas';
import ComprobantesRecibidos from './ComprobantesRecibidos';
import Reportes from './Reportes';
import GenerarAts from './GenerarAts';
import AyudaSoporte from './AyudaSoporte';
import NotaCredito from './NotaCredito';
import NotaDebito from './NotaDebito';
import ComprobanteRetencion from './ComprobanteRetencion';
import LiquidacionesCompras from './LiquidacionesCompras';
import NuevaFactura from './NuevaFactura';
import Proforma from './Proforma';
import Perfil from './Perfil';

const BG = '#f1f5f9';
const SIDEBAR_FULL = 235;
const API_BASE = 'https://factustock-efdi.onrender.com';
const API = `${API_BASE}/api`;
const getToken = () => localStorage.getItem('token');

/* ════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — Dashboard (primera sesión)
════════════════════════════════════════════════════════ */
const getTOUR_KEY_DASH = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `tour-key-dash-${uid}`;
  } catch { return 'tour_key_dash'; }
};
const TOUR_KEY_DASH = getTOUR_KEY_DASH();

const TourBienvenida_DASH = ({ onCerrar }) => {
  const pasos = [
    { emoji: '🎓', titulo: '¡Bienvenido a FactuStock!', texto: 'Este es tu sistema de facturación electrónica educativo. Aquí aprenderás a emitir facturas, notas de crédito, retenciones y más documentos tributarios según la normativa del SRI Ecuador.' },
    { emoji: '📋', titulo: 'Menú de Facturación', texto: 'En "Comprobantes Emitidos" ves todas tus facturas. En "Comprobantes Recibidos" registras los que te entregan. En "Pendientes de Emitir" están tus borradores guardados.' },
    { emoji: '📦', titulo: 'Módulo de Gestión', texto: 'En "Clientes" administras tu cartera de clientes con RUC/cédula. En "Productos y Servicios" configuras tu catálogo con precios e IVA. En "Reportes" analizas tus ventas.' },
    { emoji: '➕', titulo: 'Crear un Comprobante', texto: 'Pulsa el botón azul "+ Nuevo Comprobante" en la pantalla de inicio o en Comprobantes Emitidos. Podrás emitir facturas, notas de crédito/débito, retenciones, liquidaciones y proformas.' },
    { emoji: '⚙️', titulo: 'Configuración del Negocio', texto: 'En "Configuración" registra el RUC, razón social, dirección y logo de tu empresa. Estos datos aparecen en todos tus comprobantes impresos.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Todo lo que hagas aquí es de práctica. No se envía información real al SRI. Puedes explorar con libertad: emitir, anular, corregir — sin consecuencias reales. ¡Aprende sin miedo!' },
  ];
  const [pasoActual, setPasoActual] = React.useState(0);
  const actual = pasos[pasoActual];

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(10,18,40,0.78)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', animation: 'tourFadeIn 0.25s ease',
    }}>
      <div style={{
        background: 'white', borderRadius: '24px', width: '100%', maxWidth: '500px',
        boxShadow: '0 40px 100px rgba(0,0,0,0.4)', overflow: 'hidden',
        animation: 'tourPopIn 0.32s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0f1f4b,#15389a,#1d4ed8)', padding: '1.6rem 1.8rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20px', left: '30px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(96,165,250,0.12)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>FACTUSTOCK</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.22rem 0.75rem', fontSize: '0.68rem', fontWeight: '800', color: '#78350f' }}>MODO EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'white', paddingRight: '2.5rem', lineHeight: 1.2 }}>
            Tu sistema de facturación<br />
            <span style={{ color: '#93c5fd' }}>electrónica educativo</span>
          </p>
          <button onClick={onCerrar}
            style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', width: '32px', height: '32px', borderRadius: '9px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Barra de progreso */}
        <div style={{ display: 'flex', gap: '0.3rem', padding: '0.9rem 1.8rem 0' }}>
          {pasos.map((_, i) => (
            <div key={i} style={{ height: '4px', flex: 1, borderRadius: '99px', background: i <= pasoActual ? '#2563eb' : '#e2e8f0', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Contenido */}
        <div style={{ padding: '1.4rem 1.8rem', minHeight: '160px' }}>
          <div style={{ display: 'flex', gap: '1.1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '2px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', flexShrink: 0 }}>{actual.emoji}</div>
            <div>
              <p style={{ margin: 0, fontWeight: '900', fontSize: '1rem', color: '#0f172a' }}>{actual.titulo}</p>
              <p style={{ margin: '0.45rem 0 0', fontSize: '0.84rem', color: '#475569', lineHeight: 1.7 }}>{actual.texto}</p>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <div style={{ padding: '0.9rem 1.8rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.73rem', color: '#94a3b8', fontWeight: '700' }}>{pasoActual + 1} de {pasos.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pasoActual > 0 && (
              <button onClick={() => setPasoActual(p => p - 1)}
                style={{ padding: '0.55rem 1.1rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.82rem', fontWeight: '700', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Atrás
              </button>
            )}
            {pasoActual < pasos.length - 1 ? (
              <button onClick={() => setPasoActual(p => p + 1)}
                style={{ padding: '0.55rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#15389a,#2563eb)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(21,56,154,0.35)' }}>
                Siguiente →
              </button>
            ) : (
              <button onClick={onCerrar}
                style={{ padding: '0.55rem 1.6rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>
                ¡Empezar a facturar! 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ════════════════════════════════════════════════════════
   BANNER MODO EDUCATIVO
════════════════════════════════════════════════════════ */
const BannerEdu_DASH = ({ onClose, onVerTutorial }) => (
  <div style={{
    marginBottom: '1rem', background: 'linear-gradient(135deg,#f0f7ff,#e0f2fe)',
    border: '1.5px solid #bfdbfe', borderRadius: '14px', padding: '0.85rem 1.2rem',
    display: 'flex', alignItems: 'center', gap: '0.85rem', animation: 'tourFadeIn 0.3s ease',
  }}>
    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🎓</div>
    <div style={{ flex: 1 }}>
      <p style={{ margin: 0, fontWeight: '900', fontSize: '0.82rem', color: '#1d4ed8' }}>Modo Educativo Activo</p>
      <p style={{ margin: '0.1rem 0 0', fontSize: '0.76rem', color: '#3b82f6', lineHeight: 1.4 }}>Primera visita al sistema. Los datos son de práctica, ¡explora sin miedo!</p>
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.2rem', display: 'flex', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
);

const BarraModoEdu_DASH = ({ onVerTutorial }) => (
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

/* ════════════════════════════════════════════════════════
   NAV CONFIG
════════════════════════════════════════════════════════ */
const NAV_PRINCIPAL = [
  { id: 'inicio', label: 'Inicio', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
  { id: 'emitidas', label: 'Comprobantes Emitidos', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { id: 'recibidas', label: 'Comprobantes Recibidos', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> },
  { id: 'por_emitir', label: 'Pendientes de Emitir', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
];
const NAV_GESTION = [
  { id: 'clientes', label: 'Clientes', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { id: 'productos', label: 'Productos y Servicios', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg> },
  { id: 'reportes', label: 'Reportes', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },
  { id: 'generar_ats', label: 'Generar ATS', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="8 13 10 15 16 9" /></svg> },
];
const NAV_SISTEMA = [
  { id: 'configuracion', label: 'Configuración', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
  { id: 'ayuda', label: 'Ayuda y Soporte', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
];
const TODOS_NAV = [...NAV_PRINCIPAL, ...NAV_GESTION, ...NAV_SISTEMA];

const NAV_MODULO_MAP = {
  inicio: 'inicio', emitidas: 'comprobantes_emitidos',
  recibidas: 'comprobantes_recibidos', por_emitir: 'pendientes_emitir',
  clientes: 'clientes', productos: 'productos', reportes: 'reportes',
  generar_ats: 'generar_ats', configuracion: 'configuracion', ayuda: 'ayuda_soporte',
};

const filtrarNav = (items, permitidos) => {
  if (!permitidos) return items;
  return items.filter(item => {
    const mod = NAV_MODULO_MAP[item.id];
    return !mod || permitidos.includes(mod);
  });
};

const NAV_DOCENTE = [
  { id: 'doc_estudiantes', label: 'Estudiantes',     icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: 'doc_tickets',     label: 'Tickets Soporte', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { id: 'doc_actividad',   label: 'Actividad Curso', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { id: 'doc_tarifas_iva', label: 'Tarifas IVA',     icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
];

const formatMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const formatFecha = (s) => { if (!s) return '—'; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }); };
const fmtMoney = (v) => '$' + parseFloat(v || 0).toFixed(2);

const ESTADO_CONFIG = {
  finalizada: { label: 'Finalizada', color: '#10b981', bg: '#d1fae5' },
  borrador: { label: 'Borrador', color: '#f59e0b', bg: '#fef3c7' },
  anulada: { label: 'Anulada', color: '#ef4444', bg: '#fee2e2' },
};
const COLORS_CLIENTE = ['#0ea5e9', '#8b5cf6', '#f97316', '#6366f1', '#10b981', '#f59e0b'];

const Skeleton = ({ w = '100%', h = '20px', radius = '8px' }) => (
  <div style={{ width: w, height: h, borderRadius: radius, background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
);

/* ── Avatar: siempre usa la URL más fresca disponible ── */
const Avatar = ({ initials, fotoUrl, size = 32, radius = '50%', fontSize = '0.78rem' }) => {
  const src = fotoUrl ? (fotoUrl.startsWith('http') ? fotoUrl : `${API_BASE}${fotoUrl}`) : null;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: src ? 'transparent' : 'linear-gradient(135deg,#60a5fa,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: '700', color: 'white', flexShrink: 0, overflow: 'hidden' }}>
      {src
        ? <img
            /* key fuerza re-render cuando cambia la URL */
            key={src}
            src={`${src}?t=${Date.now()}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        : initials}
    </div>
  );
};

const NavItem = ({ item, isActive, onClick, collapsed }) => (
  <div style={{ position: 'relative' }}>
    {isActive && !collapsed && (<>
      <div style={{ position: 'absolute', top: '-18px', right: 0, width: '18px', height: '18px', overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '36px', height: '36px', borderRadius: '50%', boxShadow: `8px 8px 0 8px ${BG}` }} />
      </div>
      <div style={{ position: 'absolute', bottom: '-18px', right: 0, width: '18px', height: '18px', overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '36px', height: '36px', borderRadius: '50%', boxShadow: `8px -8px 0 8px ${BG}` }} />
      </div>
    </>)}
    <button onClick={onClick} title={collapsed ? item.label : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '0.65rem', padding: collapsed ? '0.72rem 0' : '0.72rem 1rem', width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: isActive && !collapsed ? '12px 0 0 12px' : '10px', border: 'none', cursor: 'pointer', background: isActive ? 'linear-gradient(90deg,#dbeafe 0%,#eff6ff 60%,#f1f5f9 100%)' : 'transparent', color: isActive ? '#1d4ed8' : 'rgba(255,255,255,0.58)', fontWeight: isActive ? '800' : '500', fontSize: '0.845rem', textAlign: 'left', transition: 'all 0.18s', fontFamily: 'inherit', position: 'relative', zIndex: 3, overflow: 'hidden' }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'white'; } }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.58)'; } }}>
      <span style={{ flexShrink: 0 }}>{item.icon}</span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: collapsed ? '0px' : '160px', opacity: collapsed ? 0 : 1, transition: 'max-width 0.28s ease, opacity 0.2s ease', display: 'inline-block' }}>{item.label}</span>
    </button>
  </div>
);

const SectionLabel = ({ label, collapsed }) => (
  <span style={{ fontSize: '0.62rem', fontWeight: '700', color: 'rgba(255,255,255,0.28)', letterSpacing: '1.5px', textTransform: 'uppercase', padding: collapsed ? '0' : '0 1rem', display: 'block', marginBottom: '0.2rem', marginTop: '0.75rem', textAlign: collapsed ? 'center' : 'left', overflow: 'hidden', whiteSpace: 'nowrap', opacity: collapsed ? 0 : 1, maxHeight: collapsed ? '0px' : '20px', transition: 'opacity 0.2s ease, max-height 0.2s ease' }}>{label}</span>
);

const ProfileMenu = ({ userName, usuario, fotoUrl, onLogout, onNavegar }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const rol = usuario?.rol === 'docente' ? 'Docente' : 'Estudiante';
  const initial = userName.charAt(0).toUpperCase();
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: open ? '#f1f5f9' : 'transparent', border: `1.5px solid ${open ? '#e2e8f0' : 'transparent'}`, borderRadius: '12px', padding: '0.3rem 0.55rem 0.3rem 0.3rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.18s ease' }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}>
        <Avatar initials={initial} fotoUrl={fotoUrl} size={32} fontSize="0.78rem" />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{userName}</div>
          <div style={{ fontSize: '0.67rem', color: '#94a3b8', fontWeight: '500' }}>{rol}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '2px', transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '260px', background: 'white', borderRadius: '16px', border: '1px solid #e8edf3', boxShadow: '0 16px 48px rgba(15,23,42,0.12)', zIndex: 100, overflow: 'hidden', animation: 'dropIn 0.18s cubic-bezier(0.34,1.4,0.64,1) both' }}>
          <div style={{ padding: '1rem 1.1rem 0.85rem', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#f8faff,#f0f7ff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <Avatar initials={initial} fotoUrl={fotoUrl} size={42} radius="12px" fontSize="1rem" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#2563eb', background: '#eff6ff', borderRadius: '99px', padding: '1px 8px' }}>{rol}</span>
                  {usuario?.email && <span style={{ fontSize: '0.68rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usuario.email}</span>}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div style={{ padding: '0.5rem 1.1rem 0.2rem', fontSize: '0.62rem', fontWeight: '700', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '1px' }}>Cuenta</div>
            {[
              { label: 'Mi Perfil', desc: 'Ver y editar tu información', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>, action: () => { onNavegar('perfil'); setOpen(false); } },
              { label: 'Configuración', desc: 'Preferencias del sistema', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>, action: () => { onNavegar('configuracion'); setOpen(false); } },
            ].map((item, ii) => (
              <button key={ii} onClick={item.action}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 1.1rem', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.13s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0 }}>{item.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.83rem', fontWeight: '700', color: '#0f172a' }}>{item.label}</div>
                  <div style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: '1px' }}>{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ padding: '0.5rem', borderTop: '1px solid #f1f5f9', marginTop: '0.25rem' }}>
            <button onClick={onLogout}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.7rem', border: 'none', borderRadius: '10px', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.13s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </div>
              <div>
                <div style={{ fontSize: '0.83rem', fontWeight: '700', color: '#ef4444' }}>Cerrar sesión</div>
                <div style={{ fontSize: '0.71rem', color: '#fca5a5' }}>Salir de la cuenta</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DOCUMENTOS = [
  { id: 'factura', label: 'Factura', descripcion: 'Factura electrónica estándar', color: '#15389a', colorBg: '#dbeafe', colorAccent: '#3b82f6', disponible: true, icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#3b82f6" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#bfdbfe" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#bfdbfe" /><rect x="10" y="22" width="7" height="1.8" rx="0.9" fill="#bfdbfe" /><circle cx="31" cy="31" r="9" fill="#15389a" /><text x="31" y="35.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="800">$</text></svg> },
  { id: 'nota_credito', label: 'Nota de Crédito', descripcion: 'Devolución o descuento aplicado', color: '#059669', colorBg: '#d1fae5', colorAccent: '#10b981', disponible: true, icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#10b981" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#6ee7b7" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#6ee7b7" /><circle cx="31" cy="31" r="9" fill="#059669" /><path d="M26.5 31h9M31 26.5v9" stroke="white" strokeWidth="2.2" strokeLinecap="round" /></svg> },
  { id: 'nota_debito', label: 'Nota de Débito', descripcion: 'Ajuste de cobro adicional', color: '#dc2626', colorBg: '#fee2e2', colorAccent: '#ef4444', disponible: true, icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#ef4444" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#fca5a5" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#fca5a5" /><circle cx="31" cy="31" r="9" fill="#dc2626" /><path d="M26.5 31h9" stroke="white" strokeWidth="2.2" strokeLinecap="round" /></svg> },
  { id: 'retencion', label: 'Comp. de Retención', descripcion: 'Retención en la fuente o IVA', color: '#d97706', colorBg: '#fef3c7', colorAccent: '#f59e0b', disponible: true, icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#f59e0b" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#fcd34d" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#fcd34d" /><circle cx="31" cy="31" r="9" fill="#d97706" /><path d="M27 31l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { id: 'liquidacion', label: 'Liquidación de Compras', descripcion: 'Compras a no obligados a facturar', color: '#be185d', colorBg: '#fce7f3', colorAccent: '#ec4899', disponible: true, icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#fce7f3" stroke="#f9a8d4" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#ec4899" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#f9a8d4" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#f9a8d4" /><circle cx="31" cy="31" r="9" fill="#be185d" /><text x="31" y="35" textAnchor="middle" fill="white" fontSize="8" fontWeight="800">LC</text></svg> },
  { id: 'proforma', label: 'Proforma', descripcion: 'Cotización o presupuesto previo', color: '#7c3aed', colorBg: '#ede9fe', colorAccent: '#8b5cf6', disponible: true, icon: <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="5" y="3" width="24" height="30" rx="4" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="1.2" /><rect x="10" y="9" width="14" height="2.5" rx="1.2" fill="#8b5cf6" /><rect x="10" y="14" width="10" height="1.8" rx="0.9" fill="#c4b5fd" /><rect x="10" y="18" width="12" height="1.8" rx="0.9" fill="#c4b5fd" /><circle cx="31" cy="31" r="9" fill="#7c3aed" /><path d="M27 27l8 8M35 27l-8 8" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg> },
];

const VistaDocumentos = ({ onSeleccionar, onCerrar }) => {
  const [hovered, setHovered] = useState(null);
  const isMob = window.innerWidth < 768;
  return (
    <div style={{ padding: isMob ? '1.2rem 1rem' : '2.5rem 3rem', animation: 'fadeUp 0.3s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMob ? '1rem' : '2.2rem' }}>
        <div>
          <h2 style={{ fontSize: isMob ? '1.05rem' : '1.55rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.3rem', letterSpacing: '-0.4px' }}>Nuevo Documento</h2>
          <p style={{ fontSize: isMob ? '0.74rem' : '0.875rem', color: '#94a3b8', margin: 0, fontWeight: '500' }}>Selecciona el tipo de comprobante que deseas emitir</p>
        </div>
        <button onClick={onCerrar} style={{ background: '#f1f5f9', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }} onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMob ? '0.5rem' : '1.2rem' }}>
        {DOCUMENTOS.map((doc, i) => {
          const isHov = hovered === doc.id;
          return (
            <div key={doc.id}
              onMouseEnter={() => doc.disponible && setHovered(doc.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => doc.disponible && onSeleccionar(doc.id)}
              style={{ background: isHov ? `linear-gradient(150deg,#fff,${doc.colorBg})` : '#fff', borderRadius: isMob ? '12px' : '20px', padding: isMob ? '0.75rem 0.5rem 0.7rem' : '2rem 1.75rem 1.8rem', display: 'flex', flexDirection: 'column', alignItems: isMob ? 'center' : 'flex-start', textAlign: isMob ? 'center' : 'left', cursor: doc.disponible ? 'pointer' : 'default', border: `1.5px solid ${isHov ? doc.colorAccent + '55' : '#e8edf3'}`, boxShadow: isHov ? `0 20px 48px ${doc.color}1a` : '0 2px 8px rgba(15,23,42,0.05)', transform: isHov ? 'translateY(-7px) scale(1.015)' : 'translateY(0) scale(1)', transition: 'all 0.26s cubic-bezier(0.34,1.45,0.64,1)', position: 'relative', overflow: 'hidden', animation: `fadeUp 0.45s ease ${i * 0.06}s both`, minHeight: isMob ? 'auto' : '200px' }}>
              {!isMob && <div style={{ position: 'absolute', top: '-28px', right: '-28px', width: '110px', height: '110px', borderRadius: '50%', background: isHov ? doc.colorBg : '#f8fafc', opacity: isHov ? 0.6 : 0.4, transition: 'all 0.3s', pointerEvents: 'none' }} />}
              <div style={{ width: isMob ? '42px' : '74px', height: isMob ? '42px' : '74px', borderRadius: isMob ? '10px' : '18px', background: isHov ? doc.colorBg : '#f4f7fb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: isMob ? '0.45rem' : '1.25rem', flexShrink: 0, transform: isHov ? 'scale(1.1) rotate(-2deg)' : 'scale(1)', transition: 'all 0.28s cubic-bezier(0.34,1.45,0.64,1)', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
                {isMob ? <div style={{ transform: 'scale(0.6)', transformOrigin: 'center', lineHeight: 0 }}>{doc.icon}</div> : doc.icon}
              </div>
              <div style={{ position: 'relative', zIndex: 1, flex: 1, width: '100%' }}>
                <div style={{ fontSize: isMob ? '0.65rem' : '1.02rem', fontWeight: '800', lineHeight: 1.25, color: isHov ? doc.color : '#0f172a', marginBottom: isMob ? '0.2rem' : '0.4rem', transition: 'color 0.2s' }}>{doc.label}</div>
                <div style={{ fontSize: isMob ? '0.58rem' : '0.79rem', fontWeight: '500', color: '#94a3b8', lineHeight: 1.4 }}>{doc.descripcion}</div>
              </div>
              {!isMob && <div style={{ position: 'absolute', bottom: '1.4rem', right: '1.4rem', width: '34px', height: '34px', borderRadius: '50%', background: doc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isHov ? 1 : 0, transform: isHov ? 'scale(1)' : 'scale(0.6)', transition: 'all 0.24s cubic-bezier(0.34,1.45,0.64,1)', zIndex: 2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════
   MODAL VER DETALLE FACTURA
════════════════════════════════════════════════════════ */
const ModalVerFactura = ({ factura, onCerrar, onAnular }) => {
  const [detalle, setDetalle] = useState(factura);
  const [descargando, setDescargando] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const r = await fetch(`${API}/facturas/${factura.id_factura}`, { headers: { Authorization: `Bearer ${getToken()}` } });
        if (r.ok) setDetalle(await r.json());
      } catch { }
    };
    cargar();
  }, [factura.id_factura]);

  const estado = ESTADO_CONFIG[detalle?.estado?.value || detalle?.estado] || ESTADO_CONFIG.borrador;
  const nombre = detalle?.cliente?.nombres_apellidos || detalle?.cliente?.razon_social || '—';
  const puedeAnular = detalle?.estado?.value === 'finalizada' || detalle?.estado === 'finalizada';

  const descargar = async (fmt) => {
    setDescargando(fmt);
    try {
      const r = await fetch(`${API}/facturas/${detalle.id_factura}/${fmt}/`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = `${detalle.numero_comprobante || detalle.id_factura}.${fmt}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch { alert(`No se pudo descargar el ${fmt.toUpperCase()}.`); }
    finally { setDescargando(null); }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ padding: '1.2rem 1.5rem', background: 'linear-gradient(135deg,#0f1f4b,#15389a,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: 'white' }}>Detalle — Factura</h3>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.73rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{detalle?.numero_comprobante || '—'}</p>
          </div>
          <button onClick={onCerrar}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ padding: '1.4rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.2rem' }}>
            {[
              { label: 'Cliente', value: nombre },
              { label: 'Fecha Emisión', value: formatFecha(detalle?.fecha_emision) },
              { label: 'Estado', value: estado.label, esEstado: true },
              { label: 'Total', value: fmtMoney(detalle?.total) },
              ...(detalle?.observaciones ? [{ label: 'Observaciones', value: detalle.observaciones, full: true }] : []),
            ].map(row => (
              <div key={row.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.7rem 0.9rem', gridColumn: row.full ? '1/-1' : undefined }}>
                <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{row.label}</p>
                {row.esEstado
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: '99px', background: estado.bg, color: estado.color, fontSize: '0.76rem', fontWeight: '800' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: estado.color }} />{row.value}
                  </span>
                  : <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', fontWeight: '700', color: '#0f172a' }}>{row.value}</p>
                }
              </div>
            ))}
          </div>
          {detalle?.detalles?.length > 0 && (
            <div style={{ marginBottom: '1.2rem' }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ítems</p>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', padding: '0.45rem 0.9rem', background: '#f1f5f9', gap: '0.5rem' }}>
                  {['Producto', 'Cant.', 'P. Unit.', 'Total'].map(col => (
                    <span key={col} style={{ fontSize: '0.66rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{col}</span>
                  ))}
                </div>
                {detalle.detalles.map((d, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', padding: '0.65rem 0.9rem', borderBottom: i < detalle.detalles.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? 'white' : '#fafafa', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{d.producto?.nombre || d.descripcion || '—'}</span>
                    <span style={{ fontSize: '0.79rem', color: '#64748b', textAlign: 'right', minWidth: '32px' }}>{d.cantidad}</span>
                    <span style={{ fontSize: '0.79rem', color: '#64748b', textAlign: 'right', minWidth: '60px' }}>{fmtMoney(d.precio_unitario)}</span>
                    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#2563eb', textAlign: 'right', minWidth: '64px' }}>{fmtMoney(d.total)}</span>
                  </div>
                ))}
                <div style={{ padding: '0.65rem 0.9rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {detalle.subtotal_0 > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}><span>Subtotal 0%</span><span>{fmtMoney(detalle.subtotal_0)}</span></div>}
                  {detalle.subtotal_iva > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}><span>Subtotal {detalle.porcentaje_iva || 15}%</span><span>{fmtMoney(detalle.subtotal_iva)}</span></div>}
                  {detalle.iva > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b' }}><span>IVA {detalle.porcentaje_iva || 15}%</span><span>{fmtMoney(detalle.iva)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span>Total</span><span style={{ color: '#15389a' }}>{fmtMoney(detalle.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
            {[
              { fmt: 'xml', label: 'Descargar XML', sublabel: 'Electrónico', color: '#0d9488', bg: '#f0fdf4', border: '#6ee7b7', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="10" y1="13" x2="14" y2="17" /><line x1="14" y1="13" x2="10" y2="17" /></svg> },
              { fmt: 'pdf', label: 'Descargar PDF', sublabel: 'Formato RIDE', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /><line x1="9" y1="12" x2="15" y2="12" /></svg> },
            ].map(({ fmt, label, sublabel, color, bg, border, icon }) => (
              <button key={fmt} onClick={() => descargar(fmt)} disabled={descargando !== null}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem', borderRadius: '10px', border: `1.5px solid ${border}`, background: bg, color, fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700', cursor: descargando ? 'not-allowed' : 'pointer', transition: 'all 0.15s', flexDirection: 'column', opacity: descargando && descargando !== fmt ? 0.5 : 1 }}
                onMouseEnter={e => { if (!descargando) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                {icon}<span>{label}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: '600', opacity: 0.7 }}>{sublabel}</span>
              </button>
            ))}
          </div>
          {puedeAnular && (
            <button onClick={() => { onCerrar(); onAnular(detalle); }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              Anular comprobante (validación SRI)
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ════════════════════════════════════════════════════════
   MODAL EDITAR FACTURA
════════════════════════════════════════════════════════ */
const ModalEditarFactura = ({ factura, onCerrar, onGuardado, onNavegar }) => {
  const estado = factura?.estado?.value || factura?.estado || '';
  const [observaciones, setObservaciones] = useState(factura?.observaciones || '');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const guardarObservaciones = async () => {
    setGuardando(true);
    try {
      const r = await fetch(`${API}/facturas/${factura.id_factura}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ observaciones })
      });
      if (r.ok) { setGuardado(true); setTimeout(() => { onGuardado(); onCerrar(); }, 900); }
      else { alert('No se pudo guardar. Intenta de nuevo.'); }
    } catch { alert('Error de conexión.'); }
    finally { setGuardando(false); }
  };

  if (estado === 'anulada') {
    return createPortal(
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
        <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ padding: '1.2rem 1.5rem', background: 'linear-gradient(135deg,#94a3b8,#64748b)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>Comprobante Anulado</h3>
              <p style={{ margin: 0, fontSize: '0.73rem', color: 'rgba(255,255,255,0.7)' }}>No permite modificaciones</p>
            </div>
          </div>
          <div style={{ padding: '1.4rem 1.5rem' }}>
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.2rem' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>{factura.numero_comprobante}</p>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid #fca5a5', marginBottom: '1.2rem' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#991b1b', lineHeight: 1.5 }}>Este comprobante fue anulado y no puede ser modificado ni reactivado según la normativa SRI Ecuador 2026.</p>
            </div>
            <button onClick={onCerrar} style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#374151', fontWeight: '700', fontSize: '0.84rem', fontFamily: 'inherit', cursor: 'pointer' }}>Cerrar</button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ padding: '1.2rem 1.5rem', background: 'linear-gradient(135deg,#d97706,#f59e0b)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>Edición Restringida — SRI 2026</h3>
            <p style={{ margin: 0, fontSize: '0.73rem', color: 'rgba(255,255,255,0.8)' }}>{factura.numero_comprobante}</p>
          </div>
        </div>
        <div style={{ padding: '1.4rem 1.5rem' }}>
          <div style={{ background: '#fffbeb', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid #fcd34d', marginBottom: '1.2rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400e', lineHeight: 1.55 }}>Esta factura está <strong>Finalizada</strong>. La normativa SRI Ecuador 2026 <strong>prohíbe</strong> modificar datos fiscales. Solo puedes actualizar las <strong>observaciones internas</strong>.</p>
          </div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#374151', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Observaciones internas</label>
            <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={4} placeholder="Notas internas, referencias, aclaraciones..."
              style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.84rem', fontFamily: 'inherit', color: '#334155', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5, transition: 'border-color 0.15s' }}
              onFocus={e => { e.target.style.borderColor = '#f59e0b'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.1)'; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: '#94a3b8', fontWeight: '600' }}>Este campo no afecta el comprobante tributario.</p>
          </div>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid #bfdbfe', marginBottom: '1.2rem' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.73rem', fontWeight: '800', color: '#1d4ed8' }}>¿Necesitas corregir valores?</p>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#1e40af', lineHeight: 1.5 }}>Emite una <strong>Nota de Crédito</strong> referenciando esta factura para anular efectos tributarios (Art. 10 RLCV).</p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={onCerrar} disabled={guardando} style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#374151', fontWeight: '700', fontSize: '0.84rem', fontFamily: 'inherit', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.6 : 1 }}>Cancelar</button>
            <button onClick={guardarObservaciones} disabled={guardando}
              style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', border: 'none', background: guardado ? '#10b981' : guardando ? '#fcd34d' : 'linear-gradient(135deg,#d97706,#f59e0b)', color: 'white', fontWeight: '700', fontSize: '0.84rem', fontFamily: 'inherit', cursor: guardando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'background 0.2s' }}>
              {guardado ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Guardado</>
                : guardando ? <>Guardando...</> : <>Guardar observaciones</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ════════════════════════════════════════════════════════
   MODAL CONFIRMAR ANULACIÓN
════════════════════════════════════════════════════════ */
const ModalConfirmarAnulacion = ({ factura, onConfirmar, onCerrar, cargando }) => createPortal(
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    onClick={e => { if (e.target === e.currentTarget && !cargando) onCerrar(); }}>
    <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '420px', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}>
      <div style={{ padding: '1.2rem 1.5rem', background: 'linear-gradient(135deg,#dc2626,#ef4444)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>Confirmar anulación</h3>
          <p style={{ margin: 0, fontSize: '0.73rem', color: 'rgba(255,255,255,0.7)' }}>Esta acción no se puede revertir</p>
        </div>
      </div>
      <div style={{ padding: '1.4rem 1.5rem' }}>
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Comprobante</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.84rem', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>{factura?.numero_comprobante}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Fecha emisión</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{formatFecha(factura?.fecha_emision)}</p>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Cliente</p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.84rem', fontWeight: '700', color: '#0f172a' }}>{factura?.cliente?.nombres_apellidos || factura?.cliente?.razon_social || '—'}</p>
            </div>
          </div>
        </div>
        <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '0.7rem 0.9rem', border: '1px solid #fca5a5', marginBottom: '1.2rem' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#991b1b', lineHeight: 1.5 }}>Al anular se <strong>revertirá el inventario</strong> descontado. Esta operación queda registrada en el kardex.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={onCerrar} disabled={cargando} style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#374151', fontWeight: '700', fontSize: '0.84rem', fontFamily: 'inherit', cursor: cargando ? 'not-allowed' : 'pointer', opacity: cargando ? 0.6 : 1 }}>Cancelar</button>
          <button onClick={onConfirmar} disabled={cargando}
            style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', border: 'none', background: cargando ? '#fca5a5' : 'linear-gradient(135deg,#dc2626,#ef4444)', color: 'white', fontWeight: '700', fontSize: '0.84rem', fontFamily: 'inherit', cursor: cargando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            {cargando ? <>Anulando...</> : <>Anular comprobante</>}
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body
);

/* ════════════════════════════════════════════════════════
   MODAL ERROR SRI
════════════════════════════════════════════════════════ */
const ModalErrorSRI = ({ mensaje, onCerrar }) => createPortal(
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
    <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 32px 80px rgba(0,0,0,0.3)', animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}>
      <div style={{ padding: '1.2rem 1.5rem', background: 'linear-gradient(135deg,#dc2626,#ef4444)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>Anulación no permitida por el SRI</h3>
          <p style={{ margin: 0, fontSize: '0.73rem', color: 'rgba(255,255,255,0.7)' }}>Restricción de la normativa vigente</p>
        </div>
      </div>
      <div style={{ padding: '1.4rem 1.5rem' }}>
        <p style={{ margin: '0 0 1.2rem', fontSize: '0.88rem', color: '#374151', lineHeight: 1.6 }}>{mensaje}</p>
        <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid #fcd34d', marginBottom: '1.2rem' }}>
          <p style={{ margin: '0 0 0.3rem', fontSize: '0.75rem', fontWeight: '800', color: '#92400e' }}>¿Qué hacer si ya venció el plazo?</p>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#78350f', lineHeight: 1.5 }}>Emite una <strong>Nota de Crédito</strong> referenciando esta factura. La Nota de Crédito anula efectos tributarios sin importar el plazo (Art. 10 RLCV).</p>
        </div>
        <button onClick={onCerrar} style={{ width: '100%', padding: '0.65rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#dc2626,#ef4444)', color: 'white', fontWeight: '700', fontSize: '0.84rem', fontFamily: 'inherit', cursor: 'pointer' }}>Entendido</button>
      </div>
    </div>
  </div>,
  document.body
);

/* ════════════════════════════════════════════════════════
   DASHBOARD PRINCIPAL
════════════════════════════════════════════════════════ */
const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeNav, setActiveNav] = useState('inicio');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [modalDocumento, setModalDocumento] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [menuAbierto, setMenuAbierto] = useState(false);

  /* ── Tour educativo ── */
  const [tourVisto_DASH, setTourVisto_DASH] = useState(() => !!localStorage.getItem(TOUR_KEY_DASH));
  const [mostrarEdu_DASH, setMostrarEdu_DASH] = useState(false);
  const cerrarTour_DASH = () => {
    localStorage.setItem(TOUR_KEY_DASH, '1');
    setTourVisto_DASH(true);
    setMostrarEdu_DASH(true);
    setTimeout(() => setMostrarEdu_DASH(false), 30000);
  };
  const verTutorial_DASH = () => {
    localStorage.removeItem(TOUR_KEY_DASH);
    setTourVisto_DASH(false);
    setMostrarEdu_DASH(false);
  };

  /* ── Modales tabla ── */
  const [modalVer, setModalVer] = useState(null);
  const [modalEditar, setModalEditar] = useState(null);
  const [itemAnular, setItemAnular] = useState(null);
  const [anulando, setAnulando] = useState(false);
  const [errorSRI, setErrorSRI] = useState('');

  /* ══════════════════════════════════════════════════════
     FIX: foto siempre sincronizada con Perfil y Configuración
     ──────────────────────────────────────────────────────
     fotoUrl viene del AppContext (shared state).
     Al montar, si el context aún no tiene foto pero el
     usuario guardado en authService sí la tiene, la
     inicializamos en el context para que todos los Avatar
     del dashboard muestren la foto correcta desde el inicio.
  ══════════════════════════════════════════════════════ */
  const { fotoUrl, setFotoUrl, logoNegocio, setLogoNegocio } = useContext(AppContext);

  const usuario = authService.getCurrentUser();
  const userName = usuario ? `${usuario.nombres} ${usuario.apellidos}` : 'Usuario';
  const initial = userName.charAt(0).toUpperCase();
  const esDocente = usuario?.rol === 'docente';
  const [modulosPermitidos, setModulosPermitidos] = useState(null);

  /* ── Sincronizar foto al montar ────────────────────────────────────
     1. Leer del localStorage primero (rápido, sin parpadeo)
     2. Luego validar con la API para tener la URL real actualizada
  ── */
  useEffect(() => {
    // Paso 1: mostrar lo que hay en localStorage de inmediato
    const usuarioActual = authService.getCurrentUser();
    const fotoLocal = usuarioActual?.foto_url || usuarioActual?.foto || null;
    if (fotoLocal && !fotoUrl) {
      setFotoUrl(fotoLocal);
    }

    // Paso 2: consultar la API para tener la foto real actualizada
    const sincronizarFotoDesdeAPI = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const r = await fetch(`${API_BASE}/api/perfil/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return;
        const data = await r.json();
        const fotoAPI = data.foto_url || null;
        // Actualizar context Y localStorage con la URL real del servidor
        setFotoUrl(fotoAPI);
        try {
          const u = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...u, foto_url: fotoAPI, foto: fotoAPI }));
        } catch { /* silencioso */ }
      } catch { /* silencioso — no bloquear si la API no responde */ }
    };

    sincronizarFotoDesdeAPI();

    // Cargar logo del negocio para que aparezca en facturas desde el inicio
    const cargarLogoNegocio = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const r = await fetch('https://factustock-efdi.onrender.com/api/negocio/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (r.ok) {
          const data = await r.json();
          if (data?.logo_url && setLogoNegocio) setLogoNegocio(data.logo_url);
        }
      } catch { /* silencioso */ }
    };
    cargarLogoNegocio();

    const cargarModulos = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const r = await fetch('https://factustock-efdi.onrender.com/api/docente/mis-modulos', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (r.ok) {
          const data = await r.json();
          setModulosPermitidos(data.es_docente ? null : (data.modulos || []));
        }
      } catch { /* error de red → mostrar todos */ }
    };
    cargarModulos();
  }, []);

  /* ── Dashboard data ── */
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setModalDocumento(false); setModalVer(null); setModalEditar(null); setItemAnular(null); setMenuAbierto(false); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMenuAbierto(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const cargarDashboard = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      setDashData(await dashboardService.getStats());
    } catch {
      setError('No se pudo cargar el dashboard. Verifica que el servidor esté corriendo.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (activeNav !== 'inicio') return;
    cargarDashboard();
  }, [activeNav, location.key, cargarDashboard]);

  const handleLogout = async () => { await authService.logout(); navigate('/login'); };
  const navegar = (seccion) => { setActiveNav(seccion); if (isMobile) setMenuAbierto(false); };

  /* ── Al actualizar foto desde Perfil ────────────────────────────────
     Actualiza el AppContext (sidebar/topbar reactualizan al instante)
     y persiste en localStorage con la clave exacta 'user' que usa
     authService, para que al recargar la página la foto persista.
  ── */
  const handleFotoActualizada = (url) => {
    // 1. Actualizar AppContext → sidebar y ProfileMenu se actualizan al instante
    setFotoUrl(url);
    // 2. Persistir en localStorage con clave exacta
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...u, foto_url: url, foto: url }));
    } catch { /* silencioso */ }
  };

  /* ── Acciones tabla ── */
  const abrirVer = (f) => setModalVer(f);

  const abrirEditar = (f) => {
    const estado = f.estado?.value || f.estado || '';
    if (estado === 'borrador') { navegar('por_emitir'); return; }
    setModalEditar(f);
  };

  const solicitarAnulacion = (f) => {
    const estado = f.estado?.value || f.estado || '';
    if (estado === 'borrador') { setErrorSRI('Los documentos en estado Borrador no se anulan. Para eliminarlo ve a "Pendientes de Emitir".'); return; }
    if (estado === 'anulada') { setErrorSRI('Este comprobante ya está anulado.'); return; }
    setItemAnular(f);
  };

  const confirmarAnulacion = async () => {
    if (!itemAnular) return;
    setAnulando(true);
    try {
      const r = await fetch(`${API}/facturas/${itemAnular.id_factura}/anular`, { method: 'PATCH', headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) { setItemAnular(null); cargarDashboard(); }
      else { const data = await r.json().catch(() => ({})); setItemAnular(null); setErrorSRI(data?.detail || 'No se pudo anular el documento.'); }
    } catch { setItemAnular(null); setErrorSRI('Error de conexión al intentar anular el comprobante.'); }
    finally { setAnulando(false); }
  };

  const stats = dashData?.stats;
  const facturas = dashData?.facturas_recientes || [];
  const barData = dashData?.ingresos_por_mes || [];
  const maxBar = barData.length > 0 ? Math.max(...barData.map(b => Number(b.total)), 1) : 1;
  const DOC_LABELS = { doc_estudiantes: 'Estudiantes', doc_tickets: 'Tickets Soporte', doc_actividad: 'Actividad Curso', doc_tarifas_iva: 'Tarifas IVA' };
  const activeLabel = TODOS_NAV.find(n => n.id === activeNav)?.label
    || DOC_LABELS[activeNav]
    || (activeNav === 'perfil' ? 'Mi Perfil' : 'Inicio');

  const SECCIONES_IMPLEMENTADAS = [
    'inicio', 'clientes', 'productos', 'configuracion',
    'emitidas', 'recibidas', 'por_emitir', 'reportes',
    'generar_ats', 'ayuda', 'nota_credito', 'nota_debito',
    'retencion', 'liquidacion', 'nueva_factura', 'proforma', 'perfil',
    'doc_estudiantes', 'doc_tickets', 'doc_actividad', 'doc_tarifas_iva',
  ];

  const getEditarTooltip = (f) => {
    const e = f.estado?.value || f.estado || '';
    if (e === 'borrador') return 'Editar borrador';
    if (e === 'anulada') return 'Anulado — no editable';
    return 'Editar observaciones';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Nunito','Segoe UI',system-ui,sans-serif", background: 'linear-gradient(180deg,#0f1f4b 0%,#1a2d6b 55%,#1e3a8a 100%)' }}>

      {/* MODALES GLOBALES */}
      {errorSRI && <ModalErrorSRI mensaje={errorSRI} onCerrar={() => setErrorSRI('')} />}
      {itemAnular && <ModalConfirmarAnulacion factura={itemAnular} onConfirmar={confirmarAnulacion} onCerrar={() => setItemAnular(null)} cargando={anulando} />}
      {modalVer && <ModalVerFactura factura={modalVer} onCerrar={() => setModalVer(null)} onAnular={(f) => { setModalVer(null); solicitarAnulacion(f); }} />}
      {modalEditar && <ModalEditarFactura factura={modalEditar} onCerrar={() => setModalEditar(null)} onGuardado={() => { cargarDashboard(); }} onNavegar={navegar} />}

      {/* OVERLAY MÓVIL */}
      {isMobile && menuAbierto && (
        <div onClick={() => setMenuAbierto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 49, backdropFilter: 'blur(2px)' }} />
      )}

      {/* SIDEBAR */}
      <aside style={{ width: `${SIDEBAR_FULL}px`, minWidth: `${SIDEBAR_FULL}px`, height: '100vh', position: isMobile ? 'fixed' : 'sticky', top: 0, left: 0, background: 'linear-gradient(180deg,#0f1f4b 0%,#1a2d6b 55%,#1e3a8a 100%)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', zIndex: 50, transform: isMobile ? (menuAbierto ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)', transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ padding: '1.1rem 0 0 0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.8rem 1.3rem', overflow: 'hidden' }}>
            <img src={logo} alt="logo" style={{ width: '40px', height: '40px', objectFit: 'contain', mixBlendMode: 'screen', flexShrink: 0 }} />
            <span style={{ color: 'white', fontWeight: '800', fontSize: '1.1rem', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
              Factu<span style={{ color: '#60a5fa' }}>Stock</span>
            </span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 0 0.7rem', scrollbarWidth: 'none' }}>
          {esDocente && (
            <>
              <SectionLabel label="Docente" collapsed={false} />
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.02rem' }}>
                {NAV_DOCENTE.map(item => {
                  const badge = item.id === 'doc_tickets' ? null : null;
                  return (
                    <NavItem key={item.id} item={item} collapsed={false} isActive={activeNav === item.id} onClick={() => navegar(item.id)} />
                  );
                })}
              </nav>
            </>
          )}
          {filtrarNav(NAV_PRINCIPAL, modulosPermitidos).length > 0 && <>
            <SectionLabel label="Facturación" collapsed={false} />
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.02rem' }}>
              {filtrarNav(NAV_PRINCIPAL, modulosPermitidos).map(item => (<NavItem key={item.id} item={item} collapsed={false} isActive={activeNav === item.id} onClick={() => navegar(item.id)} />))}
            </nav>
          </>}
          {filtrarNav(NAV_GESTION, modulosPermitidos).length > 0 && <>
            <SectionLabel label="Gestión" collapsed={false} />
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.02rem' }}>
              {filtrarNav(NAV_GESTION, modulosPermitidos).map(item => (<NavItem key={item.id} item={item} collapsed={false} isActive={activeNav === item.id} onClick={() => navegar(item.id)} />))}
            </nav>
          </>}
          {filtrarNav(NAV_SISTEMA, modulosPermitidos).length > 0 && <>
            <SectionLabel label="Sistema" collapsed={false} />
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.02rem' }}>
              {filtrarNav(NAV_SISTEMA, modulosPermitidos).map(item => (<NavItem key={item.id} item={item} collapsed={false} isActive={activeNav === item.id} onClick={() => navegar(item.id)} />))}
            </nav>
          </>}
        </div>
        <div style={{ padding: '0 0.7rem', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 0.5rem 0.6rem', overflow: 'hidden' }}>
            {/* Avatar sidebar usa fotoUrl del context — siempre actualizado */}
            <Avatar initials={initial} fotoUrl={fotoUrl} size={34} radius="10px" fontSize="0.8rem" />
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.83rem', fontWeight: '700', color: 'white', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>{usuario?.rol === 'docente' ? 'Docente' : 'Estudiante'}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.72rem 1rem', justifyContent: 'flex-start', width: '100%', marginBottom: '0.75rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.11)', color: '#fca5a5', fontWeight: '600', fontSize: '0.845rem', fontFamily: 'inherit', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; e.currentTarget.style.color = '#fecaca'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.11)'; e.currentTarget.style.color = '#fca5a5'; }}>
            <span style={{ flexShrink: 0 }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg></span>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, backgroundColor: BG, borderRadius: isMobile ? '0' : '24px 0 0 24px', boxShadow: isMobile ? 'none' : '-4px 0 24px rgba(0,0,0,0.18)', width: isMobile ? '100%' : undefined }}>

        {/* TOPBAR */}
        <header style={{ height: '62px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem 0 1.5rem', boxShadow: '0 1px 0 rgba(0,0,0,0.06)', flexShrink: 0, borderRadius: isMobile ? '0' : '24px 0 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isMobile && (
              <button onClick={() => setMenuAbierto(v => !v)} aria-label="Abrir menú"
                style={{ width: '38px', height: '38px', borderRadius: '10px', border: 'none', background: menuAbierto ? '#eff6ff' : '#f1f5f9', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '8px', flexShrink: 0, transition: 'background 0.15s' }}>
                <span style={{ display: 'block', width: '18px', height: '2px', borderRadius: '2px', background: '#0f172a', transition: 'all 0.2s', transform: menuAbierto ? 'translateY(7px) rotate(45deg)' : 'none' }} />
                <span style={{ display: 'block', width: '18px', height: '2px', borderRadius: '2px', background: '#0f172a', transition: 'all 0.2s', opacity: menuAbierto ? 0 : 1 }} />
                <span style={{ display: 'block', width: '18px', height: '2px', borderRadius: '2px', background: '#0f172a', transition: 'all 0.2s', transform: menuAbierto ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
              </button>
            )}
            <h1 style={{ fontSize: isMobile ? '1rem' : '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '160px' : 'none' }}>{activeLabel}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* ProfileMenu recibe fotoUrl del context — siempre sincronizado */}
            <ProfileMenu userName={userName} usuario={usuario} fotoUrl={fotoUrl} onLogout={handleLogout} onNavegar={navegar} />
          </div>
        </header>

        {/* VISTAS */}
        {activeNav === 'emitidas' && <div style={{ flex: 1, overflowY: 'auto' }}><FacturasEmitidas onNuevoDocumento={(tipo) => {
          if (tipo) {
            if (tipo === 'factura') navegar('nueva_factura');
            else if (tipo === 'nota_credito') navegar('nota_credito');
            else if (tipo === 'nota_debito') navegar('nota_debito');
            else if (tipo === 'retencion') navegar('retencion');
            else if (tipo === 'liquidacion') navegar('liquidacion');
            else if (tipo === 'proforma') navegar('proforma');
          } else { setModalDocumento(true); }
        }} /></div>}
        {activeNav === 'recibidas' && <div style={{ flex: 1, overflowY: 'auto' }}><ComprobantesRecibidos /></div>}
        {activeNav === 'por_emitir' && <div style={{ flex: 1, overflowY: 'auto' }}><FacturasEmitidas filtroInicial="borrador" onNuevoDocumento={(tipo) => {
          if (tipo === 'factura') navegar('nueva_factura');
          else if (tipo === 'nota_credito') navegar('nota_credito');
          else if (tipo === 'nota_debito') navegar('nota_debito');
          else if (tipo === 'retencion') navegar('retencion');
          else if (tipo === 'liquidacion') navegar('liquidacion');
          else if (tipo === 'proforma') navegar('proforma');
        }} /></div>}
        {activeNav === 'reportes' && <div style={{ flex: 1, overflowY: 'auto' }}><Reportes /></div>}
        {activeNav === 'generar_ats' && <div style={{ flex: 1, overflowY: 'auto' }}><GenerarAts /></div>}
        {activeNav === 'ayuda' && <div style={{ flex: 1, overflowY: 'auto' }}><AyudaSoporte /></div>}
        {activeNav === 'doc_estudiantes' && esDocente && <DocEstudiantes />}
        {activeNav === 'doc_tickets'     && esDocente && <DocTickets />}
        {activeNav === 'doc_actividad'   && esDocente && <DocActividad />}
        {activeNav === 'doc_tarifas_iva' && esDocente && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.8rem 2rem', fontFamily: "'Nunito','Segoe UI',sans-serif" }}>
            <GestionTarifasIVA />
          </div>
        )}
        {activeNav === 'nota_credito' && <div style={{ flex: 1, overflowY: 'auto' }}><NotaCredito onVolver={() => navegar('emitidas')} /></div>}
        {activeNav === 'nota_debito' && <div style={{ flex: 1, overflowY: 'auto' }}><NotaDebito onVolver={() => navegar('emitidas')} /></div>}
        {activeNav === 'retencion' && <div style={{ flex: 1, overflowY: 'auto' }}><ComprobanteRetencion onVolver={() => navegar('emitidas')} /></div>}
        {activeNav === 'liquidacion' && <div style={{ flex: 1, overflowY: 'auto' }}><LiquidacionesCompras onVolver={() => navegar('emitidas')} /></div>}
        {activeNav === 'nueva_factura' && <div style={{ flex: 1, overflowY: 'auto' }}><NuevaFactura onVolver={() => navegar('emitidas')} logoNegocio={logoNegocio} /></div>}
        {activeNav === 'clientes' && <div style={{ flex: 1, overflowY: 'auto' }}><GestionClientes /></div>}
        {activeNav === 'productos' && <div style={{ flex: 1, overflowY: 'auto' }}><GestionProductos /></div>}
        {activeNav === 'configuracion' && <div style={{ flex: 1, overflowY: 'auto' }}><ConfiguracionNegocio /></div>}
        {activeNav === 'proforma' && <div style={{ flex: 1, overflowY: 'auto' }}><Proforma onVolver={() => navegar('emitidas')} logoNegocio={logoNegocio} /></div>}
        {activeNav === 'perfil' && <div style={{ flex: 1, overflowY: 'auto' }}><Perfil onVolver={() => navegar('inicio')} onFotoActualizada={handleFotoActualizada} /></div>}

        {/* INICIO */}
        {activeNav === 'inicio' && (
          <main style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '1rem 0.85rem' : '1.4rem 1.5rem' }}>
            {!tourVisto_DASH && <TourBienvenida_DASH onCerrar={cerrarTour_DASH} />}
            {mostrarEdu_DASH && <BannerEdu_DASH onClose={() => setMostrarEdu_DASH(false)} onVerTutorial={verTutorial_DASH} />}
            <BarraModoEdu_DASH onVerTutorial={verTutorial_DASH} />

            {error && <div style={{ marginBottom: '1rem', padding: '0.85rem 1.1rem', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '10px', color: '#b91c1c', fontSize: '0.87rem' }}>⚠️ {error}</div>}

            {/* STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '1.1rem', marginBottom: '1.4rem' }}>
              {[
                { label: 'Facturado este Mes', value: formatMoney(stats?.facturado_mes), change: `${(stats?.variacion_facturado || 0) >= 0 ? '+' : ''}${stats?.variacion_facturado || 0}%`, changeLabel: 'vs mes anterior', color: '#2563eb', bg: '#eff6ff', icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg> },
                { label: 'Comprobantes Emitidos', value: String(stats?.comprobantes_pagados || 0), change: `+${stats?.comprobantes_pagados_mes || 0} este mes`, changeLabel: '', color: '#f59e0b', bg: '#fffbeb', icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg> },
                { label: 'Ingresos Totales', value: formatMoney(stats?.ingresos_totales), change: `${(stats?.variacion_ingresos || 0) >= 0 ? '+' : ''}${stats?.variacion_ingresos || 0}%`, changeLabel: 'vs mes anterior', color: '#10b981', bg: '#ecfdf5', icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
              ].map((stat, i) => (
                <div key={i} style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', animation: `fadeUp 0.5s ease ${i * 0.1}s both` }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.35rem', fontWeight: '600' }}>{stat.label}</p>
                    {loading ? <><Skeleton h="32px" w="120px" radius="6px" /><div style={{ marginTop: '0.5rem' }}><Skeleton h="14px" w="80px" radius="4px" /></div></> : <><h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.4rem', letterSpacing: '-0.5px' }}>{stat.value}</h2><span style={{ fontSize: '0.76rem', color: stat.color, fontWeight: '700' }}>{stat.change} <span style={{ color: '#94a3b8', fontWeight: '400' }}>{stat.changeLabel}</span></span></>}
                  </div>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</div>
                </div>
              ))}
            </div>

            {/* TABLA COMPROBANTES RECIENTES */}
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '1.4rem', animation: 'fadeUp 0.5s ease 0.3s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Comprobantes Recientes</h3>
                  <button onClick={() => navegar('emitidas')} style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb', background: '#eff6ff', border: 'none', borderRadius: '99px', padding: '0.2rem 0.7rem', cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'} onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}>Ver todos →</button>
                </div>
                <button onClick={() => setModalDocumento(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.2rem', borderRadius: '12px', background: 'linear-gradient(90deg,#15389a,#2563eb)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.84rem', fontWeight: '700', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(21,56,154,0.33)', transition: 'all 0.2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(21,56,154,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(21,56,154,0.33)'; }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Nuevo Comprobante
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 108px 110px 100px 110px', padding: '0.5rem 1.4rem', borderBottom: '1px solid #f1f5f9', minWidth: '660px' }}>
                {['Comprobante', 'Cliente', 'Fecha', 'Estado', 'Total', 'Acciones'].map(col => (
                  <span key={col} style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col}</span>
                ))}
              </div>

              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 108px 110px 100px 110px', padding: '0.9rem 1.4rem', alignItems: 'center', borderBottom: i < 3 ? '1px solid #f8fafc' : 'none', gap: '0.5rem', minWidth: '660px' }}>
                  <Skeleton h="14px" w="90px" /><Skeleton h="14px" /><Skeleton h="14px" w="80px" />
                  <Skeleton h="22px" w="80px" radius="99px" /><Skeleton h="14px" w="60px" />
                  <div style={{ display: 'flex', gap: '0.3rem' }}><Skeleton h="26px" w="26px" radius="7px" /><Skeleton h="26px" w="26px" radius="7px" /></div>
                </div>
              ))}

              {!loading && facturas.length === 0 && (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.87rem' }}>No hay facturas aún. ¡Crea la primera!</div>
              )}

              {!loading && facturas.map((f, i) => {
                const est = ESTADO_CONFIG[f.estado?.value || f.estado] || ESTADO_CONFIG.borrador;
                const nombre = f.cliente?.nombres_apellidos || f.cliente?.razon_social || '—';
                const estadoVal = f.estado?.value || f.estado || '';
                const esAnulada = estadoVal === 'anulada';
                const esBorrador = estadoVal === 'borrador';
                const esFinalizada = estadoVal === 'finalizada';

                return (
                  <div key={f.id_factura}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{ display: 'grid', gridTemplateColumns: '130px 1fr 108px 110px 100px 110px', padding: '0.8rem 1.4rem', alignItems: 'center', borderBottom: i < facturas.length - 1 ? '1px solid #f8fafc' : 'none', backgroundColor: hoveredRow === i ? '#f8fafc' : 'transparent', transition: 'background 0.15s', minWidth: '660px' }}>

                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748b', fontFamily: 'monospace' }}>{f.numero_comprobante}</span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <div style={{ width: '29px', height: '29px', borderRadius: '8px', background: COLORS_CLIENTE[i % COLORS_CLIENTE.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.76rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>{nombre.charAt(0).toUpperCase()}</div>
                      <span style={{ fontSize: '0.86rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
                    </div>

                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatFecha(f.fecha_emision)}</span>

                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem', padding: '0.22rem 0.6rem', borderRadius: '99px', backgroundColor: est.bg, color: est.color, fontSize: '0.73rem', fontWeight: '700', width: 'fit-content' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: est.color, display: 'inline-block' }} />{est.label}
                    </span>

                    <span style={{ fontSize: '0.86rem', fontWeight: '700', color: '#0f172a' }}>{formatMoney(f.total)}</span>

                    <div style={{ display: 'flex', gap: '0.28rem', alignItems: 'center' }}>
                      <button title="Ver detalle" onClick={() => abrirVer(f)}
                        style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      </button>

                      <button title={getEditarTooltip(f)} onClick={() => !esAnulada && abrirEditar(f)} disabled={esAnulada}
                        style={{ width: '26px', height: '26px', borderRadius: '7px', border: '1px solid #e2e8f0', background: 'white', cursor: esAnulada ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: esAnulada ? '#cbd5e1' : '#64748b', transition: 'all 0.15s', opacity: esAnulada ? 0.5 : 1 }}
                        onMouseEnter={e => {
                          if (esAnulada) return;
                          if (esBorrador) { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }
                          else { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.color = '#d97706'; }
                        }}
                        onMouseLeave={e => { if (esAnulada) return; e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}>
                        {esBorrador
                          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          : esFinalizada
                            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>{/* cierre overflowX wrapper */}
            </div>

            {/* CHARTS */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 310px', gap: '1.1rem' }}>
              <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', animation: 'fadeUp 0.5s ease 0.6s both' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.3rem' }}>Ingresos — Últimos 6 Meses</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.85rem', height: '130px' }}>
                  {loading ? Array.from({ length: 6 }).map((_, i) => (<div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}><Skeleton h={`${30 + i * 10}%`} w="100%" radius="5px 5px 0 0" /><Skeleton h="10px" w="24px" radius="4px" /></div>))
                    : barData.map((b, i) => (<div key={b.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', height: '100%', justifyContent: 'flex-end' }}><div style={{ width: '100%', borderRadius: '5px 5px 0 0', height: `${Math.max((Number(b.total) / maxBar) * 100, 4)}%`, background: i === barData.length - 1 ? 'linear-gradient(180deg,#15389a,#2563eb)' : 'linear-gradient(180deg,#bfdbfe,#dbeafe)', minHeight: '8px', transition: 'height 0.4s ease' }} /><span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '600' }}>{b.mes}</span></div>))}
                </div>
              </div>
              <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '1.2rem 1.4rem', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', animation: 'fadeUp 0.5s ease 0.7s both' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem' }}>Resumen del Sistema</h3>
                {[
                  { label: 'Facturas este mes', value: loading ? '—' : String(stats?.comprobantes_pagados_mes || 0), color: '#2563eb' },
                  { label: 'Total comprobantes', value: loading ? '—' : String(stats?.comprobantes_pagados || 0), color: '#0ea5e9' },
                  { label: 'Ingresos del mes', value: loading ? '—' : formatMoney(stats?.facturado_mes), color: '#10b981' },
                  { label: 'Ingresos históricos', value: loading ? '—' : formatMoney(stats?.ingresos_totales), color: '#f59e0b' }
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0', borderBottom: '1px solid #f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '3px', backgroundColor: item.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </main>
        )}

        {!SECCIONES_IMPLEMENTADAS.includes(activeNav) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#94a3b8' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '1rem', color: '#64748b' }}>Sección en desarrollo</p>
            <p style={{ margin: 0, fontSize: '0.83rem' }}>Esta funcionalidad estará disponible próximamente</p>
          </div>
        )}
      </div>

      {/* MODAL NUEVO DOCUMENTO */}
      {modalDocumento && (
        <div onClick={() => setModalDocumento(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', animation: 'backdropIn 0.22s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '28px', boxShadow: '0 32px 80px rgba(15,23,42,0.25)', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', animation: 'modalIn 0.3s cubic-bezier(0.34,1.3,0.64,1) both' }}>
            <VistaDocumentos
              onSeleccionar={(tipo) => {
                setModalDocumento(false);
                if (tipo === 'factura') navegar('nueva_factura');
                if (tipo === 'nota_credito') navegar('nota_credito');
                if (tipo === 'nota_debito') navegar('nota_debito');
                if (tipo === 'retencion') navegar('retencion');
                if (tipo === 'liquidacion') navegar('liquidacion');
                if (tipo === 'proforma') navegar('proforma');
              }}
              onCerrar={() => setModalDocumento(false)}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tourFadeIn{ from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tourPopIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
        @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dropIn    { from{opacity:0;transform:translateY(-8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes backdropIn{ from{opacity:0} to{opacity:1} }
        @keyframes modalIn   { from{opacity:0;transform:translateY(28px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes popIn     { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
        aside div::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
};

export default Dashboard;
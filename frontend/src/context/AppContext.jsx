// src/context/AppContext.jsx
// ─────────────────────────────────────────────────────────
// Context global liviano que comparte entre componentes:
//   • fotoUrl     — foto de perfil del usuario (avatar en header)
//   • logoNegocio — logo del negocio (se usa en facturas y vista previa)
//
// De esta manera, cuando el usuario sube o elimina el logo desde
// Configuración, el Dashboard (y cualquier componente que use el
// context) se actualiza SIN necesidad de recargar la página.
// ─────────────────────────────────────────────────────────
import React, { createContext, useState, useEffect } from 'react';

const API_BASE = 'https://factustock-efdi.onrender.com';
const getToken = () => localStorage.getItem('token');

export const AppContext = createContext({
  fotoUrl:       null,
  setFotoUrl:    () => {},
  logoNegocio:   null,
  setLogoNegocio:() => {},
});

export const AppProvider = ({ children }) => {
  const [fotoUrl,      setFotoUrl]      = useState(null);
  const [logoNegocio,  setLogoNegocio]  = useState(null);

  // Carga inicial: foto de perfil y logo del negocio
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Cargar foto de perfil
    fetch(`${API_BASE}/api/perfil/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.foto_url) setFotoUrl(data.foto_url);
      })
      .catch(() => {});

    // Cargar logo del negocio
    fetch(`${API_BASE}/api/negocio/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.logo_url) setLogoNegocio(data.logo_url);
      })
      .catch(() => {});
  }, []);

  return (
    <AppContext.Provider value={{ fotoUrl, setFotoUrl, logoNegocio, setLogoNegocio }}>
      {children}
    </AppContext.Provider>
  );
};
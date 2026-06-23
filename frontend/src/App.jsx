import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ModuleSelector from './components/ModuleSelector';
import NuevaFactura from './components/NuevaFactura';
import { authService } from './services/api';

/* ──────────────────────────────────────────────────────────
   ProtectedRoute — verifica autenticación
──────────────────────────────────────────────────────────── */
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Raíz → Dashboard (docente y estudiante van al mismo) */}
        <Route path="/"            element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/facturacion" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/docente"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

        {/* Nueva factura */}
        <Route path="/facturacion/nueva-factura" element={<ProtectedRoute><NuevaFactura /></ProtectedRoute>} />

        {/* Selector de módulos */}
        <Route path="/modulos" element={<ProtectedRoute><ModuleSelector /></ProtectedRoute>} />

        {/* Cualquier ruta desconocida → Dashboard */}
        <Route path="*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
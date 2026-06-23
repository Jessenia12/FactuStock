import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────
export const authService = {
  login: async (usuario, password, recordarme = false) => {
    try {
      const response = await api.post('/auth/login', { usuario, password, recordarme });
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('usuario', JSON.stringify(response.data.usuario));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  logout: async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) await api.post('/auth/logout', { token });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }
  },
  verifyToken: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const response = await api.get('/auth/verify', { params: { token } });
      return response.data;
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      return null;
    }
  },
  getCurrentUser: () => {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
  },
  isAuthenticated: () => !!localStorage.getItem('token'),
};

// ─── Dashboard ────────────────────────────────────────────
export const dashboardService = {
  getStats: async () => {
    const response = await api.get('/dashboard/');
    return response.data;
  },
};

// ─── Clientes ─────────────────────────────────────────────
export const clientesService = {
  listar: async ({ pagina = 1, porPagina = 200, buscar } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (buscar) params.buscar = buscar;
    const response = await api.get('/clientes/', { params });
    return response.data;
  },
  obtener: async (id) => {
    const response = await api.get(`/clientes/${id}`);
    return response.data;
  },
  crear: async (datos) => {
    const response = await api.post('/clientes/', datos);
    return response.data;
  },
  actualizar: async (id, datos) => {
    const response = await api.put(`/clientes/${id}`, datos);
    return response.data;
  },
  eliminar: async (id) => {
    await api.delete(`/clientes/${id}`, { responseType: 'text' });
  },
};

// ─── Productos ────────────────────────────────────────────
export const productosService = {
  listar: async ({ pagina = 1, por_pagina = 6, buscar, solo_con_stock = false } = {}) => {
    const params = { pagina, por_pagina };
    if (buscar)         params.buscar        = buscar;
    if (solo_con_stock) params.solo_con_stock = true;
    const response = await api.get('/productos/', { params });
    return response.data;
  },
  obtener: async (id) => {
    const response = await api.get(`/productos/${id}`);
    return response.data;
  },
  crear: async (datos) => {
    const response = await api.post('/productos/', datos);
    return response.data;
  },
  actualizar: async (id, datos) => {
    const response = await api.put(`/productos/${id}`, datos);
    return response.data;
  },
  eliminar: async (id) => {
    await api.delete(`/productos/${id}`, { responseType: 'text' });
  },
};

// ─── Facturas ─────────────────────────────────────────────
export const facturasService = {
  listar: async ({ pagina = 1, porPagina = 10, estado, fechaDesde, fechaHasta, buscar, busqueda } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (estado)             params.estado      = estado;
    if (fechaDesde)         params.fecha_desde = fechaDesde;
    if (fechaHasta)         params.fecha_hasta = fechaHasta;
    if (buscar || busqueda) params.buscar      = buscar || busqueda;
    const response = await api.get('/facturas/', { params });
    return response.data;
  },
  obtener: async (id) => {
    const response = await api.get(`/facturas/${id}`);
    return response.data;
  },
  crear: async (datos) => {
    const response = await api.post('/facturas/', datos);
    return response.data;
  },
  actualizarEstado: async (id, estado, observaciones) => {
    const response = await api.patch(`/facturas/${id}`, { estado, observaciones });
    return response.data;
  },
  eliminar: async (id) => {
    await api.delete(`/facturas/${id}`, { responseType: 'text' });
  },
};

// ─── Negocio ──────────────────────────────────────────────
export const negocioService = {
  obtener: async () => {
    const response = await api.get('/negocio/');
    return response.data;
  },
  guardar: async (datos) => {
    const response = await api.put('/negocio/', datos);
    return response.data;
  },
};

// ─── Comprobantes Recibidos ───────────────────────────────
export const comprobantesRecibidosService = {
  listar: async ({ pagina = 1, porPagina = 10, estado, tipo, fechaDesde, fechaHasta, buscar } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (estado)     params.estado      = estado;
    if (tipo)       params.tipo        = tipo;
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    if (buscar)     params.buscar      = buscar;
    const r = await api.get('/comprobantes-recibidos/', { params });
    return r.data;
  },
  obtener: async (id) => {
    const r = await api.get(`/comprobantes-recibidos/${id}`);
    return r.data;
  },
  crear: async (datos) => {
    const r = await api.post('/comprobantes-recibidos/', datos);
    return r.data;
  },
  actualizar: async (id, datos) => {
    const r = await api.put(`/comprobantes-recibidos/${id}`, datos);
    return r.data;
  },
  eliminar: async (id) => {
    await api.delete(`/comprobantes-recibidos/${id}`, { responseType: 'text' });
  },
};

// ─── Reportes ─────────────────────────────────────────────
export const reportesService = {
  resumenGeneral: async ({ fechaDesde, fechaHasta } = {}) => {
    const params = {};
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const r = await api.get('/reportes/resumen-general', { params });
    return r.data;
  },
  ventasPorMes: async ({ fechaDesde, fechaHasta } = {}) => {
    const params = {};
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const r = await api.get('/reportes/ventas-por-mes', { params });
    return r.data;
  },
  topClientes: async ({ fechaDesde, fechaHasta, limite = 10 } = {}) => {
    const params = { limite };
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const r = await api.get('/reportes/top-clientes', { params });
    return r.data;
  },
  topProductos: async ({ fechaDesde, fechaHasta, limite = 10 } = {}) => {
    const params = { limite };
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const r = await api.get('/reportes/top-productos', { params });
    return r.data;
  },
  libroVentas: async ({ fechaDesde, fechaHasta, pagina = 1, porPagina = 200 } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const r = await api.get('/reportes/libro-ventas', { params });
    return r.data;
  },
  ivaDetalle: async ({ fechaDesde, fechaHasta } = {}) => {
    const params = {};
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    const r = await api.get('/reportes/iva-detalle', { params });
    return r.data;
  },
};

// ─── Notas de Crédito ─────────────────────────────────────
export const notasCreditoService = {
  listar: async ({ pagina = 1, porPagina = 10, estado, idFactura, buscar } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (estado)    params.estado     = estado;
    if (idFactura) params.id_factura = idFactura;
    if (buscar)    params.buscar     = buscar;
    const r = await api.get('/notas-credito/', { params });
    return r.data;
  },
  obtener: async (id) => {
    const r = await api.get(`/notas-credito/${id}`);
    return r.data;
  },
  crear: async (datos) => {
    const r = await api.post('/notas-credito/', datos);
    return r.data;
  },
  anular: async (id) => {
    const r = await api.patch(`/notas-credito/${id}/anular`);
    return r.data;
  },
};

// ─── Notas de Débito ──────────────────────────────────────
export const notasDebitoService = {
  listar: async ({ pagina = 1, porPagina = 10, estado, idFactura, buscar } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (estado)    params.estado     = estado;
    if (idFactura) params.id_factura = idFactura;
    if (buscar)    params.buscar     = buscar;
    const r = await api.get('/notas-debito/', { params });
    return r.data;
  },
  obtener: async (id) => {
    const r = await api.get(`/notas-debito/${id}`);
    return r.data;
  },
  crear: async (datos) => {
    const r = await api.post('/notas-debito/', datos);
    return r.data;
  },
  anular: async (id) => {
    const r = await api.patch(`/notas-debito/${id}/anular`);
    return r.data;
  },
};

// ─── Retenciones ──────────────────────────────────────────
export const retencionesService = {
  listar: async ({ pagina = 1, porPagina = 10, estado, buscar } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (estado) params.estado = estado;
    if (buscar) params.buscar = buscar;
    const r = await api.get('/retenciones/', { params });
    return r.data;
  },
  obtener: async (id) => {
    const r = await api.get(`/retenciones/${id}`);
    return r.data;
  },
  crear: async (datos) => {
    const r = await api.post('/retenciones/', datos);
    return r.data;
  },
  anular: async (id) => {
    const r = await api.patch(`/retenciones/${id}/anular`);
    return r.data;
  },
};

// ─── Proformas ─────────────────────────────────────────────
export const proformasService = {
  listar: async ({ pagina = 1, porPagina = 10, estado, fechaDesde, fechaHasta, buscar } = {}) => {
    const params = { pagina, por_pagina: porPagina };
    if (estado)     params.estado      = estado;
    if (fechaDesde) params.fecha_desde = fechaDesde;
    if (fechaHasta) params.fecha_hasta = fechaHasta;
    if (buscar)     params.buscar      = buscar;
    const response = await api.get('/proformas/', { params });
    return response.data;
  },
  obtener: async (id) => {
    const response = await api.get(`/proformas/${id}`);
    return response.data;
  },
  crear: async (datos) => {
    const response = await api.post('/proformas/', datos);
    return response.data;
  },
  actualizar: async (id, datos) => {
    const response = await api.patch(`/proformas/${id}`, datos);
    return response.data;
  },
  eliminar: async (id) => {
    await api.delete(`/proformas/${id}`, { responseType: 'text' });
  },
};

export default api;

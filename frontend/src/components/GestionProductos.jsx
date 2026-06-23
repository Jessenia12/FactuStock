import React, { useState, useEffect, useRef } from 'react';
import { productosService } from '../services/api';
import * as XLSX from 'xlsx';
import ReactDOM from 'react-dom';

const _getTourKey_PROD = (uid) => `prod_tour_visto_${uid || 'default'}`;

const API      = 'http://localhost:8000/api';
const getToken = () => localStorage.getItem('token');

const BLUE     = '#15389a';
const BLUE_MID = '#2563eb';

const IVA_DEFAULT = 15;

// Tarifas IVA por defecto (se sobreescriben con los datos del API)
const TARIFAS_IVA_DEFAULT = [
  { valor: 0,  label: '0%',  descripcion: 'Tarifa 0% — bienes y servicios exentos de IVA' },
  { valor: 5,  label: '5%',  descripcion: 'Tarifa 5% — bienes de primera necesidad' },
  { valor: 15, label: '15%', descripcion: 'Tarifa 15% — tarifa general vigente' },
];

const inputStyle = (error) => ({
  padding: '0.62rem 0.85rem',
  border: `1.5px solid ${error ? '#ef4444' : '#e2e8f0'}`,
  borderRadius: '10px', fontSize: '0.88rem', color: '#0f172a',
  outline: 'none', fontFamily: 'inherit', background: 'white',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
});

const Field = ({ label, required, children, error, hint }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>
      {label}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
    </label>
    {children}
    {hint && !error && <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '1px' }}>{hint}</span>}
    {error && <span style={{ fontSize: '0.72rem', color: '#ef4444' }}>{error}</span>}
  </div>
);

const fmtMoney = (v) =>
  '$' + parseFloat(v || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPTY_FORM = {
  codigo: '', nombre: '', descripcion: '', precio_unitario: '',
  porcentaje_iva: IVA_DEFAULT, id_categoria: '', stock_inicial: 0,
};

const PaginBtn = ({ children, onClick, disabled, active }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      minWidth: '32px', height: '32px', padding: '0 6px', borderRadius: '8px',
      border: '1.5px solid', fontSize: '0.78rem', fontWeight: '700',
      fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
      borderColor: active ? BLUE : '#e2e8f0',
      background:  active ? `linear-gradient(135deg,${BLUE},${BLUE_MID})` : disabled ? '#f8fafc' : 'white',
      color:       active ? 'white' : disabled ? '#cbd5e1' : '#64748b',
    }}>
    {children}
  </button>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 100,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '580px',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.2)', animation: 'fadeUp 0.25s ease',
                    maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '1.4rem 1.6rem', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>{title}</h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px',
                                             width: '32px', height: '32px', cursor: 'pointer',
                                             display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ padding: '1.4rem 1.6rem' }}>{children}</div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------
// Formulario de producto — recibe tarifasIVA como prop
// --------------------------------------------------------------
const FormProducto = ({ inicial, onGuardar, onCancelar, loading, error, tarifasIVA }) => {
  const esEdicion = !!inicial;
  const stockActual = esEdicion ? (inicial.stock ?? 0) : 0;

  const [form, setForm] = useState(() => inicial ? {
    codigo:          inicial.codigo          || '',
    nombre:          inicial.nombre          || '',
    descripcion:     inicial.descripcion     || '',
    precio_unitario: inicial.precio_unitario != null ? String(inicial.precio_unitario) : '',
    porcentaje_iva:  inicial.porcentaje_iva  != null ? parseFloat(inicial.porcentaje_iva) : IVA_DEFAULT,
    id_categoria:    inicial.id_categoria    || '',
    ajuste_stock:    0,
  } : { ...EMPTY_FORM });

  const [errores, setErrores] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const nuevoTotal = esEdicion
    ? stockActual + (parseInt(form.ajuste_stock) || 0)
    : null;

  const colorNuevoTotal = nuevoTotal === null ? '#0f172a'
    : nuevoTotal < 0   ? '#ef4444'
    : nuevoTotal === 0 ? '#f59e0b'
    : '#16a34a';

  const bgNuevoTotal = nuevoTotal === null ? '#f1f5f9'
    : nuevoTotal < 0   ? '#fef2f2'
    : nuevoTotal === 0 ? '#fffbeb'
    : '#f0fdf4';

  const borderNuevoTotal = nuevoTotal === null ? '#e2e8f0'
    : nuevoTotal < 0   ? '#fecaca'
    : nuevoTotal === 0 ? '#fde68a'
    : '#bbf7d0';

  const validar = () => {
    const e = {};
    if (!form.codigo.trim()) e.codigo = 'Requerido';
    if (!form.nombre.trim()) e.nombre = 'Requerido';
    if (!form.precio_unitario || parseFloat(form.precio_unitario) <= 0) e.precio = 'Debe ser mayor a 0';
    if (esEdicion && nuevoTotal < 0) e.ajuste = 'El stock no puede quedar negativo';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const precioConIva = form.precio_unitario && parseFloat(form.precio_unitario) > 0
    ? parseFloat(form.precio_unitario) * (1 + parseFloat(form.porcentaje_iva) / 100)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca',
                      borderRadius: '10px', color: '#b91c1c', fontSize: '0.83rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Código" required error={errores.codigo}>
          <input value={form.codigo} onChange={e => set('codigo', e.target.value)}
            placeholder="Ej: PROD-001" style={inputStyle(errores.codigo)}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = errores.codigo ? '#ef4444' : '#e2e8f0'} />
        </Field>

        <Field label="IVA %" required>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {tarifasIVA.map(t => {
              const activa = Math.abs(form.porcentaje_iva - t.valor) < 0.001;
              const color = t.valor === 0
                ? { p: '#059669', ll: '#ecfdf5', b: '#6ee7b7' }
                : t.valor <= 5
                ? { p: '#0891b2', ll: '#ecfeff', b: '#67e8f9' }
                : t.valor <= 12
                ? { p: '#d97706', ll: '#fffbeb', b: '#fcd34d' }
                : { p: '#15389a', ll: '#eff6ff', b: '#93c5fd' };
              return (
                <button key={t.valor} type="button"
                  onClick={() => set('porcentaje_iva', t.valor)}
                  title={t.descripcion}
                  style={{ padding: '0.42rem 0.9rem', borderRadius: '99px', border: `1.5px solid ${activa ? color.b : '#e2e8f0'}`, background: activa ? color.ll : 'white', color: activa ? color.p : '#64748b', fontWeight: activa ? '800' : '600', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: activa ? `0 0 0 3px ${color.b}40` : 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {activa && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  {t.label}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px', display: 'block' }}>
            {tarifasIVA.find(t => Math.abs(t.valor - form.porcentaje_iva) < 0.001)?.descripcion || 'Tarifa SRI vigente'}
          </span>
        </Field>

        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Nombre del Producto" required error={errores.nombre}>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Nombre descriptivo del producto" style={inputStyle(errores.nombre)}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = errores.nombre ? '#ef4444' : '#e2e8f0'} />
          </Field>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Descripción">
            <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Descripción adicional (opcional)" style={inputStyle(false)}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
          </Field>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Precio Unitario ($)" required error={errores.precio}>
            <input type="number" min="0" step="0.01" value={form.precio_unitario}
              onChange={e => set('precio_unitario', e.target.value)}
              placeholder="0.00" style={inputStyle(errores.precio)}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = errores.precio ? '#ef4444' : '#e2e8f0'} />
            {precioConIva && (
              <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                Con IVA ({form.porcentaje_iva}%): <strong style={{ color: '#0f172a' }}>{fmtMoney(precioConIva)}</strong>
              </span>
            )}
          </Field>
        </div>

        {!esEdicion && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Stock Inicial" hint="Cantidad de unidades disponibles al registrar el producto. Puedes dejarlo en 0 y ajustarlo después.">
              <input type="number" min="0" value={form.stock_inicial}
                onChange={e => set('stock_inicial', parseInt(e.target.value) || 0)}
                style={inputStyle(false)}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </Field>
          </div>
        )}

        {esEdicion && (
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>📦 Ajuste de Stock</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: '0.5rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Stock actual</span>
                  <div style={{ padding: '0.62rem 0.85rem', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>{stockActual}</div>
                </div>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#cbd5e1', paddingBottom: '0.62rem', textAlign: 'center' }}>+</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ajuste <span style={{ fontWeight: '400', textTransform: 'none' }}>(+ o -)</span></span>
                  <input type="number" value={form.ajuste_stock} onChange={e => set('ajuste_stock', parseInt(e.target.value) || 0)} placeholder="0"
                    style={{ ...inputStyle(!!errores.ajuste), textAlign: 'center', fontWeight: '700', fontSize: '1rem' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = errores.ajuste ? '#ef4444' : '#e2e8f0'} />
                </div>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#cbd5e1', paddingBottom: '0.62rem', textAlign: 'center' }}>=</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Nuevo total</span>
                  <div style={{ padding: '0.62rem 0.85rem', background: bgNuevoTotal, border: `1.5px solid ${borderNuevoTotal}`, borderRadius: '10px', fontSize: '1rem', fontWeight: '800', color: colorNuevoTotal, textAlign: 'center', transition: 'all 0.2s' }}>{nuevoTotal}</div>
                </div>
              </div>
              {errores.ajuste
                ? <span style={{ fontSize: '0.72rem', color: '#ef4444' }}>⚠️ {errores.ajuste}</span>
                : <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Positivo para agregar, negativo para restar. Deja en <strong>0</strong> si no cambias stock.</span>
              }
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0.65rem 0.9rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', fontSize: '0.78rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        📋 Los movimientos detallados de inventario se gestionan desde el módulo <strong>Inventario</strong>.
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
        <button onClick={onCancelar} disabled={loading}
          style={{ padding: '0.65rem 1.2rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '600', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={() => { if (validar()) onGuardar(form); }} disabled={loading}
          style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', border: 'none', background: `linear-gradient(90deg,${BLUE},${BLUE_MID})`, color: 'white', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {loading ? 'Guardando...' : '✓ Guardar Producto'}
        </button>
      </div>
    </div>
  );
};

// --------------------------------------------------------------
// MODAL IMPORTAR PRODUCTOS
// --------------------------------------------------------------
const ModalImportarProductos = ({ open, onClose, onImportado }) => {
  const [paso, setPaso]                     = useState('formato');
  const [preview, setPreview]               = useState([]);
  const [erroresPreview, setErroresPreview] = useState([]);
  const [resultado, setResultado]           = useState(null);
  const [dragOver, setDragOver]             = useState(false);
  const [archivoNombre, setArchivoNombre]   = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPaso('formato'); setPreview([]); setErroresPreview([]);
        setResultado(null); setArchivoNombre('');
      }, 300);
    }
  }, [open]);

  const descargarPlantilla = () => {
    const PLANTILLA_HEADERS = ['Código','Nombre','Descripción','Precio Unitario','IVA %','Stock Inicial','Stock Mínimo','Categoría (ID)'];
    const data = [
      PLANTILLA_HEADERS,
      ['PROD001', 'Producto Ejemplo 1', 'Descripción opcional', '10.50', '15', '100', '5', ''],
      ['PROD002', 'Producto Ejemplo 2', '', '25.00', '0', '50', '10', ''],
      ['PROD003', 'Producto Ejemplo 3', 'Producto con IVA reducido', '99.99', '5', '20', '3', ''],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:12},{wch:30},{wch:25},{wch:14},{wch:8},{wch:10},{wch:12},{wch:15}];
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  };

  const procesarArchivo = (file) => {
    if (!file) return;
    const esCSV  = file.name.toLowerCase().endsWith('.csv');
    const esXLSX = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    if (!esCSV && !esXLSX) { setErroresPreview(['Solo se aceptan archivos .CSV o .XLSX']); setPaso('subir'); return; }
    if (file.size > 2 * 1024 * 1024) { setErroresPreview(['El archivo supera el límite de 2 MB']); setPaso('subir'); return; }
    setArchivoNombre(file.name);
    const reader = new FileReader();
    if (esCSV) {
      reader.onload = (e) => { const { filas, errores } = parsearCSVProductos(e.target.result); setPreview(filas); setErroresPreview(errores); setPaso('preview'); };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = (e) => { const { filas, errores } = parsearXLSXProductos(e.target.result); setPreview(filas); setErroresPreview(errores); setPaso('preview'); };
      reader.readAsArrayBuffer(file);
    }
  };

  const parseCSVLine = (line) => {
    const result = []; let inQuote = false; let current = ''; let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === '"') { if (inQuote && line[i+1] === '"') { current += '"'; i += 2; continue; } inQuote = !inQuote; i++; continue; }
      if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; i++; continue; }
      current += ch; i++;
    }
    result.push(current.trim()); return result;
  };

  const normalizarEncabezado = (h) =>
    h.toLowerCase().trim().replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u').replace(/ü/g,'u').replace(/ñ/g,'n');

  const LABEL_TO_KEY = {
    'codigo':'codigo','código':'codigo','nombre':'nombre','descripcion':'descripcion','descripción':'descripcion',
    'precio unitario':'precio_unitario','iva %':'porcentaje_iva','iva':'porcentaje_iva',
    'stock inicial':'stock_inicial','stock mínimo':'stock_minimo','categoría (id)':'id_categoria','categoria (id)':'id_categoria','categoria':'id_categoria'
  };

  const validarFilaProducto = (raw, numFila, errores) => {
    const codigo = (raw.codigo || '').trim(); const nombre = (raw.nombre || '').trim();
    const precio = parseFloat(raw.precio_unitario); const iva = parseInt(raw.porcentaje_iva);
    const stockInicial = parseInt(raw.stock_inicial) || 0; const stockMinimo = parseInt(raw.stock_minimo) || 5;
    const idCategoria = raw.id_categoria ? parseInt(raw.id_categoria) : null;
    let error = false;
    if (!codigo) { errores.push(`Fila ${numFila}: Código es obligatorio`); error = true; }
    if (!nombre) { errores.push(`Fila ${numFila}: Nombre es obligatorio`); error = true; }
    if (isNaN(precio) || precio <= 0) { errores.push(`Fila ${numFila}: Precio unitario debe ser un número mayor a 0`); error = true; }
    if (isNaN(iva) || iva < 0 || iva > 100) { errores.push(`Fila ${numFila}: IVA % debe ser un número entre 0 y 100`); error = true; }
    if (stockInicial < 0) { errores.push(`Fila ${numFila}: Stock inicial no puede ser negativo`); error = true; }
    if (stockMinimo < 0) { errores.push(`Fila ${numFila}: Stock mínimo no puede ser negativo`); error = true; }
    return { codigo, nombre, descripcion: (raw.descripcion || '').trim(), precio_unitario: precio, porcentaje_iva: iva, stock: stockInicial, stock_minimo: stockMinimo, id_categoria: idCategoria, _error: error };
  };

  const parsearCSVProductos = (texto) => {
    if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
    const lineas = texto.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lineas.length < 2) return { filas: [], errores: ['El archivo no tiene datos'] };
    const encabezados = parseCSVLine(lineas[0]);
    const encabezadosNorm = encabezados.map(normalizarEncabezado);
    const colMap = {};
    encabezadosNorm.forEach((h, idx) => { if (LABEL_TO_KEY[h]) colMap[LABEL_TO_KEY[h]] = idx; });
    const faltantes = ['codigo','nombre','precio_unitario'].filter(r => colMap[r] === undefined);
    if (faltantes.length > 0) return { filas: [], errores: [`Columnas faltantes: ${faltantes.join(', ')}. Usa la plantilla.`] };
    const filas = [], errores = [];
    for (let i = 1; i < lineas.length; i++) {
      const cols = parseCSVLine(lineas[i]); const raw = {};
      Object.keys(colMap).forEach(key => { raw[key] = cols[colMap[key]] || ''; });
      filas.push(validarFilaProducto(raw, i+1, errores));
    }
    return { filas, errores };
  };

  const parsearXLSXProductos = (buffer) => {
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      if (rows.length === 0) return { filas: [], errores: ['La hoja de Excel está vacía'] };
      const filas = [], errores = [];
      rows.forEach((row, i) => {
        const rawNorm = {};
        Object.keys(row).forEach(k => { rawNorm[normalizarEncabezado(k)] = row[k]; });
        const getField = (campo) => {
          const variantes = Object.keys(LABEL_TO_KEY).filter(k => LABEL_TO_KEY[k] === campo);
          for (const v of variantes) { const vn = normalizarEncabezado(v); if (rawNorm[vn] !== undefined && rawNorm[vn] !== '') return rawNorm[vn]; }
          return '';
        };
        const raw = { codigo: getField('codigo'), nombre: getField('nombre'), descripcion: getField('descripcion'), precio_unitario: getField('precio_unitario'), porcentaje_iva: getField('porcentaje_iva'), stock_inicial: getField('stock_inicial'), stock_minimo: getField('stock_minimo'), id_categoria: getField('id_categoria') };
        filas.push(validarFilaProducto(raw, i+2, errores));
      });
      return { filas, errores };
    } catch (err) { return { filas: [], errores: [`No se pudo leer el Excel: ${err.message}`] }; }
  };

  const confirmarImportacion = async () => {
    const filasValidas = preview.filter(f => !f._error);
    if (filasValidas.length === 0) return;
    setPaso('importando');
    let importados = 0, fallidos = 0; const detallesFallos = [];
    for (const fila of filasValidas) {
      try {
        const payload = [{ codigo: fila.codigo, nombre: fila.nombre, descripcion: fila.descripcion || null, precio_unitario: Number(fila.precio_unitario), porcentaje_iva: Number(fila.porcentaje_iva), stock: Number(fila.stock) || 0, stock_minimo: Number(fila.stock_minimo) || 5, id_categoria: fila.id_categoria || null }];
        const resp = await fetch(`${API}/productos/importar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(payload) });
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          if (data.creados > 0) { importados++; } else { fallidos++; detallesFallos.push({ codigo: fila.codigo, nombre: fila.nombre, msg: data.errores?.[0]?.error || 'No se pudo importar' }); }
        } else {
          let errorMsg = `Error HTTP ${resp.status}`;
          try { const data = await resp.json(); errorMsg = Array.isArray(data.detail) ? data.detail.map(e => e.msg || JSON.stringify(e)).join(' / ') : data.detail || errorMsg; } catch (_) {}
          fallidos++; detallesFallos.push({ codigo: fila.codigo, nombre: fila.nombre, msg: errorMsg });
        }
      } catch (_) { fallidos++; detallesFallos.push({ codigo: fila.codigo, nombre: fila.nombre, msg: 'Error de conexión' }); }
    }
    setResultado({ importados, fallidos, detallesFallos, totalLeidos: preview.length, erroresPrevios: preview.filter(f => f._error).length });
    setPaso('resultado');
    if (importados > 0) onImportado();
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); procesarArchivo(e.dataTransfer.files[0]); };

  if (!open) return null;
  const filasValidas  = preview.filter(f => !f._error).length;
  const filasConError = preview.filter(f => f._error).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: paso === 'preview' ? '820px' : '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', animation: 'popIn 0.25s cubic-bezier(0.34,1.4,0.64,1)' }}>
        <div style={{ padding: '1.2rem 1.5rem', background: `linear-gradient(135deg,${BLUE},${BLUE_MID})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>Importar Productos</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
                {paso === 'formato' && 'Descarga la plantilla y completa tus datos'}
                {paso === 'subir' && 'Sube tu archivo XLSX'}
                {paso === 'preview' && `${preview.length} filas encontradas — revisa antes de importar`}
                {paso === 'importando' && 'Procesando importación...'}
                {paso === 'resultado' && 'Importación completada'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', color: 'white' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        {['formato','subir','preview'].includes(paso) && (
          <div style={{ display: 'flex', padding: '0.85rem 1.5rem', borderBottom: '1px solid #f1f5f9', gap: '0.5rem', alignItems: 'center', flexShrink: 0, background: '#fafbfc' }}>
            {[{ key:'formato', num:1, label:'Plantilla' },{ key:'subir', num:2, label:'Subir archivo' },{ key:'preview', num:3, label:'Revisar' }].map((s, i, arr) => {
              const orden = ['formato','subir','preview']; const activo = s.key === paso; const completado = orden.indexOf(s.key) < orden.indexOf(paso);
              return (
                <React.Fragment key={s.key}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <div style={{ width:'24px', height:'24px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:'800', background: completado?'#10b981':activo?BLUE_MID:'#e2e8f0', color:(completado||activo)?'white':'#94a3b8' }}>{completado?'✓':s.num}</div>
                    <span style={{ fontSize:'0.77rem', fontWeight:activo?'800':'600', color:activo?'#0f172a':completado?'#10b981':'#94a3b8' }}>{s.label}</span>
                  </div>
                  {i < arr.length-1 && <div style={{ flex:1, height:'1px', background:completado?'#10b981':'#e2e8f0' }} />}
                </React.Fragment>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.4rem 1.5rem' }}>
          {paso === 'formato' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem' }}>
              <div style={{ background:'#eff6ff', borderRadius:'14px', padding:'1rem 1.2rem', border:'1px solid #bfdbfe' }}>
                <p style={{ margin:'0 0 0.6rem', fontSize:'0.82rem', fontWeight:'800', color:'#1d4ed8' }}>📋 Importación de Productos — consideraciones</p>
                <ol style={{ margin:0, paddingLeft:'1.2rem', fontSize:'0.78rem', color:'#1e40af', lineHeight:1.8 }}>
                  <li>El archivo debe ser <strong>.CSV</strong> o <strong>.XLSX</strong> (máximo 2 MB).</li>
                  <li><strong>Código</strong> y <strong>Nombre</strong> son obligatorios y no pueden repetirse.</li>
                  <li><strong>Precio Unitario</strong> debe ser un número mayor a 0.</li>
                  <li><strong>IVA %</strong> debe ser 0, 5 o 15.</li>
                  <li><strong>Stock Inicial</strong> y <strong>Stock Mínimo</strong> son números enteros no negativos.</li>
                  <li>La columna <strong>Categoría (ID)</strong> es opcional.</li>
                  <li>No modifiques los encabezados de la plantilla.</li>
                </ol>
              </div>
              <div style={{ display:'flex', gap:'0.75rem' }}>
                <button onClick={descargarPlantilla} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', padding:'0.75rem', borderRadius:'12px', border:'1.5px solid #10b981', background:'#ecfdf5', color:'#059669', fontWeight:'700', fontSize:'0.87rem', cursor:'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Descargar plantilla Excel (XLSX)
                </button>
                <button onClick={() => setPaso('subir')} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', padding:'0.75rem', borderRadius:'12px', border:'none', background:`linear-gradient(90deg,${BLUE},${BLUE_MID})`, color:'white', fontWeight:'700', fontSize:'0.87rem', cursor:'pointer' }}>Tengo mi archivo listo →</button>
              </div>
            </div>
          )}

          {paso === 'subir' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}
                style={{ border:`2px dashed ${dragOver?BLUE_MID:'#cbd5e1'}`, borderRadius:'16px', padding:'3rem 1.5rem', textAlign:'center', cursor:'pointer', background:dragOver?'#eff6ff':'#f8fafc', transition:'all 0.2s' }}>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:'none' }} onChange={e=>procesarArchivo(e.target.files[0])} />
                <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:dragOver?'#dbeafe':'#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={dragOver?BLUE_MID:'#94a3b8'} strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <p style={{ margin:'0 0 0.3rem', fontSize:'0.95rem', fontWeight:'800', color:dragOver?'#1d4ed8':'#334155' }}>{dragOver?'Suelta el archivo aquí':'Arrastra tu archivo aquí'}</p>
                <p style={{ margin:0, fontSize:'0.82rem', color:'#94a3b8' }}>o haz clic para seleccionar · <strong>.CSV</strong> o <strong>.XLSX</strong> · máx. 2 MB</p>
              </div>
              {erroresPreview.length > 0 && (
                <div style={{ background:'#fef2f2', borderRadius:'10px', padding:'0.75rem 1rem', border:'1px solid #fecaca' }}>
                  {erroresPreview.map((e,i) => <p key={i} style={{ margin:'0.1rem 0', fontSize:'0.78rem', color:'#dc2626' }}>⚠️ {e}</p>)}
                </div>
              )}
              <button onClick={()=>setPaso('formato')} style={{ background:'none', border:'none', color:'#94a3b8', fontSize:'0.82rem', cursor:'pointer', textDecoration:'underline', alignSelf:'center' }}>← Volver a las instrucciones</button>
            </div>
          )}

          {paso === 'preview' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {archivoNombre && <div style={{ padding:'0.5rem 0.85rem', background:'#f8fafc', borderRadius:'8px', border:'1px solid #e2e8f0', fontSize:'0.78rem', fontWeight:'600' }}>📄 {archivoNombre}</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.7rem' }}>
                {[{ label:'Total leídos', value:preview.length, color:BLUE_MID, bg:'#eff6ff' },{ label:'Válidos', value:filasValidas, color:'#10b981', bg:'#ecfdf5' },{ label:'Con errores', value:filasConError, color:filasConError>0?'#ef4444':'#94a3b8', bg:filasConError>0?'#fef2f2':'#f8fafc' }].map(s => (
                  <div key={s.label} style={{ background:s.bg, borderRadius:'12px', padding:'0.75rem', textAlign:'center' }}>
                    <p style={{ margin:0, fontSize:'1.6rem', fontWeight:'900', color:s.color }}>{s.value}</p>
                    <p style={{ margin:0, fontSize:'0.72rem', fontWeight:'700', color:'#64748b' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {erroresPreview.length > 0 && (
                <div style={{ background:'#fef2f2', borderRadius:'12px', padding:'0.85rem 1rem', border:'1px solid #fecaca', maxHeight:'130px', overflowY:'auto' }}>
                  <p style={{ margin:'0 0 0.45rem', fontSize:'0.75rem', fontWeight:'800', color:'#b91c1c' }}>{erroresPreview.length} error(es):</p>
                  {erroresPreview.map((err,i) => <p key={i} style={{ margin:'0.15rem 0 0', fontSize:'0.77rem', color:'#dc2626' }}>• {err}</p>)}
                </div>
              )}
              <div style={{ border:'1px solid #e2e8f0', borderRadius:'12px', overflow:'hidden', maxHeight:'280px', overflowY:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 120px 80px 80px 80px', padding:'0.5rem 0.85rem', background:'#f1f5f9', borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, fontWeight:'bold', fontSize:'0.7rem' }}>
                  <span>Código</span><span>Nombre</span><span>Precio</span><span>IVA</span><span>Stock</span><span>Estado</span>
                </div>
                {preview.map((f,i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'100px 1fr 120px 80px 80px 80px', padding:'0.55rem 0.85rem', borderBottom:i<preview.length-1?'1px solid #f8fafc':'none', background:f._error?'#fef9f9':i%2===0?'white':'#fafafa', alignItems:'center' }}>
                    <span style={{ fontWeight:'600', fontSize:'0.75rem' }}>{f.codigo}</span>
                    <span style={{ fontSize:'0.75rem' }}>{f.nombre}</span>
                    <span style={{ fontSize:'0.75rem' }}>{f.precio_unitario}</span>
                    <span style={{ fontSize:'0.75rem' }}>{f.porcentaje_iva}%</span>
                    <span style={{ fontSize:'0.75rem' }}>{f.stock}</span>
                    <span style={{ fontSize:'0.7rem', fontWeight:'800', color:f._error?'#ef4444':'#10b981' }}>{f._error?'✗ Error':'✓ OK'}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:'0.75rem' }}>
                <button onClick={()=>{setPreview([]);setErroresPreview([]);setArchivoNombre('');setPaso('subir');}} style={{ flex:1, padding:'0.7rem', borderRadius:'12px', border:'1.5px solid #e2e8f0', background:'white', fontWeight:'700', cursor:'pointer' }}>← Cambiar archivo</button>
                <button onClick={confirmarImportacion} disabled={filasValidas===0} style={{ flex:2, padding:'0.7rem', borderRadius:'12px', border:'none', background:filasValidas>0?`linear-gradient(90deg,${BLUE},${BLUE_MID})`:'#e2e8f0', color:filasValidas>0?'white':'#94a3b8', fontWeight:'700', cursor:filasValidas>0?'pointer':'not-allowed' }}>Importar {filasValidas} producto{filasValidas!==1?'s':''}</button>
              </div>
            </div>
          )}

          {paso === 'importando' && (
            <div style={{ textAlign:'center', padding:'2.5rem 1rem' }}>
              <div style={{ width:'60px', height:'60px', borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={BLUE_MID} strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </div>
              <p style={{ margin:'0 0 0.4rem', fontSize:'1rem', fontWeight:'800' }}>Importando productos...</p>
              <p style={{ margin:0, fontSize:'0.83rem', color:'#94a3b8' }}>No cierres esta ventana.</p>
            </div>
          )}

          {paso === 'resultado' && resultado && (
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ textAlign:'center', padding:'1rem 0 0.5rem' }}>
                <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:resultado.importados>0?'#ecfdf5':'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 0.85rem' }}>
                  {resultado.importados>0?<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>:<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                </div>
                <p style={{ margin:'0 0 0.3rem', fontSize:'1.05rem', fontWeight:'800' }}>{resultado.importados>0?'¡Importación completada!':'No se importó ningún producto'}</p>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.7rem' }}>
                {[{ label:'Importados', value:resultado.importados, color:'#10b981', bg:'#ecfdf5' },{ label:'Con error', value:resultado.fallidos, color:resultado.fallidos>0?'#ef4444':'#94a3b8', bg:resultado.fallidos>0?'#fef2f2':'#f8fafc' },{ label:'Omitidos', value:resultado.erroresPrevios, color:'#f59e0b', bg:'#fffbeb' }].map(s => (
                  <div key={s.label} style={{ background:s.bg, borderRadius:'12px', padding:'0.75rem', textAlign:'center' }}>
                    <p style={{ margin:0, fontSize:'1.5rem', fontWeight:'900', color:s.color }}>{s.value}</p>
                    <p style={{ margin:0, fontSize:'0.7rem', fontWeight:'700', color:'#64748b' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {resultado.detallesFallos?.length > 0 && (
                <div style={{ background:'#fef2f2', borderRadius:'12px', padding:'0.85rem 1rem', border:'1px solid #fecaca', maxHeight:'160px', overflowY:'auto' }}>
                  <p style={{ margin:'0 0 0.5rem', fontSize:'0.75rem', fontWeight:'800', color:'#b91c1c' }}>⚠️ {resultado.detallesFallos.length} producto(s) no importado(s):</p>
                  {resultado.detallesFallos.map((f,idx) => (
                    <div key={idx} style={{ padding:'0.35rem 0', borderBottom:idx<resultado.detallesFallos.length-1?'1px solid #fecaca':'none' }}>
                      <span style={{ fontSize:'0.78rem', fontWeight:'700', color:'#991b1b' }}>{f.nombre} ({f.codigo})</span>
                      <span style={{ fontSize:'0.74rem', color:'#dc2626', display:'block' }}>↳ {f.msg}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={onClose} style={{ padding:'0.75rem', borderRadius:'12px', border:'none', background:`linear-gradient(90deg,${BLUE},${BLUE_MID})`, color:'white', fontWeight:'700', cursor:'pointer' }}>Listo — Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------
// TOUR y BANNERS
// --------------------------------------------------------------
const getTOUR_KEY_PROD = () => {
  try { const u = JSON.parse(localStorage.getItem('user') || '{}'); const uid = u?.id_usuario || u?.email || 'default'; return `prod-tour-${uid}`; }
  catch { return 'prod-tour'; }
};
const TOUR_KEY_PROD = getTOUR_KEY_PROD();

const TourBienvenida_PROD = ({ onCerrar }) => {
  const pasos = [
    { emoji: '📦', titulo: '¿Para qué sirve este módulo?', texto: 'Administras tu catálogo de productos y servicios. Todo ítem en una factura debe estar registrado con código, nombre, precio e IVA configurado.' },
    { emoji: '💰', titulo: 'Precios e IVA', texto: 'Cada producto tiene precio unitario y porcentaje de IVA. Las tarifas disponibles las gestiona el docente en Configuración. El IVA se aplica automáticamente al facturar.' },
    { emoji: '📊', titulo: 'Control de Stock', texto: 'Al finalizar una factura el stock se descuenta automáticamente. Si es insuficiente, el sistema bloquea la finalización para proteger el inventario.' },
    { emoji: '📋', titulo: 'Importar desde Excel', texto: 'Carga múltiples productos con un .xlsx. Descarga la plantilla de ejemplo para ver el formato de columnas requerido.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'Los servicios no descuentan stock. Los productos desactivados no aparecen en nuevas facturas pero conservan su historial.' },
  ];
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return ReactDOM.createPortal(
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:9999, background:'rgba(10,18,40,0.78)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', animation:'tourFadeIn 0.25s ease' }}>
      <div style={{ background:'white', borderRadius:'24px', width:'100%', maxWidth:'500px', boxShadow:'0 40px 100px rgba(0,0,0,0.4)', overflow:'hidden', animation:'tourPopIn 0.32s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ background:'linear-gradient(135deg,#0f1f4b,#15389a,#1d4ed8)', padding:'1.6rem 1.8rem', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'-30px', right:'-30px', width:'120px', height:'120px', borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
          <div style={{ display:'flex', alignItems:'center', gap:'0.65rem', marginBottom:'0.5rem' }}>
            <span style={{ background:'rgba(255,255,255,0.18)', borderRadius:'99px', padding:'0.22rem 0.75rem', fontSize:'0.68rem', fontWeight:'800', color:'white', letterSpacing:'0.5px' }}>PRODUCTOS Y SERVICIOS</span>
            <span style={{ background:'#fbbf24', borderRadius:'99px', padding:'0.22rem 0.75rem', fontSize:'0.68rem', fontWeight:'800', color:'#78350f' }}>MODO EDUCATIVO</span>
          </div>
          <p style={{ margin:0, fontSize:'1.25rem', fontWeight:'900', color:'white', paddingRight:'2.5rem', lineHeight:1.2 }}>Catálogo de productos<br /><span style={{ color:'#93c5fd' }}>y servicios</span></p>
          <button onClick={onCerrar} style={{ position:'absolute', top:'1.1rem', right:'1.1rem', width:'32px', height:'32px', borderRadius:'9px', border:'none', background:'rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.28)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.15)'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ display:'flex', gap:'0.3rem', padding:'0.9rem 1.8rem 0' }}>
          {pasos.map((_,i) => <div key={i} style={{ height:'4px', flex:1, borderRadius:'99px', background:i<=paso?'#2563eb':'#e2e8f0', transition:'background 0.3s' }} />)}
        </div>
        <div style={{ padding:'1.4rem 1.8rem', minHeight:'160px' }}>
          <div style={{ display:'flex', gap:'1rem', alignItems:'flex-start' }}>
            <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'2px solid #bfdbfe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.9rem', flexShrink:0 }}>{actual.emoji}</div>
            <div>
              <p style={{ margin:0, fontWeight:'900', fontSize:'1rem', color:'#0f172a' }}>{actual.titulo}</p>
              <p style={{ margin:'0.4rem 0 0', fontSize:'0.84rem', color:'#475569', lineHeight:1.7 }}>{actual.texto}</p>
            </div>
          </div>
        </div>
        <div style={{ padding:'0.9rem 1.8rem 1.4rem', display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid #f1f5f9' }}>
          <span style={{ fontSize:'0.73rem', color:'#94a3b8', fontWeight:'700' }}>{paso+1} de {pasos.length}</span>
          <div style={{ display:'flex', gap:'0.5rem' }}>
            {paso > 0 && <button onClick={()=>setPaso(p=>p-1)} style={{ padding:'0.55rem 1.1rem', borderRadius:'10px', border:'1.5px solid #e2e8f0', background:'white', fontSize:'0.82rem', fontWeight:'700', color:'#64748b', cursor:'pointer', fontFamily:'inherit' }}>← Atrás</button>}
            {paso < pasos.length-1
              ? <button onClick={()=>setPaso(p=>p+1)} style={{ padding:'0.55rem 1.4rem', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#15389a,#2563eb)', color:'white', fontSize:'0.82rem', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(15,31,75,0.35)' }}>Siguiente →</button>
              : <button onClick={onCerrar} style={{ padding:'0.55rem 1.6rem', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#059669,#10b981)', color:'white', fontSize:'0.82rem', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', boxShadow:'0 4px 14px rgba(5,150,105,0.35)' }}>¡Entendido! Empezar 🚀</button>
            }
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const BannerEdu_PROD = ({ onClose }) => (
  <div style={{ marginBottom:'1rem', background:'linear-gradient(135deg,#f0f7ff,#e0f2fe)', border:'1.5px solid #bfdbfe', borderRadius:'14px', padding:'0.85rem 1.2rem', display:'flex', alignItems:'center', gap:'0.85rem', animation:'tourFadeIn 0.3s ease' }}>
    <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>🎓</div>
    <div style={{ flex:1 }}>
      <p style={{ margin:0, fontWeight:'900', fontSize:'0.82rem', color:'#1d4ed8' }}>Modo Educativo Activo</p>
      <p style={{ margin:'0.1rem 0 0', fontSize:'0.76rem', color:'#3b82f6', lineHeight:1.4 }}>Primera visita al módulo. Los datos son de práctica, ¡explora sin miedo!</p>
    </div>
    <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:'0.2rem', display:'flex', flexShrink:0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
);

const BarraModoEdu_PROD = ({ onVerTutorial }) => (
  <div style={{ background:'linear-gradient(90deg,#fffbeb,#fef3c7)', border:'1.5px solid #fde68a', borderRadius:'12px', padding:'0.65rem 1rem', marginBottom:'1.1rem', display:'flex', alignItems:'center', gap:'0.65rem' }}>
    <span style={{ fontSize:'0.95rem' }}>🏫</span>
    <p style={{ margin:0, fontSize:'0.77rem', color:'#92400e', fontWeight:'700', flex:1 }}>Modo Educativo — Los datos son de práctica. Explora sin miedo.</p>
    <button onClick={onVerTutorial} style={{ padding:'0.28rem 0.65rem', borderRadius:'8px', border:'1.5px solid #fbbf24', background:'white', color:'#92400e', fontSize:'0.7rem', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'0.3rem' }}>📖 Ver tutorial</button>
  </div>
);

// --------------------------------------------------------------
// COMPONENTE PRINCIPAL
// --------------------------------------------------------------
const GestionProductos = () => {
  // ── Tour educativo ──
  const [tourVisto_PROD, setTourVisto_PROD] = useState(() => !!localStorage.getItem(TOUR_KEY_PROD));
  const [mostrarEdu_PROD, setMostrarEdu_PROD] = useState(false);
  const cerrarTour_PROD = () => { localStorage.setItem(TOUR_KEY_PROD, '1'); setTourVisto_PROD(true); setMostrarEdu_PROD(true); setTimeout(() => setMostrarEdu_PROD(false), 30000); };
  const verTutorial_PROD = () => { localStorage.removeItem(TOUR_KEY_PROD); setTourVisto_PROD(false); setMostrarEdu_PROD(false); };

  // ── Tarifas IVA (cargadas desde API, con fallback) ──
  const [tarifasIVA, setTarifasIVA] = useState(TARIFAS_IVA_DEFAULT);
  useEffect(() => {
    fetch(`${API}/tarifas-iva/`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTarifasIVA(data.map(t => ({
            valor: parseFloat(t.porcentaje ?? t.valor ?? t.tarifa),
            label: `${parseFloat(t.porcentaje ?? t.valor ?? t.tarifa)}%`,
            descripcion: t.descripcion || `IVA ${t.porcentaje ?? t.valor}%`,
          })));
        }
      })
      .catch(() => {}); // silencioso, usa el fallback
  }, []);

  const POR_PAGINA = 10;
  const [productos, setProductos]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [buscar, setBuscar]             = useState('');
  const [soloConStock, setSoloConStock] = useState(false);
  const [pagina, setPagina]             = useState(1);
  const [total, setTotal]               = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [modalAbierto, setModalAbierto]         = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [guardando, setGuardando]               = useState(false);
  const [errorApi, setErrorApi]                 = useState('');
  const [confirmEliminar, setConfirmEliminar]   = useState(null);
  const [eliminando, setEliminando]             = useState(false);
  const [exportando, setExportando]             = useState(null);
  const [modalImportar, setModalImportar]       = useState(false);

  const buscarRef       = useRef(buscar);
  const soloConStockRef = useRef(soloConStock);
  const paginaRef       = useRef(pagina);
  useEffect(() => { buscarRef.current       = buscar;       }, [buscar]);
  useEffect(() => { soloConStockRef.current = soloConStock; }, [soloConStock]);
  useEffect(() => { paginaRef.current       = pagina;       }, [pagina]);

  const cargar = async (pag, buscarVal, conStock) => {
    setLoading(true); setErrorApi('');
    try {
      const res = await productosService.listar({ pagina: pag, por_pagina: POR_PAGINA, buscar: buscarVal || undefined, solo_con_stock: conStock });
      setProductos(res.items || []); setTotal(res.total || 0); setTotalPaginas(res.total_paginas || 1);
    } catch (e) { setErrorApi('Error cargando productos.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(1, '', false); }, []);
  useEffect(() => { const t = setTimeout(() => { setPagina(1); cargar(1, buscar, soloConStockRef.current); }, 400); return () => clearTimeout(t); }, [buscar]);
  useEffect(() => { setPagina(1); cargar(1, buscarRef.current, soloConStock); }, [soloConStock]);
  useEffect(() => { cargar(pagina, buscarRef.current, soloConStockRef.current); }, [pagina]);

  const abrirNuevo  = () => { setProductoEditando(null);      setErrorApi(''); setModalAbierto(true); };
  const abrirEditar = (p) => { setProductoEditando({ ...p }); setErrorApi(''); setModalAbierto(true); };
  const cerrarModal = ()  => { setModalAbierto(false); setProductoEditando(null); setErrorApi(''); };

  const guardar = async (form) => {
    setGuardando(true); setErrorApi('');
    try {
      if (productoEditando) {
        const nuevoStock = (productoEditando.stock ?? 0) + (parseInt(form.ajuste_stock) || 0);
        await productosService.actualizar(productoEditando.id_producto, { codigo: form.codigo, nombre: form.nombre, descripcion: form.descripcion || null, precio_unitario: parseFloat(form.precio_unitario), porcentaje_iva: parseFloat(form.porcentaje_iva), stock: nuevoStock, id_categoria: form.id_categoria ? parseInt(form.id_categoria) : null });
      } else {
        await productosService.crear({ codigo: form.codigo, nombre: form.nombre, descripcion: form.descripcion || null, precio_unitario: parseFloat(form.precio_unitario), porcentaje_iva: parseFloat(form.porcentaje_iva), stock: parseInt(form.stock_inicial) || 0, id_categoria: form.id_categoria ? parseInt(form.id_categoria) : null });
      }
      cerrarModal();
      await cargar(paginaRef.current, buscarRef.current, soloConStockRef.current);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setErrorApi(Array.isArray(detail) ? detail.map(d => d.msg || d).join(', ') : detail || e?.message || 'Error al guardar.');
    } finally { setGuardando(false); }
  };

  const eliminar = async (id) => {
    setEliminando(true); setErrorApi('');
    try { await productosService.eliminar(id); }
    catch (e) {
      const st = e?.response?.status;
      if (!st || st >= 400) { setErrorApi(e?.response?.data?.detail || e?.message || 'Error al eliminar.'); setConfirmEliminar(null); setEliminando(false); return; }
    }
    setConfirmEliminar(null); setEliminando(false);
    const nuevaPag = productos.length === 1 && paginaRef.current > 1 ? paginaRef.current - 1 : paginaRef.current;
    setPagina(nuevaPag);
    await cargar(nuevaPag, buscarRef.current, soloConStockRef.current);
  };

  const exportarBackend = async (formato) => {
    setExportando(formato);
    try {
      const params = new URLSearchParams(); if (buscar) params.append('buscar', buscar);
      const r = await fetch(`${API}/productos/exportar/${formato}?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob(); const href = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = href; a.download = `productos.${formato}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch { alert(`No se pudo exportar el ${formato.toUpperCase()}.`); }
    finally { setExportando(null); }
  };

  const stockColor = (p) => {
    if (p.stock === 0)             return { bg:'#fee2e2', color:'#b91c1c', label:'Sin stock'  };
    if (p.stock <= p.stock_minimo) return { bg:'#fef3c7', color:'#92400e', label:'Stock bajo' };
    return                                { bg:'#d1fae5', color:'#065f46', label:'En stock'   };
  };

  return (
    <div style={{ padding:'1.4rem 1.5rem', fontFamily:"'Nunito','Segoe UI',system-ui,sans-serif" }}>
      {!tourVisto_PROD && <TourBienvenida_PROD onCerrar={cerrarTour_PROD} />}
      {mostrarEdu_PROD && <BannerEdu_PROD onClose={() => setMostrarEdu_PROD(false)} />}
      <BarraModoEdu_PROD onVerTutorial={verTutorial_PROD} />

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.4rem', flexWrap:'wrap', gap:'1rem' }}>
        <p style={{ margin:0, fontSize:'0.82rem', color:'#94a3b8', fontWeight:'500' }}>
          {loading ? 'Cargando…' : `${total} producto${total!==1?'s':''} registrado${total!==1?'s':''}`}
        </p>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexWrap:'wrap' }}>
          <button onClick={() => exportarBackend('xlsx')} disabled={exportando !== null} style={{ display:'flex', alignItems:'center', gap:'0.45rem', padding:'0.6rem 0.9rem', borderRadius:'12px', border:'1.5px solid #e2e8f0', background:'white', cursor:exportando?'not-allowed':'pointer', color:'#475569', fontWeight:'700', fontSize:'0.8rem', transition:'all 0.15s', opacity:exportando?0.6:1 }} onMouseEnter={e=>{if(!exportando){e.currentTarget.style.borderColor='#10b981';e.currentTarget.style.color='#10b981';}}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#475569';}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            {exportando === 'xlsx' ? 'Exportando…' : 'XLSX'}
          </button>
          <button onClick={() => setModalImportar(true)} style={{ display:'flex', alignItems:'center', gap:'0.45rem', padding:'0.6rem 0.9rem', borderRadius:'12px', border:'1.5px solid #e2e8f0', background:'white', cursor:'pointer', color:'#475569', fontWeight:'700', fontSize:'0.8rem', transition:'all 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.borderColor='#2563eb';e.currentTarget.style.color='#2563eb';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.color='#475569';}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar
          </button>
          <button onClick={abrirNuevo} style={{ display:'flex', alignItems:'center', gap:'0.45rem', padding:'0.6rem 1.8rem', borderRadius:'12px', border:'none', cursor:'pointer', background:`linear-gradient(90deg,${BLUE},${BLUE_MID})`, color:'white', fontWeight:'700', fontSize:'0.85rem', boxShadow:`0 4px 12px rgba(21,56,154,0.33)`, transition:'all 0.2s' }} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(21,56,154,0.45)';}} onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=`0 4px 12px rgba(21,56,154,0.33)`;}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo Producto
          </button>
        </div>
      </div>

      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.2rem', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1', minWidth:'220px', maxWidth:'380px' }}>
          <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar por nombre o código..." style={{ ...inputStyle(false), paddingLeft:'2.4rem', background:'white' }} onFocus={e=>e.target.style.borderColor='#3b82f6'} onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
          <svg style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          {buscar && <button onClick={()=>setBuscar('')} style={{ position:'absolute', right:'0.6rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', fontSize:'0.83rem', color:'#475569', fontWeight:'600', padding:'0.55rem 0.85rem', background:soloConStock?'#eff6ff':'white', border:`1.5px solid ${soloConStock?'#93c5fd':'#e2e8f0'}`, borderRadius:'10px', userSelect:'none' }} onClick={()=>setSoloConStock(v=>!v)}>
          <div style={{ width:'16px', height:'16px', borderRadius:'4px', border:`2px solid ${soloConStock?'#2563eb':'#cbd5e1'}`, background:soloConStock?'#2563eb':'white', display:'flex', alignItems:'center', justifyContent:'center' }}>{soloConStock && <svg width="9" height="9" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7"/></svg>}</div>
          Solo con stock
        </label>
      </div>

      {errorApi && <div style={{ padding:'0.75rem 1rem', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', color:'#b91c1c', fontSize:'0.83rem', marginBottom:'1rem' }}>⚠️ {errorApi}</div>}

      <div style={{ background:'white', borderRadius:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)', overflow:'hidden', animation:'fadeUp 0.4s ease 0.1s both' }}>
        <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 90px 100px 80px 80px 100px', padding:'0.65rem 1.2rem', borderBottom:'2px solid #f1f5f9', gap:'0.75rem', background:'#fafafa' }}>
          {['Código','Producto','Precio','IVA','Stock','Estado','Acciones'].map(h => <span key={h} style={{ fontSize:'0.69rem', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>)}
        </div>
        {loading ? Array.from({ length: POR_PAGINA }).map((_,i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'90px 1fr 90px 100px 80px 80px 100px', padding:'0.85rem 1.2rem', gap:'0.75rem', borderBottom:'1px solid #f8fafc', alignItems:'center' }}>
            {[70,160,60,60,40,72,60].map((w,j) => <div key={j} style={{ height:'14px', width:`${w}px`, borderRadius:'6px', background:'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }} />)}
          </div>
        )) : productos.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#94a3b8' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <p style={{ margin:0, fontWeight:'600' }}>{buscar ? 'Sin resultados' : 'No hay productos aún'}</p>
            <p style={{ margin:'0.3rem 0 0', fontSize:'0.82rem' }}>{buscar ? 'Intenta con otro término' : 'Haz clic en "Nuevo Producto" para agregar el primero'}</p>
          </div>
        ) : productos.map((p, i) => {
          const s = stockColor(p);
          return (
            <div key={p.id_producto} style={{ display:'grid', gridTemplateColumns:'90px 1fr 90px 100px 80px 80px 100px', padding:'0.78rem 1.2rem', gap:'0.75rem', borderBottom:i<productos.length-1?'1px solid #f8fafc':'none', alignItems:'center', transition:'background 0.12s', animation:`fadeUp 0.3s ease ${i*0.04}s both` }} onMouseEnter={e=>e.currentTarget.style.background='#f8faff'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{ fontSize:'0.78rem', fontWeight:'700', color:'#64748b', background:'#f1f5f9', borderRadius:'6px', padding:'3px 7px', display:'inline-block' }}>{p.codigo}</span>
              <div><div style={{ fontSize:'0.86rem', fontWeight:'700', color:'#0f172a' }}>{p.nombre}</div>{p.descripcion && <div style={{ fontSize:'0.72rem', color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{p.descripcion}</div>}</div>
              <span style={{ fontSize:'0.86rem', fontWeight:'700', color:'#0f172a' }}>{fmtMoney(p.precio_unitario)}</span>
              <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 8px', borderRadius:'99px', fontSize:'0.73rem', fontWeight:'700', background:parseFloat(p.porcentaje_iva)>0?'#fef3c7':'#f1f5f9', color:parseFloat(p.porcentaje_iva)>0?'#92400e':'#64748b', width:'fit-content' }}>{parseFloat(p.porcentaje_iva)}%</span>
              <span style={{ fontSize:'0.86rem', fontWeight:'700', color:p.stock===0?'#ef4444':p.stock<=p.stock_minimo?'#f59e0b':'#0f172a' }}>{p.stock}</span>
              <span style={{ display:'inline-flex', padding:'3px 8px', borderRadius:'99px', fontSize:'0.72rem', fontWeight:'700', background:s.bg, color:s.color, width:'fit-content' }}>{s.label}</span>
              <div style={{ display:'flex', gap:'0.3rem' }}>
                <button onClick={()=>abrirEditar(p)} style={{ width:'28px', height:'28px', borderRadius:'7px', border:'1.5px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', transition:'all 0.13s' }} onMouseEnter={e=>{e.currentTarget.style.background='#eff6ff';e.currentTarget.style.color='#2563eb';e.currentTarget.style.borderColor='#bfdbfe';}} onMouseLeave={e=>{e.currentTarget.style.background='white';e.currentTarget.style.color='#64748b';e.currentTarget.style.borderColor='#e2e8f0';}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button onClick={()=>setConfirmEliminar(p)} style={{ width:'28px', height:'28px', borderRadius:'7px', border:'1.5px solid #fecaca', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#ef4444', transition:'all 0.13s' }} onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={e=>e.currentTarget.style.background='white'}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
              </div>
            </div>
          );
        })}
        {!loading && totalPaginas > 1 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 1.4rem', borderTop:'1px solid #f1f5f9', background:'#fafafa' }}>
            <span style={{ fontSize:'0.78rem', color:'#94a3b8', fontWeight:'600' }}>Mostrando {Math.min((pagina-1)*POR_PAGINA+1,total)}–{Math.min(pagina*POR_PAGINA,total)} de {total}</span>
            <div style={{ display:'flex', gap:'0.3rem' }}>
              <PaginBtn onClick={()=>setPagina(p=>Math.max(1,p-1))} disabled={pagina===1}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg></PaginBtn>
              {Array.from({ length:Math.min(5,totalPaginas) }, (_,i) => {
                let page = i+1;
                if (totalPaginas>5) { if (pagina<=3) page=i+1; else if (pagina>=totalPaginas-2) page=totalPaginas-4+i; else page=pagina-2+i; }
                return <PaginBtn key={page} onClick={()=>setPagina(page)} active={pagina===page}>{page}</PaginBtn>;
              })}
              <PaginBtn onClick={()=>setPagina(p=>Math.min(totalPaginas,p+1))} disabled={pagina===totalPaginas}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></PaginBtn>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalAbierto} onClose={cerrarModal} title={productoEditando ? 'Editar Producto' : 'Nuevo Producto'}>
        <FormProducto key={productoEditando?.id_producto ?? 'nuevo'} inicial={productoEditando} onGuardar={guardar} onCancelar={cerrarModal} loading={guardando} error={errorApi} tarifasIVA={tarifasIVA} />
      </Modal>

      <Modal open={!!confirmEliminar} onClose={() => !eliminando && setConfirmEliminar(null)} title="Eliminar Producto">
        <div style={{ marginBottom:'1.2rem' }}>
          <p style={{ color:'#475569', fontSize:'0.9rem', margin:'0 0 0.75rem' }}>¿Estás seguro que deseas eliminar <strong>{confirmEliminar?.nombre}</strong>?</p>
          <div style={{ padding:'0.75rem 1rem', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'10px', fontSize:'0.82rem', color:'#92400e' }}>💡 Si este producto aparece en facturas anteriores, quedará <strong>desactivado</strong> y no se borrará el historial contable.</div>
        </div>
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
          <button onClick={()=>setConfirmEliminar(null)} disabled={eliminando} style={{ padding:'0.6rem 1.2rem', borderRadius:'10px', border:'1.5px solid #e2e8f0', background:'white', color:'#475569', fontWeight:'600', cursor:'pointer', opacity:eliminando?0.5:1 }}>Cancelar</button>
          <button onClick={()=>eliminar(confirmEliminar.id_producto)} disabled={eliminando} style={{ padding:'0.6rem 1.2rem', borderRadius:'10px', border:'none', background:'#ef4444', color:'white', fontWeight:'700', cursor:eliminando?'not-allowed':'pointer', opacity:eliminando?0.7:1 }}>{eliminando ? 'Procesando…' : 'Sí, eliminar'}</button>
        </div>
      </Modal>

      <ModalImportarProductos open={modalImportar} onClose={() => setModalImportar(false)} onImportado={() => cargar(pagina, buscar, soloConStock)} />

      <style>{`
        @keyframes tourFadeIn{ from{opacity:0} to{opacity:1} }
        @keyframes tourPopIn { from{opacity:0;transform:scale(0.93) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes popIn   { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
};

export default GestionProductos;
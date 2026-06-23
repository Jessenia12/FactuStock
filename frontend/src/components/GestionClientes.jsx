import React, { useState, useEffect, useCallback, useRef } from 'react';
import { clientesService } from '../services/api';
import * as XLSX from 'xlsx'; // npm install xlsx
import ReactDOM from 'react-dom';


/* ════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — Gestión de Clientes
   Primera visita: muestra el modal explicativo al estudiante
   localStorage key: cli_tour_visto_<userId>
════════════════════════════════════════════════════════ */
const _getTourKey_CLI = (uid) => `cli_tour_visto_${uid || 'default'}`;



const API = 'http://localhost:8000/api';
const getToken = () => localStorage.getItem('token');

const TIPO_ID = ['CEDULA', 'RUC', 'PASAPORTE'];
const MAX_LONGITUD = { CEDULA: 10, RUC: 13, PASAPORTE: 20 };

const PROVINCIAS_VALIDAS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 30,
]);

const NOMBRE_PROVINCIA = {
  1: 'Azuay', 2: 'Bolívar', 3: 'Cañar', 4: 'Carchi', 5: 'Cotopaxi',
  6: 'Chimborazo', 7: 'El Oro', 8: 'Esmeraldas', 9: 'Guayas', 10: 'Imbabura',
  11: 'Loja', 12: 'Los Ríos', 13: 'Manabí', 14: 'Morona Santiago', 15: 'Napo',
  16: 'Pastaza', 17: 'Pichincha', 18: 'Tungurahua', 19: 'Zamora Chinchipe',
  20: 'Galápagos', 21: 'Sucumbíos', 22: 'Orellana',
  23: 'Santo Domingo de los Tsáchilas', 24: 'Santa Elena',
  30: 'Ecuatorianos en el exterior',
};

const calcularDV = (nueve) => {
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let total = 0;
  for (let i = 0; i < 9; i++) {
    let v = parseInt(nueve[i]) * coef[i];
    if (v >= 10) v -= 9;
    total += v;
  }
  return (10 - (total % 10)) % 10;
};

const validarCedulaEC = (cedula) => {
  if (!/^\d{10}$/.test(cedula))
    return { ok: false, msg: 'Debe tener exactamente 10 dígitos numéricos' };
  const provincia = parseInt(cedula.substring(0, 2));
  if (!PROVINCIAS_VALIDAS.has(provincia))
    return { ok: false, msg: `Los dos primeros dígitos (${cedula.substring(0, 2)}) no corresponden a ninguna provincia ecuatoriana.` };
  const dvEsperado = calcularDV(cedula.substring(0, 9));
  const dvIngresado = parseInt(cedula[9]);
  if (dvEsperado !== dvIngresado)
    return { ok: false, msg: `Dígito verificador incorrecto: debería ser ${dvEsperado}`, sugerencia: `${cedula.substring(0, 9)}${dvEsperado}` };
  return { ok: true, msg: `✓ Cédula válida — ${NOMBRE_PROVINCIA[provincia]}` };
};

const validarRUCEC = (ruc) => {
  if (!/^\d{13}$/.test(ruc))
    return { ok: false, msg: 'Debe tener exactamente 13 dígitos numéricos' };
  if (ruc.substring(10) !== '001')
    return { ok: false, msg: `El RUC debe terminar en 001, los tuyos son: ${ruc.substring(10)}` };
  const provincia = parseInt(ruc.substring(0, 2));
  if (!PROVINCIAS_VALIDAS.has(provincia))
    return { ok: false, msg: `Los dos primeros dígitos no corresponden a ninguna provincia.` };
  if (parseInt(ruc[2]) < 6) {
    const r = validarCedulaEC(ruc.substring(0, 10));
    if (!r.ok) return { ok: false, msg: `RUC incorrecto: ${r.msg}`, sugerencia: r.sugerencia ? r.sugerencia + '001' : null };
  }
  return { ok: true, msg: `✓ RUC válido — ${NOMBRE_PROVINCIA[provincia]}` };
};

const getFeedbackID = (tipo, valor) => {
  if (!valor) return null;
  if (tipo === 'CEDULA' && valor.length === 10) return validarCedulaEC(valor);
  if (tipo === 'RUC' && valor.length === 13) return validarRUCEC(valor);
  return null;
};

const validarFormulario = (form) => {
  const e = {};
  const tipo = form.tipo_identificacion;
  const id = form.identificacion.trim();
  if (!id) {
    e.identificacion = 'La identificación es obligatoria';
  } else if (tipo === 'CEDULA') {
    const r = validarCedulaEC(id);
    if (!r.ok) e.identificacion = r.sugerencia ? `${r.msg}. ¿Quisiste decir ${r.sugerencia}?` : r.msg;
  } else if (tipo === 'RUC') {
    const r = validarRUCEC(id);
    if (!r.ok) e.identificacion = r.sugerencia ? `${r.msg}. ¿Quisiste decir ${r.sugerencia}?` : r.msg;
  } else if (tipo === 'PASAPORTE') {
    if (id.length < 5 || id.length > 20) e.identificacion = 'Debe tener entre 5 y 20 caracteres';
    else if (!/^[A-Za-z0-9\-]+$/.test(id)) e.identificacion = 'Solo letras, números y guiones';
  }
  if (!form.nombres_apellidos.trim()) e.nombres_apellidos = 'El nombre es obligatorio';
  else if (form.nombres_apellidos.trim().length < 2) e.nombres_apellidos = 'Mínimo 2 caracteres';
  if (form.telefono?.trim() && !/^\d{10}$/.test(form.telefono.trim())) e.telefono = 'El teléfono debe tener exactamente 10 dígitos';
  if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Formato de email inválido';
  return e;
};

const inputStyle = (error) => ({
  padding: '0.62rem 0.85rem',
  border: `1.5px solid ${error ? '#ef4444' : '#e2e8f0'}`,
  borderRadius: '10px', fontSize: '0.88rem', color: '#0f172a',
  outline: 'none', fontFamily: 'inherit', background: 'white',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
});

const Field = ({ label, required, children, error }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: '#475569' }}>
      {label}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
    </label>
    {children}
    {error && <span style={{ fontSize: '0.72rem', color: '#ef4444', lineHeight: 1.45 }}>{error}</span>}
  </div>
);

const EMPTY_FORM = {
  tipo_identificacion: 'CEDULA', identificacion: '', nombres_apellidos: '',
  razon_social: '', direccion: '', telefono: '', email: '',
};

const Modal = ({ open, onClose, title, children, maxWidth = '560px' }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', animation: 'fadeUp 0.25s ease', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.4rem 1.6rem', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>{title}</h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ padding: '1.4rem 1.6rem' }}>{children}</div>
      </div>
    </div>
  );
};

const FormCliente = ({ inicial, onGuardar, onCancelar, loading, error }) => {
  const [form, setForm] = useState(inicial || EMPTY_FORM);
  const [errores, setErrores] = useState({});

  useEffect(() => { setForm(inicial || EMPTY_FORM); setErrores({}); }, [inicial]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clearErr = (k) => setErrores(e => ({ ...e, [k]: '' }));

  const handleTipoChange = (t) => {
    setForm(f => ({ ...f, tipo_identificacion: t, identificacion: '' }));
    setErrores(e => ({ ...e, identificacion: '' }));
  };

  const handleIdChange = (ev) => {
    let v = ev.target.value;
    const tipo = form.tipo_identificacion;
    if (tipo === 'CEDULA' || tipo === 'RUC') v = v.replace(/\D/g, '');
    v = v.slice(0, MAX_LONGITUD[tipo] || 20);
    set('identificacion', v);
    clearErr('identificacion');
  };

  const handleNombresChange = (ev) => {
    const v = ev.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s\-']/g, '');
    set('nombres_apellidos', v);
    clearErr('nombres_apellidos');
  };

  const handleTelChange = (ev) => {
    const v = ev.target.value.replace(/\D/g, '').slice(0, 10);
    set('telefono', v);
    clearErr('telefono');
  };

  const handleSubmit = () => {
    const e = validarFormulario(form);
    setErrores(e);
    if (Object.keys(e).length === 0) onGuardar(form);
  };

  const placeholderID = { CEDULA: 'Ej: 1712345678  (10 dígitos)', RUC: 'Ej: 1712345678001  (13 dígitos)', PASAPORTE: 'Ej: AB123456' }[form.tipo_identificacion];
  const longActual = form.identificacion.length;
  const longEsperada = MAX_LONGITUD[form.tipo_identificacion];
  const mostrarCont = form.tipo_identificacion !== 'PASAPORTE';
  const feedback = getFeedbackID(form.tipo_identificacion, form.identificacion);
  const contColor = longActual === longEsperada ? (feedback?.ok ? '#10b981' : '#ef4444') : '#94a3b8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '0.83rem' }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Field label="Tipo ID" required>
          <select value={form.tipo_identificacion} onChange={e => handleTipoChange(e.target.value)} style={{ ...inputStyle(false), cursor: 'pointer' }}>
            {TIPO_ID.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span style={{ fontSize: '0.71rem', color: '#94a3b8', lineHeight: 1.5, marginTop: '0.3rem', display: 'block' }}>
            {form.tipo_identificacion === 'CEDULA' && 'Personas naturales ecuatorianas — 10 dígitos'}
            {form.tipo_identificacion === 'RUC' && 'Empresas o profesionales con actividad económica — 13 dígitos'}
            {form.tipo_identificacion === 'PASAPORTE' && 'Clientes extranjeros sin cédula ecuatoriana'}
          </span>
        </Field>
        <Field label="Identificación" required error={errores.identificacion}>
          <div style={{ position: 'relative' }}>
            <input value={form.identificacion} onChange={handleIdChange} placeholder={placeholderID} maxLength={longEsperada}
              style={{ ...inputStyle(errores.identificacion), paddingRight: mostrarCont ? '52px' : '0.85rem' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = errores.identificacion ? '#ef4444' : '#e2e8f0'} />
            {mostrarCont && (
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', fontWeight: '700', color: contColor, pointerEvents: 'none' }}>
                {longActual}/{longEsperada}
              </span>
            )}
          </div>
          {feedback && !errores.identificacion && (
            <span style={{ fontSize: '0.72rem', fontWeight: '600', color: feedback.ok ? '#10b981' : '#ef4444', lineHeight: 1.4 }}>
              {feedback.msg}
              {feedback.sugerencia && <> — ¿Quisiste decir <strong>{feedback.sugerencia}</strong>?</>}
            </span>
          )}
          {!form.identificacion && form.tipo_identificacion === 'CEDULA' && (
            <div style={{ marginTop: '0.35rem', padding: '0.55rem 0.75rem', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: '1px' }}>🔢</span>
              <span style={{ fontSize: '0.71rem', color: '#1e40af', lineHeight: 1.55 }}>
                <strong>Dígito verificador:</strong> el último dígito de la cédula no es aleatorio — se calcula matemáticamente a partir de los 9 anteriores con el algoritmo del Registro Civil. El sistema lo valida automáticamente al completar los 10 dígitos.
              </span>
            </div>
          )}
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Nombres / Apellidos" required error={errores.nombres_apellidos}>
            <input value={form.nombres_apellidos} onChange={handleNombresChange} placeholder="Solo letras — Ej: Juan Carlos Pérez Ríos"
              style={inputStyle(errores.nombres_apellidos)}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = errores.nombres_apellidos ? '#ef4444' : '#e2e8f0'} />
          </Field>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Razón Social">
            <input value={form.razon_social} onChange={e => set('razon_social', e.target.value)} placeholder="Empresa (opcional)" style={inputStyle(false)}
              onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            {!form.razon_social && (
              <span style={{ fontSize: '0.71rem', color: '#94a3b8', lineHeight: 1.5, marginTop: '0.3rem', display: 'block' }}>
                Completa este campo solo si el cliente factura como empresa o tiene nombre comercial. Si es persona natural déjalo vacío.
              </span>
            )}
          </Field>
        </div>
        <Field label="Teléfono" error={errores.telefono}>
          <div style={{ position: 'relative' }}>
            <input value={form.telefono} onChange={handleTelChange} placeholder="10 dígitos — Ej: 0991234567" maxLength={10}
              style={{ ...inputStyle(errores.telefono), paddingRight: '44px' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = errores.telefono ? '#ef4444' : '#e2e8f0'} />
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', fontWeight: '700', color: form.telefono.length === 10 ? '#10b981' : '#94a3b8', pointerEvents: 'none' }}>
              {form.telefono.length}/10
            </span>
          </div>
        </Field>
        <Field label="Email" error={errores.email}>
          <input type="email" value={form.email} onChange={e => { set('email', e.target.value); clearErr('email'); }}
            placeholder="correo@ejemplo.com" style={inputStyle(errores.email)}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = errores.email ? '#ef4444' : '#e2e8f0'} />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Dirección">
            <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Dirección completa" style={inputStyle(false)}
              onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
          </Field>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
        <button onClick={onCancelar} disabled={loading}
          style={{ padding: '0.65rem 1.2rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '600', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={loading}
          style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg,#15389a,#2563eb)', color: 'white', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {loading ? 'Guardando...' : '✓ Guardar Cliente'}
        </button>
      </div>
    </div>
  );
};

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
    }}>
    {children}
  </button>
);

const normalizarTelefono = (val) => {
  if (!val) return '';
  let t = String(val).trim().replace(/\.0+$/, '').replace(/\D/g, '');
  if (t.length === 9) t = '0' + t;
  if (t.length > 10) t = t.slice(0, 10);
  return t;
};

const normalizarId = (val, tipo) => {
  if (!val) return '';
  let s = String(val).trim().replace(/\.0+$/, '');
  if (tipo === 'CEDULA') s = s.padStart(10, '0').replace(/\D/g, '');
  if (tipo === 'RUC') s = s.padStart(13, '0').replace(/\D/g, '');
  return s;
};

/**
 * Parser CSV robusto — RFC 4180 + BOM + CRLF, tolera filas completas entre comillas (error de Excel)
 */
const parseCSVLine = (line) => {
  // Limpiar espacios
  let trimmed = line.trim();
  // Caso especial: toda la línea está envuelta en comillas dobles (error común de Excel)
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1);
    const parts = [];
    let inQuote = false;
    let current = '';
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '"') {
        if (inQuote && inner[i + 1] === '"') {
          current += '"';
          i++;
          continue;
        }
        inQuote = !inQuote;
        continue;
      }
      if (ch === ',' && !inQuote) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    parts.push(current.trim());
    return parts;
  }

  // Parseo estándar RFC 4180
  const result = [];
  let inQuote = false;
  let current = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuote = !inQuote;
      i++;
      continue;
    }
    if (ch === ',' && !inQuote) {
      result.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  result.push(current.trim());
  return result;
};

const CSV_HEADERS = [
  'tipo_identificacion',
  'identificacion',
  'nombres_apellidos',
  'razon_social',
  'telefono',
  'email',
  'direccion',
];

// ─── Encabezados de la plantilla (mismos que se muestran en la vista previa) ───
const PLANTILLA_HEADERS = [
  'Identificación',
  'Tipo Identificación',
  'Nombres / Apellidos',
  'Razón Social',
  'Teléfono',
  'Email',
  'Dirección',
];

// Mapeo de etiqueta → campo interno (acepta textos y números para el tipo)
const LABEL_TO_KEY = {
  'identificacion': 'identificacion',
  'identificación': 'identificacion',
  'no. identificacion': 'identificacion',
  'no identificacion': 'identificacion',
  'tipo identificacion': 'tipo_identificacion',
  'tipo_identificacion': 'tipo_identificacion',
  'tipo identificación': 'tipo_identificacion',
  'tipo_identificación': 'tipo_identificacion',
  'tipo id': 'tipo_identificacion',
  '1': 'tipo_identificacion',
  '2': 'tipo_identificacion',
  '3': 'tipo_identificacion',
  'nombres / apellidos': 'nombres_apellidos',
  'nombres_apellidos': 'nombres_apellidos',
  'nombres completos': 'nombres_apellidos',
  'nombre': 'nombres_apellidos',
  'nombres': 'nombres_apellidos',
  'razon social': 'razon_social',
  'razón social': 'razon_social',
  'razon_social': 'razon_social',
  'telefono': 'telefono',
  'teléfono': 'telefono',
  'correos': 'email',
  'correo': 'email',
  'email': 'email',
  'e-mail': 'email',
  'direccion': 'direccion',
  'dirección': 'direccion',
};

const normalizarEncabezado = (h) =>
  h.toLowerCase()
    .trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u').replace(/ñ/g, 'n');

const normalizarTipoIdentificacion = (valor) => {
  const v = String(valor).trim().toUpperCase();
  if (v === '1' || v === 'CEDULA') return 'CEDULA';
  if (v === '2' || v === 'RUC') return 'RUC';
  if (v === '3' || v === 'PASAPORTE') return 'PASAPORTE';
  return v;
};

const normalizarFila = (raw, numFila, errores) => {
  const tipoRaw = (raw.tipo_identificacion || '').trim();
  const tipo = normalizarTipoIdentificacion(tipoRaw);
  if (!['CEDULA', 'RUC', 'PASAPORTE'].includes(tipo)) {
    errores.push(`Fila ${numFila}: tipo_identificacion inválido — "${tipoRaw}" (use 1/2/3 o CEDULA/RUC/PASAPORTE)`);
    return { ...raw, tipo_identificacion: tipo, _error: true };
  }

  const fila = {
    tipo_identificacion: tipo,
    identificacion: normalizarId(raw.identificacion, tipo),
    nombres_apellidos: (raw.nombres_apellidos || '').trim(),
    razon_social: (raw.razon_social || '').trim(),
    telefono: normalizarTelefono(raw.telefono),
    email: (raw.email || '').trim(),
    direccion: (raw.direccion || '').trim(),
  };

  if (!fila.nombres_apellidos) {
    errores.push(`Fila ${numFila}: nombres_apellidos es obligatorio`);
    fila._error = true;
  }
  if (!fila.identificacion) {
    errores.push(`Fila ${numFila}: identificacion es obligatoria`);
    fila._error = true;
  } else if (tipo === 'CEDULA') {
    const r = validarCedulaEC(fila.identificacion);
    if (!r.ok) { errores.push(`Fila ${numFila}: ${r.msg} (${fila.identificacion})`); fila._error = true; }
  } else if (tipo === 'RUC') {
    const r = validarRUCEC(fila.identificacion);
    if (!r.ok) { errores.push(`Fila ${numFila}: ${r.msg} (${fila.identificacion})`); fila._error = true; }
  } else if (tipo === 'PASAPORTE') {
    if (fila.identificacion.length < 5 || fila.identificacion.length > 20) {
      errores.push(`Fila ${numFila}: pasaporte debe tener entre 5 y 20 caracteres`); fila._error = true;
    }
  }
  if (fila.telefono && !/^\d{10}$/.test(fila.telefono)) {
    errores.push(`Fila ${numFila}: teléfono debe tener 10 dígitos (obtenido: "${fila.telefono}")`);
    fila._error = true;
  }
  if (fila.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fila.email)) {
    errores.push(`Fila ${numFila}: email inválido (${fila.email})`); fila._error = true;
  }
  return fila;
};

const parsearCSV = (texto) => {
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
  const lineas = texto.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lineas.length < 2) return { filas: [], errores: ['El archivo no tiene datos (solo encabezado o vacío)'] };

  const encabezadosBrutos = parseCSVLine(lineas[0]);
  const encabezadosNorm = encabezadosBrutos.map(normalizarEncabezado);

  const colMap = {};
  encabezadosNorm.forEach((h, idx) => {
    if (LABEL_TO_KEY[h] !== undefined) {
      const campo = LABEL_TO_KEY[h];
      if (colMap[campo] === undefined) colMap[campo] = idx;
      return;
    }
    for (const [key, campo] of Object.entries(LABEL_TO_KEY)) {
      if (normalizarEncabezado(key) === h) {
        if (colMap[campo] === undefined) colMap[campo] = idx;
        break;
      }
    }
  });

  const faltantes = ['tipo_identificacion', 'identificacion', 'nombres_apellidos'].filter(r => colMap[r] === undefined);
  if (faltantes.length > 0) {
    return {
      filas: [],
      errores: [`Columnas faltantes: ${faltantes.join(', ')}. Encabezados detectados: "${encabezadosBrutos.join('", "')}". Descarga y usa la plantilla.`]
    };
  }

  const filas = [], errores = [];
  for (let i = 1; i < lineas.length; i++) {
    const cols = parseCSVLine(lineas[i]);
    const raw = {};
    CSV_HEADERS.forEach(h => {
      raw[h] = colMap[h] !== undefined ? (cols[colMap[h]] || '') : '';
    });
    filas.push(normalizarFila(raw, i + 1, errores));
  }
  return { filas, errores };
};

const parsearXLSX = (buffer) => {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    if (rows.length === 0) return { filas: [], errores: ['La hoja de Excel está vacía'] };

    const filas = [], errores = [];
    rows.forEach((row, i) => {
      const rawNorm = {};
      Object.keys(row).forEach(k => {
        rawNorm[normalizarEncabezado(k)] = row[k];
      });

      const getField = (campo) => {
        const variantes = Object.keys(LABEL_TO_KEY).filter(k => LABEL_TO_KEY[k] === campo);
        for (const v of variantes) {
          const vn = normalizarEncabezado(v);
          if (rawNorm[vn] !== undefined && rawNorm[vn] !== '') return rawNorm[vn];
        }
        return '';
      };

      const raw = {
        tipo_identificacion: getField('tipo_identificacion'),
        identificacion: getField('identificacion'),
        nombres_apellidos: getField('nombres_apellidos'),
        razon_social: getField('razon_social'),
        telefono: getField('telefono'),
        email: getField('email'),
        direccion: getField('direccion'),
      };
      filas.push(normalizarFila(raw, i + 2, errores));
    });
    return { filas, errores };
  } catch (err) {
    return { filas: [], errores: [`No se pudo leer el archivo Excel: ${err.message}`] };
  }
};

/* ══════════════════════════════════════════════════════════
   MODAL IMPORTAR CLIENTES
══════════════════════════════════════════════════════════ */
const ModalImportar = ({ open, onClose, onImportado }) => {
  const [paso, setPaso] = useState('formato');
  const [preview, setPreview] = useState([]);
  const [erroresPreview, setErroresPreview] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPaso('formato'); setPreview([]); setErroresPreview([]);
        setResultado(null); setArchivoNombre('');
      }, 300);
    }
  }, [open]);

  // Descargar plantilla en formato XLSX (evita problemas de Excel con CSV)
  const descargarPlantilla = () => {
    const data = [
      PLANTILLA_HEADERS,
      ['0911111111', '1', 'Nombre1 Apellido1', 'Empresa Ejemplo', '0999309720', 'prueba@ejemplo.com', 'Quito, Ecuador'],
      ['0911111111001', '2', '', 'Distribuciones S.A.', '0999301111', 'ventas@empresa.com', 'Guayaquil, Ecuador'],
      ['AB123456', '3', 'John Smith', '', '', 'john@example.com', ''],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 28 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_clientes.xlsx');
  };

  const procesarArchivo = (file) => {
    if (!file) return;
    const esCSV = file.name.toLowerCase().endsWith('.csv');
    const esXLSX = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    if (!esCSV && !esXLSX) {
      setErroresPreview(['Solo se aceptan archivos .CSV o .XLSX']);
      setPaso('subir');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErroresPreview(['El archivo supera el límite de 2 MB']);
      setPaso('subir');
      return;
    }

    setArchivoNombre(file.name);
    const reader = new FileReader();

    if (esCSV) {
      reader.onload = (e) => {
        const { filas, errores } = parsearCSV(e.target.result);
        setPreview(filas); setErroresPreview(errores); setPaso('preview');
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = (e) => {
        const { filas, errores } = parsearXLSX(e.target.result);
        setPreview(filas); setErroresPreview(errores); setPaso('preview');
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    procesarArchivo(e.dataTransfer.files[0]);
  };

  const confirmarImportacion = async () => {
    const filasValidas = preview.filter(f => !f._error);
    if (filasValidas.length === 0) return;
    setPaso('importando');
    let importados = 0, fallidos = 0;
    const detallesFallos = [];

    for (const fila of filasValidas) {
      try {
        const resp = await fetch(`${API}/clientes/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({
            tipo_identificacion: fila.tipo_identificacion,
            identificacion: fila.identificacion,
            nombres_apellidos: fila.nombres_apellidos,
            razon_social: fila.razon_social || '',
            telefono: fila.telefono || '',
            email: fila.email || '',
            direccion: fila.direccion || '',
          }),
        });
        if (resp.ok) {
          importados++;
        } else {
          let errorMsg = `Error HTTP ${resp.status}`;
          try {
            const data = await resp.json();
            const d = data?.detail;
            errorMsg = Array.isArray(d) ? d.map(x => x.msg || JSON.stringify(x)).join(' / ')
              : (typeof d === 'string' ? d : errorMsg);
          } catch (_) { /* body no es JSON */ }
          fallidos++;
          detallesFallos.push({ id: fila.identificacion, nombre: fila.nombres_apellidos, msg: errorMsg });
        }
      } catch (_) {
        fallidos++;
        detallesFallos.push({ id: fila.identificacion, nombre: fila.nombres_apellidos, msg: 'Error de conexión con el servidor' });
      }
    }

    setResultado({
      importados, fallidos, detallesFallos,
      totalLeidos: preview.length,
      erroresPrevios: preview.filter(f => f._error).length,
    });
    setPaso('resultado');
    if (importados > 0) onImportado();
  };

  if (!open) return null;
  const filasValidas = preview.filter(f => !f._error).length;
  const filasConError = preview.filter(f => f._error).length;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,18,40,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: paso === 'preview' ? '820px' : '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', animation: 'popIn 0.25s cubic-bezier(0.34,1.4,0.64,1)' }}>

        <div style={{ padding: '1.2rem 1.5rem', background: 'linear-gradient(135deg,#15389a,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'white' }}>Importar Clientes</h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
                {paso === 'formato' && 'Descarga la plantilla y completa tus datos'}
                {paso === 'subir' && 'Sube tu archivo CSV o XLSX'}
                {paso === 'preview' && `${preview.length} filas encontradas — revisa antes de importar`}
                {paso === 'importando' && 'Procesando importación...'}
                {paso === 'resultado' && 'Importación completada'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {['formato', 'subir', 'preview'].includes(paso) && (
          <div style={{ display: 'flex', padding: '0.85rem 1.5rem', borderBottom: '1px solid #f1f5f9', gap: '0.5rem', alignItems: 'center', flexShrink: 0, background: '#fafbfc' }}>
            {[{ key: 'formato', num: 1, label: 'Plantilla' }, { key: 'subir', num: 2, label: 'Subir archivo' }, { key: 'preview', num: 3, label: 'Revisar' }].map((s, i, arr) => {
              const orden = ['formato', 'subir', 'preview'];
              const activo = s.key === paso;
              const completado = orden.indexOf(s.key) < orden.indexOf(paso);
              return (
                <React.Fragment key={s.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: '800', background: completado ? '#10b981' : activo ? '#2563eb' : '#e2e8f0', color: (completado || activo) ? 'white' : '#94a3b8', flexShrink: 0 }}>
                      {completado ? '✓' : s.num}
                    </div>
                    <span style={{ fontSize: '0.77rem', fontWeight: activo ? '800' : '600', color: activo ? '#0f172a' : completado ? '#10b981' : '#94a3b8' }}>{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div style={{ flex: 1, height: '1px', background: completado ? '#10b981' : '#e2e8f0' }} />}
                </React.Fragment>
              );
            })}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.4rem 1.5rem' }}>
          {paso === 'formato' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ background: '#eff6ff', borderRadius: '14px', padding: '1rem 1.2rem', border: '1px solid #bfdbfe' }}>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', fontWeight: '800', color: '#1d4ed8' }}>📋 Importación de Clientes — consideraciones</p>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#1e40af', lineHeight: 1.8 }}>
                  <li>El archivo debe ser <strong>.CSV</strong> o <strong>.XLSX</strong> (máximo 2 MB).</li>
                  <li>El campo <strong>Tipo Identificación</strong> debe ser: <strong>1</strong> (CÉDULA), <strong>2</strong> (RUC) o <strong>3</strong> (PASAPORTE). También acepta los textos.</li>
                  <li><strong>Nombres / Apellidos</strong> es obligatorio para personas naturales.</li>
                  <li>El teléfono debe tener exactamente <strong>10 dígitos</strong> (incluye el 0 inicial).</li>
                  <li>No modifiques los encabezados de la plantilla — solo llena los datos.</li>
                </ol>
              </div>

              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '0.85rem 1rem', overflow: 'auto' }}>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.67rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vista previa de la plantilla (XLSX)</p>
                <pre style={{ margin: 0, fontSize: '0.68rem', color: '#e2e8f0', fontFamily: 'monospace', lineHeight: 1.7, whiteSpace: 'pre' }}>{
                  `Identificación  | Tipo | Nombres / Apellidos     | Razón Social         | Teléfono    | Email               | Dirección
0911111111      | 1    | Nombre1 Apellido1       | Empresa Ejemplo      | 0999309720  | prueba@ejemplo.com  | Quito, Ecuador
0911111111001   | 2    |                         | Distribuciones S.A.  | 0999301111  | ventas@empresa.com  | Guayaquil, Ecuador
AB123456        | 3    | John Smith              |                      |             | john@example.com    |`}
                </pre>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={descargarPlantilla}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '12px', border: '1.5px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Descargar plantilla Excel (XLSX)
                </button>
                <button onClick={() => setPaso('subir')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(90deg,#15389a,#2563eb)', color: 'white', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                  Tengo mi archivo listo →
                </button>
              </div>
            </div>
          )}

          {paso === 'subir' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`, borderRadius: '16px', padding: '3rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s' }}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => procesarArchivo(e.target.files[0])} />
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: dragOver ? '#dbeafe' : '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#2563eb' : '#94a3b8'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p style={{ margin: '0 0 0.3rem', fontSize: '0.95rem', fontWeight: '800', color: dragOver ? '#1d4ed8' : '#334155' }}>
                  {dragOver ? 'Suelta el archivo aquí' : 'Arrastra tu archivo aquí'}
                </p>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                  o haz clic para seleccionar · <strong>.CSV</strong> o <strong>.XLSX</strong> · máx. 2 MB
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {[
                  { ext: 'CSV', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', desc: 'Texto plano — recomendado' },
                  { ext: 'XLSX', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', desc: 'Excel — también aceptado' },
                ].map(f => (
                  <div key={f.ext} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '8px', background: f.bg, border: `1px solid ${f.border}` }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '900', color: f.color }}>.{f.ext}</span>
                    <span style={{ fontSize: '0.70rem', color: f.color, opacity: 0.8 }}>{f.desc}</span>
                  </div>
                ))}
              </div>

              {erroresPreview.length > 0 && (
                <div style={{ background: '#fef2f2', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid #fecaca' }}>
                  {erroresPreview.map((e, i) => <p key={i} style={{ margin: '0.1rem 0', fontSize: '0.78rem', color: '#dc2626' }}>⚠️ {e}</p>)}
                </div>
              )}

              <button onClick={() => setPaso('formato')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', alignSelf: 'center' }}>
                ← Volver a ver las instrucciones
              </button>
            </div>
          )}

          {paso === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {archivoNombre && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '600' }}>{archivoNombre}</span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.7rem' }}>
                {[
                  { label: 'Total leídos', value: preview.length, color: '#2563eb', bg: '#eff6ff' },
                  { label: 'Válidos', value: filasValidas, color: '#10b981', bg: '#ecfdf5' },
                  { label: 'Con errores', value: filasConError, color: filasConError > 0 ? '#ef4444' : '#94a3b8', bg: filasConError > 0 ? '#fef2f2' : '#f8fafc' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: '12px', padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: s.color }}>{s.value}</p>
                    <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {erroresPreview.length > 0 && (
                <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #fecaca', maxHeight: '130px', overflowY: 'auto' }}>
                  <p style={{ margin: '0 0 0.45rem', fontSize: '0.75rem', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase' }}>{erroresPreview.length} error(es) en el archivo:</p>
                  {erroresPreview.map((err, i) => <p key={i} style={{ margin: '0.15rem 0 0', fontSize: '0.77rem', color: '#dc2626' }}>• {err}</p>)}
                </div>
              )}

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 110px 80px', padding: '0.5rem 0.85rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 }}>
                  {['Tipo', 'Identificación', 'Nombre', 'Email', 'Estado'].map(h => (
                    <span key={h} style={{ fontSize: '0.67rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>{h}</span>
                  ))}
                </div>
                {preview.map((f, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 120px 1fr 110px 80px', padding: '0.55rem 0.85rem', borderBottom: i < preview.length - 1 ? '1px solid #f8fafc' : 'none', background: f._error ? '#fef9f9' : i % 2 === 0 ? 'white' : '#fafafa', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px', width: 'fit-content' }}>{f.tipo_identificacion}</span>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#334155' }}>{f.identificacion}</span>
                    <span style={{ fontSize: '0.79rem', fontWeight: '700', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombres_apellidos}</span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.email || '—'}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: f._error ? '#ef4444' : '#10b981' }}>{f._error ? '✗ Error' : '✓ OK'}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => { setPreview([]); setErroresPreview([]); setArchivoNombre(''); setPaso('subir'); }}
                  style={{ flex: 1, padding: '0.7rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                  ← Cambiar archivo
                </button>
                <button onClick={confirmarImportacion} disabled={filasValidas === 0}
                  style={{ flex: 2, padding: '0.7rem', borderRadius: '12px', border: 'none', background: filasValidas > 0 ? 'linear-gradient(90deg,#15389a,#2563eb)' : '#e2e8f0', color: filasValidas > 0 ? 'white' : '#94a3b8', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: filasValidas > 0 ? 'pointer' : 'not-allowed' }}>
                  Importar {filasValidas} cliente{filasValidas !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {paso === 'importando' && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </div>
              <p style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>Importando clientes...</p>
              <p style={{ margin: 0, fontSize: '0.83rem', color: '#94a3b8' }}>No cierres esta ventana.</p>
            </div>
          )}

          {paso === 'resultado' && resultado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem 0 0.5rem' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: resultado.importados > 0 ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.85rem' }}>
                  {resultado.importados > 0
                    ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  }
                </div>
                <p style={{ margin: '0 0 0.3rem', fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                  {resultado.importados > 0 ? '¡Importación completada!' : 'No se importó ningún cliente'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.7rem' }}>
                {[
                  { label: 'Importados', value: resultado.importados, color: '#10b981', bg: '#ecfdf5' },
                  { label: 'Con error', value: resultado.fallidos, color: resultado.fallidos > 0 ? '#ef4444' : '#94a3b8', bg: resultado.fallidos > 0 ? '#fef2f2' : '#f8fafc' },
                  { label: 'Omitidos CSV', value: resultado.erroresPrevios, color: '#f59e0b', bg: '#fffbeb' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: s.color }}>{s.value}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '700', color: '#64748b' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {resultado.detallesFallos?.length > 0 && (
                <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid #fecaca', maxHeight: '160px', overflowY: 'auto' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    ⚠️ {resultado.detallesFallos.length} cliente{resultado.detallesFallos.length !== 1 ? 's' : ''} no importado{resultado.detallesFallos.length !== 1 ? 's' : ''}:
                  </p>
                  {resultado.detallesFallos.map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', padding: '0.35rem 0', borderBottom: idx < resultado.detallesFallos.length - 1 ? '1px solid #fecaca' : 'none' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#991b1b' }}>
                        {f.nombre} <span style={{ fontFamily: 'monospace', fontWeight: '400', color: '#b91c1c' }}>({f.id})</span>
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#dc2626' }}>↳ {f.msg}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={onClose} style={{ padding: '0.75rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(90deg,#15389a,#2563eb)', color: 'white', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>
                Listo — Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   TOUR DE BIENVENIDA — FactuStock (estándar unificado)
   Módulo: CLIENTES
══════════════════════════════════════════════════════════ */
const EDU_BORDER_GC = '#bfdbfe';



/* ════════════════════════════════════════════════════════
   TOUR BIENVENIDA — Gestión de Clientes
   localStorage key: cli_tour_<userId>
════════════════════════════════════════════════════════ */
const getTOUR_KEY_CLI = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const uid = u?.id_usuario || u?.email || 'default';
    return `tour-key-cli-${uid}`;
  } catch { return 'tour_key_cli'; }
};
const TOUR_KEY_CLI = getTOUR_KEY_CLI();

const TourBienvenida_CLI = ({ onCerrar }) => {
  const pasos = [
    { emoji: '👥', titulo: '¿Para qué sirve este módulo?', texto: 'Registras y administras todos tus clientes y proveedores. Toda persona o empresa en una factura debe estar registrada aquí con su identificación y datos de contacto.' },
    { emoji: '🪪', titulo: 'Tipos de identificación', texto: 'Cédula (10 dígitos, validación automática), RUC (13 dígitos) o Pasaporte. El sistema valida la cédula con el algoritmo oficial del Registro Civil ecuatoriano.' },
    { emoji: '🏷️', titulo: 'Clientes y Proveedores', texto: 'Una persona puede ser cliente, proveedor o ambos. Activa el toggle Es proveedor para que aparezca en Retenciones y Comprobantes Recibidos.' },
    { emoji: '📋', titulo: 'Importar desde Excel', texto: 'Sube un .xlsx con múltiples clientes a la vez. Descarga la plantilla de ejemplo para ver el formato de columnas requerido.' },
    { emoji: '🏫', titulo: 'Modo Educativo', texto: 'La validación de cédula usa el algoritmo oficial del Registro Civil ecuatoriano. Aprende cómo funciona el dígito verificador.' },
  ];
  const [paso, setPaso] = React.useState(0);
  const actual = pasos[paso];
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(10,18,40,0.78)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
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
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: 'white', letterSpacing: '0.5px' }}>CLIENTES</span>
            <span style={{ background: '#fbbf24', borderRadius: '99px', padding: '0.2rem 0.65rem', fontSize: '0.67rem', fontWeight: '800', color: '#78350f' }}>EDUCATIVO</span>
          </div>
          <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'white', paddingRight: '2rem' }}>Gestión de Clientes</p>
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

const BannerEdu_CLI = ({ onClose, onVerTutorial }) => (
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

const BarraModoEdu_CLI = ({ onVerTutorial }) => (
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

const GestionClientes = () => {

  // ── Tour educativo — primera visita ──────────────────────────────
  const [tourVisto_CLI, setTourVisto_CLI] = useState(
    () => !!localStorage.getItem(TOUR_KEY_CLI)
  );
  const [mostrarEdu_CLI, setMostrarEdu_CLI] = useState(false);
  const cerrarTour_CLI = () => {
    localStorage.setItem(TOUR_KEY_CLI, '1');
    setTourVisto_CLI(true);
    setMostrarEdu_CLI(true);
    setTimeout(() => setMostrarEdu_CLI(false), 30000);
  };
  const verTutorial_CLI = () => {
    localStorage.removeItem(TOUR_KEY_CLI);
    setTourVisto_CLI(false);
    setMostrarEdu_CLI(false);
  };
  const POR_PAGINA = 10;

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorApi, setErrorApi] = useState('');
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  const [modalImportar, setModalImportar] = useState(false);
  const [exportando, setExportando] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientesService.listar({ pagina, porPagina: POR_PAGINA, buscar: buscar || undefined });
      setClientes(res.items || []);
      setTotal(res.total || 0);
      setTotalPaginas(res.total_paginas || 1);
    } catch {
      setErrorApi('Error cargando clientes.');
    } finally {
      setLoading(false);
    }
  }, [pagina, buscar]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const t = setTimeout(() => setPagina(1), 400);
    return () => clearTimeout(t);
  }, [buscar]);

  const abrirNuevo = () => { setClienteEditando(null); setErrorApi(''); setModalAbierto(true); };
  const abrirEditar = (c) => { setClienteEditando(c); setErrorApi(''); setModalAbierto(true); };

  const guardar = async (form) => {
    setGuardando(true); setErrorApi('');
    try {
      if (clienteEditando) await clientesService.actualizar(clienteEditando.id_persona_comercial, form);
      else await clientesService.crear(form);
      setModalAbierto(false);
      cargar();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setErrorApi(Array.isArray(detail) ? detail.map(d => d.msg).join(' / ') : (detail || 'Error al guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id) => {
    try {
      await clientesService.eliminar(id);
      setConfirmEliminar(null);
      cargar();
    } catch (e) {
      setErrorApi(e?.response?.data?.detail || 'Error al eliminar.');
    }
  };

  // Exportar usando el endpoint del backend (CSV o XLSX)
  const exportar = async (formato) => {
    setExportando(formato);
    try {
      const params = new URLSearchParams();
      if (buscar) params.append('buscar', buscar);
      const url = `${API}/clientes/exportar/${formato}?${params}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = `clientes.${formato}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch {
      alert(`No se pudo exportar el ${formato.toUpperCase()}.`);
    } finally {
      setExportando(null);
    }
  };

  const COLORS = ['#0ea5e9', '#8b5cf6', '#f97316', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <div style={{ padding: '1.4rem 1.5rem', fontFamily: "'Nunito','Segoe UI',system-ui,sans-serif" }}>
      {/* ── Tour educativo ── */}
      {!tourVisto_CLI && <TourBienvenida_CLI onCerrar={cerrarTour_CLI} />}
      {mostrarEdu_CLI && <BannerEdu_CLI onClose={() => setMostrarEdu_CLI(false)} onVerTutorial={verTutorial_CLI} />}
      <BarraModoEdu_CLI onVerTutorial={verTutorial_CLI} />



      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.4rem', flexWrap: 'wrap', gap: '1rem' }}>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
          <strong style={{ color: '#334155' }}>{total}</strong> cliente{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Botón XLSX */}
          <button onClick={() => exportar('xlsx')} disabled={exportando !== null}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', cursor: exportando ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: '700', fontSize: '0.8rem', fontFamily: 'inherit', transition: 'all 0.15s', opacity: exportando ? 0.6 : 1 }}
            onMouseEnter={e => { if (!exportando) { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {exportando === 'xlsx' ? 'Exportando…' : 'XLSX'}
          </button>

          <button onClick={() => setModalImportar(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 0.9rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#475569', fontWeight: '700', fontSize: '0.8rem', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar
          </button>

          <button onClick={abrirNuevo}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.8rem', borderRadius: '12px', border: 'none', cursor: 'pointer', background: 'linear-gradient(90deg,#15389a,#2563eb)', color: 'white', fontWeight: '700', fontSize: '0.85rem', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(21,56,154,0.33)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(21,56,154,0.45)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(21,56,154,0.33)'; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '1.2rem', maxWidth: '420px' }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)}
          placeholder="Buscar por nombre, cédula o email..."
          style={{ ...inputStyle(false), paddingLeft: '2.4rem', background: 'white' }}
          onFocus={e => e.target.style.borderColor = '#3b82f6'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
        <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        {buscar && (
          <button onClick={() => setBuscar('')}
            style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
      </div>

      {errorApi && (
        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#b91c1c', fontSize: '0.83rem', marginBottom: '1rem' }}>
          ⚠️ {errorApi}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', animation: 'fadeUp 0.4s ease 0.1s both' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 160px 180px 130px 80px', padding: '0.7rem 1.4rem', borderBottom: '2px solid #f1f5f9', background: '#fafafa' }}>
          {['', 'Cliente', 'Identificación', 'Email', 'Teléfono', 'Acciones'].map(h => (
            <span key={h} style={{ fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
          ))}
        </div>

        {loading && Array.from({ length: POR_PAGINA }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 160px 180px 130px 80px', padding: '0.85rem 1.4rem', alignItems: 'center', borderBottom: i < POR_PAGINA - 1 ? '1px solid #f8fafc' : 'none', gap: '0.5rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#e2e8f0' }} />
            {[140, 100, 150, 80, 60].map((w, j) => (
              <div key={j} style={{ height: '13px', width: `${w}px`, borderRadius: '6px', background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            ))}
          </div>
        ))}

        {!loading && clientes.length === 0 && (
          <div style={{ padding: '3.5rem', textAlign: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p style={{ margin: 0, fontWeight: '800', fontSize: '1rem', color: '#64748b' }}>
              {buscar ? 'Sin resultados para esa búsqueda' : 'No hay clientes aún'}
            </p>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              {buscar ? 'Intenta con otro término' : 'Haz clic en "Nuevo Cliente" o importa desde CSV / XLSX'}
            </p>
          </div>
        )}

        {!loading && clientes.map((c, i) => (
          <div key={c.id_persona_comercial}
            style={{ display: 'grid', gridTemplateColumns: '44px 1fr 160px 180px 130px 80px', padding: '0.78rem 1.4rem', alignItems: 'center', borderBottom: i < clientes.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.12s', animation: `fadeUp 0.3s ease ${i * 0.04}s both` }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: '800', color: 'white', flexShrink: 0 }}>
              {(c.nombres_apellidos || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombres_apellidos}</div>
              {c.razon_social && <div style={{ fontSize: '0.71rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.razon_social}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.67rem', background: '#f1f5f9', borderRadius: '5px', padding: '2px 5px', fontWeight: '700', color: '#64748b', flexShrink: 0 }}>{c.tipo_identificacion}</span>
              <span style={{ fontSize: '0.8rem', color: '#475569', fontFamily: 'monospace' }}>{c.identificacion}</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || '—'}</span>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>{c.telefono || '—'}</span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button onClick={() => abrirEditar(c)} title="Editar"
                style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1.5px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.13s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
              <button onClick={() => setConfirmEliminar(c)} title="Eliminar"
                style={{ width: '28px', height: '28px', borderRadius: '7px', border: '1.5px solid #fecaca', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', transition: 'all 0.13s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
              </button>
            </div>
          </div>
        ))}

        {!loading && totalPaginas > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.4rem', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '600' }}>
              Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, total)}–{Math.min(pagina * POR_PAGINA, total)} de {total}
            </span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <PaginBtn onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </PaginBtn>
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let page = i + 1;
                if (totalPaginas > 5) {
                  if (pagina <= 3) page = i + 1;
                  else if (pagina >= totalPaginas - 2) page = totalPaginas - 4 + i;
                  else page = pagina - 2 + i;
                }
                return <PaginBtn key={page} onClick={() => setPagina(page)} active={pagina === page}>{page}</PaginBtn>;
              })}
              <PaginBtn onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </PaginBtn>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalAbierto} onClose={() => setModalAbierto(false)} title={clienteEditando ? 'Editar Cliente' : 'Nuevo Cliente'}>
        <FormCliente inicial={clienteEditando} onGuardar={guardar} onCancelar={() => setModalAbierto(false)} loading={guardando} error={errorApi} />
      </Modal>

      <Modal open={!!confirmEliminar} onClose={() => setConfirmEliminar(null)} title="Eliminar Cliente">
        <p style={{ color: '#475569', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
          ¿Estás seguro que deseas eliminar a <strong>{confirmEliminar?.nombres_apellidos}</strong>? Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={() => setConfirmEliminar(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '600', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => eliminar(confirmEliminar.id_persona_comercial)} style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', border: 'none', background: '#ef4444', color: 'white', fontWeight: '700', fontSize: '0.87rem', fontFamily: 'inherit', cursor: 'pointer' }}>Sí, eliminar</button>
        </div>
      </Modal>

      <ModalImportar open={modalImportar} onClose={() => setModalImportar(false)} onImportado={cargar} />

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

export default GestionClientes;
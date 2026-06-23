// ════════════════════════════════════════════════════════
// PrintViewSRI.jsx — Formato de impresión estilo SRI Ecuador
//
// Props:
//   factura: { numeroComprobante, fecha, cliente, lineas,
//              totales, ivaGeneral, observaciones, estado }
//   negocio: datos devueltos por negocioService.obtener()
//   logoNegocio: (opcional) URL del logo pasada desde el Dashboard
//               context, con cache-bust ya aplicado.
//               Si se provee, tiene prioridad sobre negocio.logo_url.
// ════════════════════════════════════════════════════════
import React from 'react';

const API_BASE = 'http://localhost:8000';

const fmt   = (v) => parseFloat(v || 0).toFixed(2);
const fecha = (s) => { if (!s) return '—'; const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };

// Construye URL absoluta con cache-bust para evitar imagen cacheada
const buildLogoUrl = (url) => {
  if (!url) return null;
  const base = url.startsWith('http') ? url : `${API_BASE}${url}`;
  // Redondeamos a minutos para no generar una URL diferente en cada render
  return `${base}?t=${Math.floor(Date.now() / 60000)}`;
};

const PrintViewSRI = ({ factura, negocio, logoNegocio }) => {
  if (!factura) return null;
  const { numeroComprobante = '001-001-000000001', fecha: fechaEmision,
          cliente, lineas = [], totales, ivaGeneral = 15,
          observaciones, estado } = factura;
  const neg = negocio || {};

  const subTotal  = (totales?.sub0 || 0) + (totales?.subIva || 0);
  const descuento = totales?.desc  || 0;
  const iva       = totales?.iva   || 0;
  const total     = totales?.total || 0;

  // Simular número de autorización
  const claveAcceso = `${(fechaEmision||'').replace(/-/g,'')}01${neg.ruc||'0000000000001'}${(numeroComprobante||'').replace(/-/g,'')}001`;

  // ── Logo: prioridad al prop logoNegocio (viene del Context, ya actualizado)
  // Si no viene, cae a negocio.logo_url con cache-bust.
  const logoSrc = logoNegocio
    ? buildLogoUrl(logoNegocio)
    : buildLogoUrl(neg.logo_url);

  return (
    <div id="print-area">
      <div className="sri-wrap">

        {/* ══ CABECERA ═══════════════════════════════════ */}
        <table className="sri-header">
          <tbody><tr>

            {/* Logo + datos del emisor */}
            <td className="sri-header-left">
              {logoSrc
                ? <img
                    src={logoSrc}
                    alt="logo"
                    className="sri-logo"
                    onError={e => e.target.style.display='none'}
                  />
                : <div className="sri-logo-box">
                    {neg.nombre_comercial || neg.razon_social || 'NEGOCIO'}
                  </div>
              }
              <p className="sri-nombre-grande">{neg.nombre_comercial || neg.razon_social || 'NOMBRE DEL NEGOCIO'}</p>
              <p className="sri-dato"><b>{neg.razon_social}</b></p>
              {neg.direccion_matriz   && <p className="sri-dato"><b>Dir. Matriz:</b> {neg.direccion_matriz}</p>}
              {neg.direccion_sucursal && <p className="sri-dato"><b>Dir. Sucursal:</b> {neg.direccion_sucursal}</p>}
              <p className="sri-dato"><b>Obligado A Llevar Contabilidad:</b> {neg.obligado_contabilidad ? 'SÍ' : 'NO'}</p>
              {neg.contribuyente && <p className="sri-dato"><b>Contribuyente Régimen {neg.contribuyente}</b></p>}
            </td>

            {/* Datos del comprobante */}
            <td className="sri-header-right">
              <table className="sri-comp-box">
                <tbody>
                  <tr><td className="sri-comp-row"><b>R.U.C:</b></td><td className="sri-comp-val">{neg.ruc || '—'}</td></tr>
                  <tr><td className="sri-comp-row sri-factura-title" colSpan="2">FACTURA</td></tr>
                  <tr><td className="sri-comp-row">No.</td><td className="sri-comp-val sri-mono">{numeroComprobante}</td></tr>
                  <tr><td className="sri-comp-row" colSpan="2"><b>NÚMERO AUTORIZACIÓN</b></td></tr>
                  <tr><td className="sri-comp-row sri-mono sri-small" colSpan="2" style={{wordBreak:'break-all'}}>{claveAcceso}</td></tr>
                  <tr><td className="sri-comp-row">FECHA Y HORA DE AUTORIZACIÓN</td><td className="sri-comp-val">{fecha(fechaEmision)} 00:00:00-05:00</td></tr>
                  <tr><td className="sri-comp-row">AMBIENTE:</td><td className="sri-comp-val">{neg.ambiente || 'Pruebas'}</td></tr>
                  <tr><td className="sri-comp-row">EMISIÓN:</td><td className="sri-comp-val">Normal</td></tr>
                </tbody>
              </table>
              {/* Clave de acceso */}
              <div className="sri-clave-box">
                <p className="sri-clave-titulo">CLAVE DE ACCESO</p>
                <div className="sri-barcode">
                  {Array.from({length:50}).map((_,i)=>(
                    <span key={i} style={{display:'inline-block', width: i%3===0?'3px':i%2===0?'1px':'2px', height:'28px', background: i%2===0?'#000':'transparent', verticalAlign:'middle'}}/>
                  ))}
                </div>
                <p className="sri-mono sri-small" style={{wordBreak:'break-all',margin:'2px 0 0'}}>{claveAcceso}</p>
              </div>
            </td>

          </tr></tbody>
        </table>

        {/* ══ DATOS DEL RECEPTOR ═════════════════════════ */}
        <table className="sri-receptor">
          <tbody>
            <tr>
              <td className="sri-rec-td"><span className="sri-rec-label">Razón Social / Nombres y Apellidos:</span> {cliente?.nombres_apellidos || cliente?.razon_social || '—'}</td>
              <td className="sri-rec-td"><span className="sri-rec-label">RUC / CI:</span> {cliente?.identificacion || '—'}</td>
            </tr>
            <tr>
              <td className="sri-rec-td"><span className="sri-rec-label">Fecha Emisión:</span> {fecha(fechaEmision)}</td>
              <td className="sri-rec-td"><span className="sri-rec-label">Guía de Remisión:</span> —</td>
            </tr>
          </tbody>
        </table>

        {/* ══ DETALLE DE PRODUCTOS ════════════════════════ */}
        <table className="sri-detalle">
          <thead>
            <tr className="sri-th-row">
              <th className="sri-th">Cod. Principal</th>
              <th className="sri-th">Cod. Auxiliar</th>
              <th className="sri-th sri-center">Cant.</th>
              <th className="sri-th sri-desc">Descripción</th>
              <th className="sri-th sri-right">Precio Unitario</th>
              <th className="sri-th sri-right">Descuento</th>
              <th className="sri-th sri-right">Precio Total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const sub  = parseFloat(l.cantidad) * parseFloat(l.precio);
              const desc = parseFloat(l.descuento || 0);
              const base = sub - desc;
              return (
                <tr key={i} style={{ background: i%2===0 ? 'white' : '#f9f9f9' }}>
                  <td className="sri-td sri-mono">{l.codigo || '—'}</td>
                  <td className="sri-td">—</td>
                  <td className="sri-td sri-center">{l.cantidad}</td>
                  <td className="sri-td"><b>{l.nombre}</b></td>
                  <td className="sri-td sri-right">${parseFloat(l.precio).toFixed(5)}</td>
                  <td className="sri-td sri-right">0% $0.00</td>
                  <td className="sri-td sri-right">${fmt(base)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ══ FORMA DE PAGO + TOTALES ═════════════════════ */}
        <table className="sri-bottom">
          <tbody><tr>

            {/* Forma de pago e info adicional */}
            <td className="sri-pago-cell">
              <table className="sri-pago">
                <thead>
                  <tr><th className="sri-section-title" colSpan="4">Forma de Pago</th></tr>
                  <tr>
                    <th className="sri-pago-th">Forma de Pago</th>
                    <th className="sri-pago-th sri-right">Valor</th>
                    <th className="sri-pago-th sri-right">Plazo</th>
                    <th className="sri-pago-th">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="sri-pago-td">SIN UTILIZACION DEL SISTEMA FINANCIERO</td>
                    <td className="sri-pago-td sri-right">${fmt(total)}</td>
                    <td className="sri-pago-td sri-right">0</td>
                    <td className="sri-pago-td">dias</td>
                  </tr>
                </tbody>
              </table>
              {/* Información adicional */}
              <table className="sri-pago" style={{marginTop:'4px'}}>
                <thead>
                  <tr><th className="sri-section-title" colSpan="2">Información Adicional</th></tr>
                </thead>
                <tbody>
                  {cliente?.direccion && <tr><td className="sri-pago-th">DIRECCIÓN</td><td className="sri-pago-td">{cliente.direccion}</td></tr>}
                  {neg.telefono       && <tr><td className="sri-pago-th">TELEFONO</td> <td className="sri-pago-td">{neg.telefono}</td></tr>}
                  {neg.email          && <tr><td className="sri-pago-th">EMAIL</td>    <td className="sri-pago-td">{neg.email}</td></tr>}
                </tbody>
              </table>
            </td>

            {/* Totales */}
            <td className="sri-totales-cell">
              <table className="sri-totales">
                <tbody>
                  {ivaGeneral > 0 && <FilaTotal label={`SUBTOTAL ${ivaGeneral}%`} valor={totales?.subIva||0} />}
                  <FilaTotal label="SUBTOTAL 0%"            valor={totales?.sub0||0} />
                  <FilaTotal label="SUBTOTAL NO OBJETO IVA" valor={0} />
                  <FilaTotal label="SUBTOTAL EXENTO IVA"    valor={0} />
                  <FilaTotal label="SUBTOTAL SIN IMPUESTOS" valor={subTotal} />
                  <FilaTotal label="DESCUENTO"              valor={descuento} />
                  <FilaTotal label="ICE"                    valor={0} />
                  {ivaGeneral > 0 && <FilaTotal label={`IVA ${ivaGeneral}%`} valor={iva} />}
                  <FilaTotal label="PROPINA"                valor={0} />
                  <FilaTotal label="VALOR TOTAL"            valor={total} bold />
                  <FilaTotal label="VALOR A PAGAR"          valor={total} bold />
                </tbody>
              </table>
            </td>

          </tr></tbody>
        </table>

        {/* Observaciones */}
        {observaciones && (
          <div className="sri-obs"><b>Observaciones:</b> {observaciones}</div>
        )}

        {/* Pie */}
        <div className="sri-footer">
          <span>Página 1 de 1</span>
          <span>{estado === 'borrador' ? '⚠ BORRADOR — No válido como comprobante' : 'Generado por FactuStock'}</span>
        </div>
      </div>

      {/* ══ CSS DE IMPRESIÓN ════════════════════════════ */}
      <style>{`
        #print-area { display:none; }
        @media print {
          * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          body > * { display:none !important; }
          #print-area { display:block !important; position:fixed; top:0; left:0; width:100%; background:white; padding:0.5cm 1cm; box-sizing:border-box; }
          #print-area * { visibility:visible !important; }
          .no-print { display:none !important; }
        }
        .sri-wrap { max-width:21cm; margin:0 auto; font-family:Arial,Helvetica,sans-serif; font-size:8pt; color:#000; }

        /* Cabecera */
        .sri-header { width:100%; border-collapse:collapse; border:1px solid #000; }
        .sri-header-left  { width:55%; padding:8px 10px; vertical-align:top; border-right:1px solid #000; }
        .sri-header-right { width:45%; padding:8px 10px; vertical-align:top; }
        .sri-logo      { max-height:75px; max-width:150px; object-fit:contain; display:block; margin-bottom:5px; }
        .sri-logo-box  { width:110px; height:55px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:8pt; font-weight:700; color:#64748b; text-align:center; border:1px solid #e2e8f0; margin-bottom:5px; border-radius:3px; }
        .sri-nombre-grande { margin:0 0 2px; font-size:13pt; font-weight:900; }
        .sri-dato { margin:0 0 1px; font-size:7.5pt; }

        /* Comprobante box derecho */
        .sri-comp-box  { width:100%; border-collapse:collapse; border:1px solid #000; font-size:7.5pt; }
        .sri-comp-box td { padding:3px 6px; border-bottom:1px solid #ccc; }
        .sri-comp-row  { font-weight:600; }
        .sri-comp-val  { }
        .sri-factura-title { font-size:12pt; font-weight:900; }

        /* Clave de acceso */
        .sri-clave-box   { border:1px solid #000; padding:4px; margin-top:5px; text-align:center; }
        .sri-clave-titulo { margin:0 0 2px; font-weight:900; font-size:8pt; }
        .sri-barcode     { height:30px; line-height:0; margin:3px 0; }

        /* Receptor */
        .sri-receptor { width:100%; border-collapse:collapse; border:1px solid #000; border-top:none; font-size:7.5pt; }
        .sri-rec-td   { padding:4px 8px; border-right:1px solid #ccc; border-bottom:1px solid #ccc; }
        .sri-rec-label { font-weight:700; }

        /* Detalle */
        .sri-detalle  { width:100%; border-collapse:collapse; border:1px solid #000; border-top:none; font-size:7.5pt; }
        .sri-th-row   { background:#1e1b4b; color:white; }
        .sri-th       { padding:4px 6px; font-size:7pt; font-weight:700; text-transform:uppercase; border-right:1px solid #444; text-align:left; }
        .sri-desc     { width:35%; }
        .sri-td       { padding:3px 6px; border-bottom:1px solid #eee; border-right:1px solid #eee; vertical-align:top; }
        .sri-center   { text-align:center; }
        .sri-right    { text-align:right; }
        .sri-mono     { font-family:'Courier New',monospace; }
        .sri-small    { font-size:6.5pt; }

        /* Pago y totales */
        .sri-bottom       { width:100%; border-collapse:collapse; border:1px solid #000; border-top:none; font-size:7.5pt; }
        .sri-pago-cell    { width:55%; vertical-align:top; border-right:1px solid #000; padding:0; }
        .sri-totales-cell { width:45%; vertical-align:top; padding:0; }
        .sri-pago         { width:100%; border-collapse:collapse; font-size:7pt; }
        .sri-section-title { background:#e5e7eb; padding:3px 6px; font-weight:700; text-align:center; border-bottom:1px solid #ccc; }
        .sri-pago-th      { padding:3px 6px; border-bottom:1px solid #ccc; border-right:1px solid #ccc; font-weight:700; font-size:6.5pt; }
        .sri-pago-td      { padding:3px 6px; border-bottom:1px solid #eee; border-right:1px solid #eee; font-size:6.5pt; }
        .sri-totales      { width:100%; border-collapse:collapse; font-size:7.5pt; }

        .sri-obs    { padding:4px 8px; font-size:7.5pt; border:1px solid #000; border-top:none; }
        .sri-footer { display:flex; justify-content:space-between; font-size:6.5pt; color:#666; padding:3px 8px; border:1px solid #000; border-top:none; }
      `}</style>
    </div>
  );
};

const FilaTotal = ({ label, valor, bold }) => (
  <tr>
    <td style={{ padding:'3px 8px', borderBottom:'1px solid #eee', fontWeight: bold?'900':'400', fontSize:'7.5pt' }}>{label}</td>
    <td style={{ padding:'3px 8px', borderBottom:'1px solid #eee', textAlign:'right', fontWeight: bold?'900':'400', fontFamily:"'Courier New',monospace", fontSize:'7.5pt' }}>
      $ &nbsp;{parseFloat(valor).toFixed(2)}
    </td>
  </tr>
);

export default PrintViewSRI;
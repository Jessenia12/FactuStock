import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, X, AlertCircle, CheckCircle, Loader, Mail } from 'lucide-react';
import { authService } from '../services/api';
import loginIllustration from '../assets/login-illustration.png';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/* ══════════════════════════════════════════════
   PANEL IZQUIERDO ANIMADO
══════════════════════════════════════════════ */
const AnimatedPanel = () => {
  const canvasRef = useRef(null);
  const phrases = [
    'Aprende gestionando inventarios',
    'Facturación aplicada',
    'Educación con herramientas reales',
    'Formando estudiantes del mañana',
    'Inventario + Facturación = Aprendizaje',
  ];
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayed, setDisplayed]     = useState('');
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => {
    const current = phrases[phraseIndex];
    let timeout;
    if (!deleting && displayed.length < current.length)
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 72);
    else if (!deleting && displayed.length === current.length)
      timeout = setTimeout(() => setDeleting(true), 2200);
    else if (deleting && displayed.length > 0)
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 38);
    else { setDeleting(false); setPhraseIndex((phraseIndex + 1) % phrases.length); }
    return () => clearTimeout(timeout);
  }, [displayed, deleting, phraseIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId, W, H;
    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const N = 55;
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * (W || 600), y: Math.random() * (H || 800),
      r: Math.random() * 2.5 + 0.8,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      alpha: Math.random() * 0.6 + 0.2,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) { ctx.beginPath(); ctx.strokeStyle = `rgba(255,255,255,${0.18*(1-dist/100)})`; ctx.lineWidth=0.7; ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke(); }
        }
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x<0) p.x=W; if (p.x>W) p.x=0; if (p.y<0) p.y=H; if (p.y>H) p.y=0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${p.alpha})`; ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div style={{ flex: '0 0 55%', position: 'relative', overflow: 'hidden', borderRadius: '0 50% 50% 0 / 0 50% 50% 0' }}>
      <img src={loginIllustration} alt="Ilustración" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', display:'block' }} />
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, rgba(14,36,89,0.75) 0%, rgba(29,78,216,0.58) 50%, rgba(99,179,237,0.30) 100%)', animation:'gradientShift 6s ease-in-out infinite alternate' }} />
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'13% 2rem 2rem', textAlign:'center' }}>
        <h1 style={{ fontSize:'3.2rem', fontWeight:'900', color:'#ffffff', margin:'0 0 0.2rem', letterSpacing:'-1.5px', textShadow:'0 4px 24px rgba(0,0,0,0.4)', animation:'fadeSlideIn 0.9s ease both', lineHeight:1.05 }}>FactuStock</h1>
        <p style={{ fontSize:'0.99rem', color:'rgba(255,255,255,0.52)', margin:'0.45rem 0 1.8rem', fontWeight:'400', letterSpacing:'2px', textTransform:'uppercase', animation:'fadeSlideIn 0.9s ease 0.18s both' }}>Sistema educativo de gestión</p>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'0.6rem', background:'rgba(255,255,255,0.10)', backdropFilter:'blur(10px)', border:'1px solid rgba(255,255,255,0.22)', borderRadius:'99px', padding:'0.55rem 1.25rem 0.55rem 0.75rem', boxShadow:'0 8px 30px rgba(0,0,0,0.15)' }}>
          <span style={{ display:'inline-block', width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#36985b', flexShrink:0, animation:'pulse 1.8s ease-in-out infinite' }} />
          <span style={{ fontSize:'1.0rem', color:'rgba(255,255,255,0.95)', fontWeight:'600', minWidth:'260px', textAlign:'left', textShadow:'0 1px 6px rgba(0,0,0,0.2)' }}>
            {displayed}<span style={{ animation:'blink 1s step-end infinite' }}>|</span>
          </span>
        </div>
        <div style={{ marginTop:'2rem', height:'2px', borderRadius:'99px', background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation:'lineGrow 2s ease-in-out infinite alternate' }} />
      </div>
      <style>{`
        @keyframes gradientShift{from{opacity:1}to{opacity:.82}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lineGrow{from{width:40px}to{width:85px}}
        @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(96,165,250,.7)}70%{box-shadow:0 0 0 8px rgba(96,165,250,0)}100%{box-shadow:0 0 0 0 rgba(96,165,250,0)}}
        @keyframes modalIn{from{opacity:0;transform:scale(.93) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes overlayIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
};


/* ══════════════════════════════════════════════
   MODAL DE RECUPERACIÓN
══════════════════════════════════════════════ */
const ModalRecuperacion = ({ onClose }) => {
  const [tab, setTab]         = useState('estudiante');
  const [paso, setPaso]       = useState('form');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [respuesta, setRespuesta] = useState(null);

  // Estudiante
  const [cedulaEmail, setCedulaEmail] = useState('');
  const [motivo, setMotivo]           = useState('');

  // Docente
  const [cedula, setCedula] = useState('');

  const cambiarTab = (t) => { setTab(t); setPaso('form'); setError(''); setRespuesta(null); };

  // ── Estudiante ──────────────────────────────────────────
  const enviarEstudiante = async () => {
    if (!cedulaEmail.trim()) { setError('Ingresa tu cédula o correo.'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/auth/solicitar-recuperacion`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula_o_email: cedulaEmail.trim(), motivo: motivo.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok === false) { setError(data.mensaje); return; }
      setRespuesta(data); setPaso('exito');
    } catch { setError('Error de conexión con el servidor.'); }
    finally { setLoading(false); }
  };

  // ── Docente ─────────────────────────────────────────────
  const recuperarDocente = async () => {
    if (!cedula.trim()) { setError('Ingresa tu número de cédula.'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/auth/recuperar-docente`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cedula.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Ocurrió un error. Intenta de nuevo.'); return; }
      setRespuesta(data); setPaso('exito');
    } catch { setError('Error de conexión con el servidor.'); }
    finally { setLoading(false); }
  };

  // ── Estilos comunes ─────────────────────────────────────
  const inp = { width:'100%', padding:'0.75rem 1rem 0.75rem 2.4rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.88rem', color:'#334155', outline:'none', backgroundColor:'#f8fafc', boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:'0.84rem', fontWeight:'600', color:'#1e293b', marginBottom:'0.3rem' };

  return (
    <div onClick={e => e.target===e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, backgroundColor:'rgba(10,20,50,0.55)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'1rem', animation:'overlayIn 0.2s ease' }}>

      <div style={{ backgroundColor:'#fff', borderRadius:'20px', padding:'2rem 2.2rem 1.8rem', width:'100%', maxWidth:'420px', position:'relative', boxShadow:'0 24px 64px rgba(0,0,0,0.22)', animation:'modalIn 0.25s ease', maxHeight:'90vh', overflowY:'auto' }}>

        <button onClick={onClose} style={{ position:'absolute', top:'1rem', right:'1rem', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:'4px', display:'flex' }}>
          <X size={20} />
        </button>

        {/* ── FORMULARIO ── */}
        {paso === 'form' && (
          <>
            <div style={{ textAlign:'center', marginBottom:'1.2rem' }}>
              <div style={{ width:'48px', height:'48px', borderRadius:'14px', background:'linear-gradient(135deg,#dbeafe,#bfdbfe)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 0.7rem' }}>
                <Lock size={22} color="#2563eb" />
              </div>
              <h3 style={{ fontSize:'1.15rem', fontWeight:'800', color:'#0f172a', margin:0 }}>Recuperar contraseña</h3>
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', backgroundColor:'#f1f5f9', borderRadius:'12px', padding:'3px', marginBottom:'1.2rem', gap:'3px' }}>
              {[['estudiante','👨‍🎓 Soy estudiante'],['docente','👨‍🏫 Soy docente']].map(([k, label]) => (
                <button key={k} onClick={() => cambiarTab(k)}
                  style={{ flex:1, padding:'0.55rem 0.5rem', fontSize:'0.81rem', fontWeight: tab===k ? '700' : '500', borderRadius:'9px', border:'none', cursor:'pointer', backgroundColor: tab===k ? '#fff' : 'transparent', color: tab===k ? '#1e40af' : '#64748b', boxShadow: tab===k ? '0 1px 6px rgba(0,0,0,0.1)' : 'none', transition:'all 0.18s' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginBottom:'0.9rem', padding:'0.6rem 0.85rem', backgroundColor:'#fef2f2', borderLeft:'3px solid #ef4444', borderRadius:'8px', display:'flex', gap:'0.45rem', alignItems:'flex-start' }}>
                <AlertCircle size={14} color="#ef4444" style={{ flexShrink:0, marginTop:'2px' }} />
                <p style={{ color:'#b91c1c', fontSize:'0.81rem', margin:0 }}>{error}</p>
              </div>
            )}

            {/* ── TAB ESTUDIANTE ── */}
            {tab === 'estudiante' && (
              <>
                <div style={{ marginBottom:'0.9rem' }}>
                  <label style={lbl}>Cédula o correo electrónico <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', top:'50%', left:'0.75rem', transform:'translateY(-50%)', pointerEvents:'none' }}><User size={14} color="#94a3b8" /></div>
                    <input type="text" value={cedulaEmail} onChange={e => setCedulaEmail(e.target.value)}
                      placeholder="1234567890 o tu@email.com" style={inp}
                      onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                  </div>
                </div>

                <div style={{ marginBottom:'1rem' }}>
                  <label style={lbl}>Motivo <span style={{ fontSize:'0.76rem', fontWeight:'400', color:'#94a3b8' }}>(opcional)</span></label>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
                    placeholder="Ej: No recuerdo mi contraseña..." rows={2}
                    style={{ width:'100%', padding:'0.7rem 1rem', border:'1.5px solid #e2e8f0', borderRadius:'10px', fontSize:'0.88rem', color:'#334155', outline:'none', resize:'none', boxSizing:'border-box', fontFamily:'inherit', backgroundColor:'#f8fafc' }}
                    onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                </div>

                <div style={{ marginBottom:'1.2rem', padding:'0.65rem 0.9rem', backgroundColor:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe' }}>
                  <p style={{ fontSize:'0.79rem', color:'#1d4ed8', margin:0, lineHeight:1.55 }}>
                    El docente revisará tu solicitud y te dará una contraseña temporal.
                  </p>
                </div>

                <div style={{ display:'flex', gap:'0.65rem' }}>
                  <button onClick={onClose} style={{ flex:1, padding:'0.75rem', backgroundColor:'#f1f5f9', color:'#475569', fontWeight:'600', fontSize:'0.87rem', borderRadius:'10px', border:'none', cursor:'pointer' }}>Cancelar</button>
                  <button onClick={enviarEstudiante} disabled={loading}
                    style={{ flex:2, padding:'0.75rem', backgroundColor: loading ? '#93c5fd' : '#15389a', color:'#fff', fontWeight:'700', fontSize:'0.87rem', borderRadius:'10px', border:'none', cursor: loading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.45rem' }}>
                    {loading ? <><Loader size={14} style={{ animation:'spin 1s linear infinite' }} />Enviando...</> : 'Enviar solicitud'}
                  </button>
                </div>
              </>
            )}

            {/* ── TAB DOCENTE ── solo cédula, llega por correo ── */}
            {tab === 'docente' && (
              <>
                {/* Ilustración correo */}
                <div style={{ textAlign:'center', marginBottom:'1.1rem' }}>
                  <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:'linear-gradient(135deg,#eff6ff,#dbeafe)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 0.6rem' }}>
                    <Mail size={26} color="#2563eb" />
                  </div>
                  <p style={{ fontSize:'0.85rem', color:'#475569', margin:0, lineHeight:1.6 }}>
                    Ingresa tu cédula y te enviaremos una contraseña temporal al correo registrado en tu cuenta.
                  </p>
                </div>

                <div style={{ marginBottom:'1.2rem' }}>
                  <label style={lbl}>Tu cédula <span style={{ color:'#ef4444' }}>*</span></label>
                  <div style={{ position:'relative' }}>
                    <div style={{ position:'absolute', top:'50%', left:'0.75rem', transform:'translateY(-50%)', pointerEvents:'none' }}><User size={14} color="#94a3b8" /></div>
                    <input type="text" value={cedula} onChange={e => setCedula(e.target.value)}
                      placeholder="Número de cédula" style={inp}
                      onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'}
                      onKeyDown={e => e.key === 'Enter' && recuperarDocente()} />
                  </div>
                </div>

                <div style={{ display:'flex', gap:'0.65rem' }}>
                  <button onClick={onClose} style={{ flex:1, padding:'0.75rem', backgroundColor:'#f1f5f9', color:'#475569', fontWeight:'600', fontSize:'0.87rem', borderRadius:'10px', border:'none', cursor:'pointer' }}>Cancelar</button>
                  <button onClick={recuperarDocente} disabled={loading}
                    style={{ flex:2, padding:'0.75rem', backgroundColor: loading ? '#93c5fd' : '#15389a', color:'#fff', fontWeight:'700', fontSize:'0.87rem', borderRadius:'10px', border:'none', cursor: loading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.45rem' }}>
                    {loading ? <><Loader size={14} style={{ animation:'spin 1s linear infinite' }} />Enviando...</> : 'Enviar correo'}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── ÉXITO ── */}
        {paso === 'exito' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'linear-gradient(135deg,#dcfce7,#bbf7d0)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem' }}>
              <CheckCircle size={28} color="#16a34a" />
            </div>

            {tab === 'estudiante' ? (
              <>
                <h3 style={{ fontSize:'1.1rem', fontWeight:'800', color:'#0f172a', margin:'0 0 0.5rem' }}>¡Solicitud enviada!</h3>
                <p style={{ fontSize:'0.85rem', color:'#475569', margin:'0 0 1.2rem', lineHeight:1.6 }}>
                  {respuesta?.mensaje}
                </p>
                <div style={{ backgroundColor:'#f8fafc', borderRadius:'12px', padding:'0.9rem 1rem', marginBottom:'1.2rem', border:'1px solid #e2e8f0', textAlign:'left' }}>
                  <p style={{ fontSize:'0.80rem', color:'#64748b', margin:0, lineHeight:1.7 }}>
                    <strong style={{ color:'#1e293b' }}>Próximos pasos:</strong><br />
                    1. El docente verá tu solicitud en su panel.<br />
                    2. Verificará tu identidad.<br />
                    3. Te comunicará una contraseña temporal.<br />
                    4. Inicia sesión y cámbiala desde tu perfil.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize:'1.1rem', fontWeight:'800', color:'#0f172a', margin:'0 0 0.5rem' }}>¡Correo enviado!</h3>
                <p style={{ fontSize:'0.85rem', color:'#475569', margin:'0 0 1.2rem', lineHeight:1.6 }}>
                  {respuesta?.mensaje}
                </p>
                <div style={{ backgroundColor:'#f8fafc', borderRadius:'12px', padding:'0.9rem 1rem', marginBottom:'1.2rem', border:'1px solid #e2e8f0', textAlign:'left' }}>
                  <p style={{ fontSize:'0.80rem', color:'#64748b', margin:0, lineHeight:1.7 }}>
                    <strong style={{ color:'#1e293b' }}>Próximos pasos:</strong><br />
                    1. Revisa tu bandeja de entrada (y spam).<br />
                    2. Usa la contraseña temporal del correo.<br />
                    3. Cámbiala desde tu perfil al ingresar.
                  </p>
                </div>
              </>
            )}

            <button onClick={onClose}
              style={{ width:'100%', padding:'0.8rem', backgroundColor:'#15389a', color:'#fff', fontWeight:'700', fontSize:'0.9rem', borderRadius:'10px', border:'none', cursor:'pointer' }}>
              Entendido, cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


/* ══════════════════════════════════════════════
   LOGIN PRINCIPAL
══════════════════════════════════════════════ */
const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData]               = useState({ usuario:'', password:'', recordarme:false });
  const [showPassword, setShowPassword]       = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [mostrarRecuperacion, setMostrarRecuperacion] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type==='checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await authService.login(formData.usuario, formData.password, formData.recordarme);
      const rol = result?.usuario?.rol || authService.getCurrentUser()?.rol || '';
      navigate(rol === 'docente' ? '/docente' : '/facturacion');
    } catch (err) {
      setError(err.detail || 'Error al iniciar sesión. Por favor, verifica tus credenciales.');
    } finally { setLoading(false); }
  };

  return (
    <>
      {mostrarRecuperacion && <ModalRecuperacion onClose={() => setMostrarRecuperacion(false)} />}

      <div style={{ display:'flex', minHeight:'100vh', width:'100%', margin:0, padding:0, fontFamily:"'Segoe UI', system-ui, sans-serif", backgroundColor:'#edf5ff', overflow:'hidden' }}>
        <AnimatedPanel />

        <div style={{ flex:1, backgroundColor:'#edf5ff', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem 1.5rem' }}>
          <div style={{ width:'100%', maxWidth:'480px', backgroundColor:'#ffffff', borderRadius:'24px', boxShadow:'0 12px 48px rgba(0,0,0,0.12)', padding:'3rem' }}>

            <h2 style={{ fontSize:'1.75rem', fontWeight:'800', color:'#0f172a', marginBottom:'1.75rem', marginTop:0, letterSpacing:'-0.3px' }}>INICIAR SESIÓN</h2>

            {error && (
              <div style={{ marginBottom:'1rem', padding:'0.75rem 1rem', backgroundColor:'#fef2f2', borderLeft:'4px solid #ef4444', borderRadius:'8px' }}>
                <p style={{ color:'#b91c1c', fontSize:'0.875rem', margin:0 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:'1.1rem' }}>
                <label style={{ display:'block', fontSize:'0.9rem', fontWeight:'600', color:'#1e293b', marginBottom:'0.4rem' }}>Usuario</label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', top:'50%', left:'0.9rem', transform:'translateY(-50%)', pointerEvents:'none', display:'flex' }}><User size={17} color="#94a3b8" /></div>
                  <input type="text" name="usuario" value={formData.usuario} onChange={handleChange} required
                    style={{ width:'100%', paddingLeft:'2.6rem', paddingRight:'1rem', paddingTop:'0.8rem', paddingBottom:'0.8rem', border:'1.5px solid #e2e8f0', borderRadius:'12px', fontSize:'0.92rem', color:'#334155', outline:'none', backgroundColor:'#ffffff', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                </div>
              </div>

              <div style={{ marginBottom:'1.1rem' }}>
                <label style={{ display:'block', fontSize:'0.9rem', fontWeight:'600', color:'#1e293b', marginBottom:'0.4rem' }}>Contraseña</label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', top:'50%', left:'0.9rem', transform:'translateY(-50%)', pointerEvents:'none', display:'flex' }}><Lock size={17} color="#94a3b8" /></div>
                  <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} required
                    style={{ width:'100%', paddingLeft:'2.6rem', paddingRight:'3rem', paddingTop:'0.8rem', paddingBottom:'0.8rem', border:'1.5px solid #e2e8f0', borderRadius:'12px', fontSize:'0.92rem', color:'#334155', outline:'none', backgroundColor:'#ffffff', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='#3b82f6'} onBlur={e => e.target.style.borderColor='#e2e8f0'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position:'absolute', top:'50%', right:'0.9rem', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:0, display:'flex' }}>
                    {showPassword ? <EyeOff size={17} color="#94a3b8" /> : <Eye size={17} color="#94a3b8" />}
                  </button>
                </div>
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.75rem' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer' }}>
                  <div onClick={() => setFormData({ ...formData, recordarme: !formData.recordarme })}
                    style={{ width:'20px', height:'20px', borderRadius:'5px', border: formData.recordarme ? '2px solid #4ade80' : '2px solid #cbd5e1', backgroundColor: formData.recordarme ? '#4ade80' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>
                    {formData.recordarme && <svg width="11" height="11" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  <span style={{ fontSize:'0.85rem', color:'#475569', fontWeight:'500' }}>Recordarme</span>
                </label>
                <button type="button" onClick={() => setMostrarRecuperacion(true)}
                  style={{ fontSize:'0.85rem', color:'#2563eb', fontWeight:'500', background:'none', border:'none', cursor:'pointer', padding:0 }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button type="submit" disabled={loading}
                style={{ width:'100%', padding:'0.9rem', backgroundColor:'#15389a', color:'#ffffff', fontWeight:'700', fontSize:'0.97rem', borderRadius:'12px', border:'none', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing:'0.3px', boxShadow:'0 4px 14px rgba(29,78,216,0.30)', opacity: loading ? 0.7 : 1, transition:'background-color 0.2s' }}
                onMouseEnter={e => { if(!loading) e.target.style.backgroundColor='#102056'; }}
                onMouseLeave={e => { if(!loading) e.target.style.backgroundColor='#17378f'; }}>
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import os

from database import get_db, engine
from models import Base, UsuarioSistema, SesionUsuario
from schemas import LoginRequest, LoginResponse, UsuarioResponse
from auth import verificar_password, crear_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, ACCESS_TOKEN_EXPIRE_DAYS

# ─── Routers ──────────────────────────────────────────────
from routers import (
    facturas, dashboard, clientes, productos, negocio,
    reportes, comprobantes_recibidos, ats,
    notas_credito, notas_debito, retenciones, liquidaciones,
    perfil, proformas,
    docente,
    tarifas_iva,
    recuperar_password,   # ← NUEVO: recuperación de contraseña
)

# Crear tablas (solo desarrollo)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Facturación e Inventario",
    description="API para Unidad Educativa José Ramón Zambrano Bravo",
    version="1.0.0"
)

# ─── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# ─── Archivos estáticos ───────────────────────────────────
os.makedirs("uploads/fotos_perfil",  exist_ok=True)
os.makedirs("uploads/logos_negocio", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ─── Registrar Routers ────────────────────────────────────
app.include_router(facturas.router)
app.include_router(dashboard.router)
app.include_router(clientes.router)
app.include_router(productos.router)
app.include_router(negocio.router)
app.include_router(reportes.router)
app.include_router(comprobantes_recibidos.router)
app.include_router(ats.router)
app.include_router(notas_credito.router)
app.include_router(notas_debito.router)
app.include_router(retenciones.router)
app.include_router(liquidaciones.router)
app.include_router(perfil.router)
app.include_router(proformas.router)
app.include_router(docente.router)
app.include_router(tarifas_iva.router)
app.include_router(recuperar_password.router)   # ← NUEVO

# ─── Raíz ─────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "mensaje": "API Sistema de Facturación e Inventario",
        "version": "1.0.0",
        "docs": "/docs"
    }

# ─── Auth endpoints ───────────────────────────────────────
@app.post("/api/auth/login", response_model=LoginResponse)
def login(credenciales: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioSistema).filter(
        (UsuarioSistema.cedula == credenciales.usuario) |
        (UsuarioSistema.email  == credenciales.usuario)
    ).first()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not usuario.estado:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacte al docente a cargo"
        )

    if not verificar_password(credenciales.password, usuario.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"}
        )

    expire_delta = (
        timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
        if credenciales.recordarme
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    access_token = crear_access_token(
        data={
            "sub":   str(usuario.id_usuario),
            "email": usuario.email,
            "rol":   usuario.rol.value   # "docente" | "estudiante"
        },
        expires_delta=expire_delta
    )

    nueva_sesion = SesionUsuario(
        id_usuario=usuario.id_usuario,
        token=access_token,
        expires_at=datetime.utcnow() + expire_delta
    )
    db.add(nueva_sesion)
    db.commit()

    foto_url = None
    if hasattr(usuario, 'foto_perfil') and usuario.foto_perfil:
        foto_url = f"/uploads/fotos_perfil/{usuario.foto_perfil}"

    return LoginResponse(
        access_token=access_token,
        usuario=UsuarioResponse.from_orm(usuario),
        foto_url=foto_url,
        mensaje=f"Bienvenido {usuario.nombres} {usuario.apellidos}"
    )

# ─── Logout ───────────────────────────────────────────────
@app.post("/api/auth/logout")
def logout(token: str, db: Session = Depends(get_db)):
    sesion = db.query(SesionUsuario).filter(SesionUsuario.token == token).first()
    if sesion:
        db.delete(sesion)
        db.commit()
    return {"mensaje": "Sesión cerrada exitosamente"}

# ─── Verificar Token ──────────────────────────────────────
@app.get("/api/auth/verify")
def verify_token(token: str, db: Session = Depends(get_db)):
    sesion = db.query(SesionUsuario).filter(SesionUsuario.token == token).first()

    if not sesion:
        raise HTTPException(status_code=401, detail="Token inválido")

    if sesion.expires_at < datetime.utcnow():
        db.delete(sesion)
        db.commit()
        raise HTTPException(status_code=401, detail="Token expirado")

    usuario = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == sesion.id_usuario
    ).first()

    foto_url = None
    if hasattr(usuario, 'foto_perfil') and usuario.foto_perfil:
        foto_url = f"/uploads/fotos_perfil/{usuario.foto_perfil}"

    return {
        "valido":   True,
        "foto_url": foto_url,
        "usuario":  UsuarioResponse.from_orm(usuario)
    }

# ─── Run server ───────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
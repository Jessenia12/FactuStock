from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import SesionUsuario, UsuarioSistema
from auth import verificar_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UsuarioSistema:
    token = credentials.credentials

    payload = verificar_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sesion = db.query(SesionUsuario).filter(SesionUsuario.token == token).first()
    if not sesion:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no encontrada. Inicie sesión nuevamente",
        )

    if sesion.expires_at < datetime.utcnow():
        db.delete(sesion)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada. Inicie sesión nuevamente",
        )

    usuario = db.query(UsuarioSistema).filter(
        UsuarioSistema.id_usuario == sesion.id_usuario
    ).first()

    if not usuario or not usuario.estado:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacte al docente a cargo",
        )

    return usuario


def require_docente(
    current_user: UsuarioSistema = Depends(get_current_user)
) -> UsuarioSistema:
    """Solo permite acceso a docentes. Devuelve 403 si es estudiante."""
    rol = current_user.rol.value if hasattr(current_user.rol, 'value') else current_user.rol
    if rol != "docente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido al docente",
        )
    return current_user
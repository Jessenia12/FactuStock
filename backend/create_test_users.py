"""
Script para crear usuarios de prueba en el sistema
"""
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, UsuarioSistema
from auth import obtener_password_hash

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)


def crear_usuarios_prueba():
    db = SessionLocal()
    
    try:
        # Verificar si ya existen usuarios
        existe_usuario = db.query(UsuarioSistema).first()
        if existe_usuario:
            print("⚠️  Ya existen usuarios en la base de datos")
            respuesta = input("¿Desea crear usuarios adicionales? (s/n): ")
            if respuesta.lower() != 's':
                return
        
        # Usuario docente de prueba
        usuario_docente = UsuarioSistema(
            cedula="1234567890",
            nombres="Juan Carlos",
            apellidos="Pérez García",
            email="docente@escuela.edu.ec",
            password=obtener_password_hash("docente123"),
            rol="docente",
            estado=True
        )
        
        # Usuario estudiante de prueba
        usuario_estudiante = UsuarioSistema(
            cedula="0987654321",
            nombres="María Elena",
            apellidos="González López",
            email="estudiante@escuela.edu.ec",
            password=obtener_password_hash("estudiante123"),
            rol="estudiante",
            curso="3ro Bachillerato",
            paralelo="A",
            estado=True
        )
        
        db.add(usuario_docente)
        db.add(usuario_estudiante)
        db.commit()
        
        print("✅ Usuarios de prueba creados exitosamente!")
        print("\n📋 CREDENCIALES DE PRUEBA:")
        print("\n👨‍🏫 DOCENTE:")
        print(f"   Usuario: 1234567890 o docente@escuela.edu.ec")
        print(f"   Contraseña: docente123")
        print("\n👨‍🎓 ESTUDIANTE:")
        print(f"   Usuario: 0987654321 o estudiante@escuela.edu.ec")
        print(f"   Contraseña: estudiante123")
        
    except Exception as e:
        print(f"❌ Error al crear usuarios: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 Creando usuarios de prueba...")
    crear_usuarios_prueba()
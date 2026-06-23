"""
seed_tarifas_iva.py
Ejecutar UNA SOLA VEZ para crear las tarifas IVA base en la BD.
  python3 seed_tarifas_iva.py
"""
import sys; sys.path.append(".")
from database import SessionLocal, engine
from models import Base, TarifaIVA
from decimal import Decimal

Base.metadata.create_all(bind=engine)
db = SessionLocal()

TARIFAS = [
    dict(codigo="IVA_0",  porcentaje=Decimal("0.00"),  descripcion="IVA 0% — Tarifa cero (bienes exentos)",         etiqueta="0%",  activa=True,  es_default=False, nota="Alimentos básicos, medicamentos, libros, educación, salud. Art. 55 LRTI."),
    dict(codigo="IVA_5",  porcentaje=Decimal("5.00"),  descripcion="IVA 5% — Tarifa reducida",                      etiqueta="5%",  activa=True,  es_default=False, nota="Tarifa vigente desde 2024 para ciertos bienes. Verificar lista oficial del SRI."),
    dict(codigo="IVA_8",  porcentaje=Decimal("8.00"),  descripcion="IVA 8% — Tarifa especial turismo y otros",      etiqueta="8%",  activa=True,  es_default=False, nota="Aplica a servicios turísticos y algunos bienes específicos según resolución del SRI."),
    dict(codigo="IVA_12", porcentaje=Decimal("12.00"), descripcion="IVA 12% — Tarifa histórica (hasta 2024)",       etiqueta="12%", activa=False, es_default=False, nota="Tarifa general vigente hasta 2024. Inactiva como referencia histórica."),
    dict(codigo="IVA_15", porcentaje=Decimal("15.00"), descripcion="IVA 15% — Tarifa general vigente 2024",         etiqueta="15%", activa=True,  es_default=True,  nota="Tarifa general vigente desde abril 2024. Aplica a la mayoría de bienes y servicios."),
]

for t in TARIFAS:
    existe = db.query(TarifaIVA).filter(TarifaIVA.codigo == t["codigo"]).first()
    if not existe:
        db.add(TarifaIVA(**t))
        print(f"  ✅ {t['codigo']} ({t['porcentaje']}%)")
    else:
        print(f"  ⚠️  Ya existe: {t['codigo']}")

db.commit()
db.close()
print("\nTarifas IVA listas.")
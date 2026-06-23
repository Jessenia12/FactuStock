# TODO.md - Proformas Implementation Plan (Approved ✅)

**Status**: 6/14 completado

## ✅ Plan Aprobado
- Estados: cotizada/aceptada/rechazada/convertida_factura
- Items: productos existentes (sin stock check)
- NuevaProforma: wizard como LiquidacionesCompras.jsx
- Mismo diseño Facturas/Liquidaciones/Notas

## 📋 Pasos a Completar:

### **PASO 1: Backend Models (2 archivos)** ✅
- ✅ **backend/models.py** → Add EstadoProformaEnum + ProformaVenta + DetalleProformaVenta
- ✅ **backend/schemas.py** → Add ProformaCreate/Update/Response/ListResponse + DetalleProforma

### **PASO 2: Backend Router (1 archivo)**
- [ ] **backend/routers/proformas.py** → Copy facturas.py → Adaptar (sin stock/inventario)

### **PASO 3: Backend Integration (1 archivo + DB)** ✅
- ✅ **backend/main.py** → app.include_router(proformas.router)
- ✅ **DB Migration** → `python -c "from database import engine; from models import Base; Base.metadata.create_all(bind=engine)"`

### **PASO 4: Frontend Services** ✅
- ✅ **frontend/src/services/api.js** → Add proformasService = { listar, obtener, crear, actualizar, eliminar }

### **PASO 5: Frontend Components (2 archivos)** ✅
- ✅ **frontend/src/components/Proformas.jsx** → Copy FacturasEmitidas.jsx → Adaptar colores/nav (morado #9333ea), estados específicos, columna fecha_validez, botón convertir a factura
- [ ] **frontend/src/components/NuevaProforma.jsx** → Wizard como LiquidacionesCompras.jsx

### **PASO 6: Frontend Integration (1 archivo)**
- [ ] **frontend/src/components/Dashboard.jsx** → Habilitar proforma nav + render Proformas

### **PASO 7: Test & Deploy**
- [ ] Backend restart (INICIAR.bat)
- [ ] Frontend dev server (npm run dev)
- [ ] Manual test CRUD
- [ ] ✅ attempt_completion

**Next Action**: Empezar con **PASO 1** → backend/models.py

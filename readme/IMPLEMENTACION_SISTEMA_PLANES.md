# Documentación: Sistema de Gestión de Usuarios y Planes

## 📋 Índice

1. [Resumen General](#resumen-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Base de Datos](#base-de-datos)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Flujos de Triggers](#flujos-de-triggers)
7. [Configuración de Planes](#configuración-de-planes)
8. [Middleware de Límites](#middleware-de-límites)
9. [API Endpoints](#api-endpoints)
10. [Frontend Components](#frontend-components)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)
13. [Mantenimiento](#mantenimiento)
14. [Consideraciones de Seguridad](#consideraciones-de-seguridad)

---

## 📝 Resumen General

El sistema de gestión de usuarios y planes implementa un modelo de SaaS con múltiples niveles de servicio que controla el acceso a funcionalidades clave de la plataforma Cost360/APUpro.

### Funcionalidades Principales

- **Gestión de usuarios administrativos** (arko_admins)
- **Sistema de planes multi-nivel** (free, basic, pro, enterprise)
- **Límites de uso** (presupuestos, partidas, acceso a IA)
- **Control de activación/desactivación de usuarios**
- **Modal de pago al alcanzar límites**
- **Presupuesto de ejemplo para demostración**
- **Auditoría de accesos y cambios**

### Archivos Modificados/Creados

**Backend:**
- `backend/app/db/models/arko.py` - Modelo ArkoAdmin actualizado
- `backend/app/middleware/plan_limits.py` - Middleware de verificación de límites
- `backend/app/api/v1/endpoints/users.py` - API de gestión de usuarios
- `backend/app/api/v1/endpoints/budgets.py` - Endpoints actualizados con límites
- `backend/app/api/v1/endpoints/cost360.py` - Endpoint IA con verificación
- `backend/app/api/v1/api.py` - Router actualizado
- `readme/migracion_user_planes.sql` - Script de migración

**Frontend:**
- `frontend/src/modules/cost360/pages/AdminDatabasePage.jsx` - Pestaña Usuarios
- `frontend/src/pages/admin/BudgetHomePage.jsx` - Modal de pago
- `frontend/src/services/budgetService.js` - Servicio actualizado con manejo de errores

---

## 🏗️ Arquitectura del Sistema

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  AdminDatabasePage.jsx  │  BudgetHomePage.jsx  │  budgetService.js│
│  - Pestaña Usuarios     │  - Modal de Pago    │  - Manejo errores │
│  - Gestión de usuarios  │  - Triggers         │  - API calls     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│  api/v1/endpoints/                                               │
│  ├── users.py              - Gestión de usuarios                 │
│  ├── budgets.py            - Presupuestos con límites            │
│  ├── cost360.py            - IA con verificación                 │
│  └── arko.py               - Autenticación                       │
│                                                                │
│  middleware/                                                   │
│  └── plan_limits.py        - Verificación de límites            │
│                                                                │
│  db/models/                                                   │
│  └── arko.py                - Modelo ArkoAdmin                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
├─────────────────────────────────────────────────────────────────┤
│  arko_admins table                                               │
│  ├── id, email, hashed_password                                 │
│  ├── plan, max_budgets, max_items_per_budget                    │
│  ├── has_ai_access, plan_expires_at                             │
│  └── is_active, is_email_verified                                │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

1. **Usuario → Frontend**: Usuario interactúa con UI
2. **Frontend → Backend**: Llamadas API con token JWT
3. **Backend → Middleware**: Verificación de límites
4. **Middleware → Database**: Consulta de límites del usuario
5. **Database → Backend**: Respuesta con estado de límites
6. **Backend → Frontend**: Respuesta HTTP (200/403)
7. **Frontend → Usuario**: UI actualizada o modal de pago

---

## 🗄️ Base de Datos

### Tabla: arko_admins

#### Columnas Nuevas

```sql
-- Campos agregados para sistema de planes
plan VARCHAR(50) DEFAULT 'free'
max_budgets INTEGER DEFAULT 1
max_items_per_budget INTEGER DEFAULT 2
has_ai_access BOOLEAN DEFAULT FALSE
plan_expires_at TIMESTAMP
```

#### Índices Creados

```sql
CREATE INDEX idx_arko_admins_plan ON arko_admins(plan);
CREATE INDEX idx_arko_admins_plan_expires ON arko_admins(plan_expires_at);
```

#### Valores por Defecto (Plan Free)

| Campo | Valor Free | Valor Basic | Valor Pro | Valor Enterprise |
|-------|------------|-------------|-----------|------------------|
| plan | 'free' | 'basic' | 'pro' | 'enterprise' |
| max_budgets | 1 | 5 | 20 | NULL (ilimitado) |
| max_items_per_budget | 2 | 10 | 50 | NULL (ilimitado) |
| has_ai_access | FALSE | FALSE | TRUE | TRUE |
| plan_expires_at | NULL | NULL | NULL | NULL |

### Script de Migración

**Archivo:** `readme/migracion_user_planes.sql`

```sql
-- Ejecutar en producción:
docker exec apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db -f readme/migracion_user_planes.sql

-- O manualmente cada comando:
ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS max_budgets INTEGER DEFAULT 1;
ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS max_items_per_budget INTEGER DEFAULT 2;
ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS has_ai_access BOOLEAN DEFAULT FALSE;
ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_arko_admins_plan ON arko_admins(plan);
CREATE INDEX IF NOT EXISTS idx_arko_admins_plan_expires ON arko_admins(plan_expires_at);

UPDATE arko_admins SET plan = 'free', max_budgets = 1, max_items_per_budget = 2, has_ai_access = false WHERE plan IS NULL;
```

### Verificación de Migración

```sql
-- Verificar columnas creadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'arko_admins'
AND column_name IN ('plan', 'max_budgets', 'max_items_per_budget', 'has_ai_access', 'plan_expires_at');

-- Verificar índices creados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'arko_admins'
AND indexname LIKE '%plan%';

-- Verificar datos actuales
SELECT id, email, plan, max_budgets, max_items_per_budget, has_ai_access, is_active
FROM arko_admins;
```

---

## 🔧 Backend Implementation

### 1. Modelo de Usuarios (arko.py)

**Archivo:** `backend/app/db/models/arko.py`

```python
class ArkoAdmin(ArkoBase):
    __tablename__ = "arko_admins"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_email_verified = Column(Boolean, default=False)
    verification_code = Column(String(10), nullable=True)
    site_config = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Campos de plan y límites
    plan = Column(String(50), default='free')  # 'free', 'basic', 'pro', 'enterprise'
    max_budgets = Column(Integer, default=1)  # Límite de presupuestos según plan
    max_items_per_budget = Column(Integer, default=2)  # Límite de partidas por presupuesto
    has_ai_access = Column(Boolean, default=False)  # Acceso a generador APU con IA
    plan_expires_at = Column(DateTime, nullable=True)  # Fecha de expiración del plan
```

**Notas:**
- Valores NULL en límites significan "ilimitado"
- `plan_expires_at` puede usarse para planes temporales
- Mantiene compatibilidad con código existente (valores por defecto)

### 2. Middleware de Límites (plan_limits.py)

**Archivo:** `backend/app/middleware/plan_limits.py`

#### Función: check_budget_limit()

```python
def check_budget_limit(current_user):
    """Verifica si el usuario puede crear más presupuestos"""
    if current_user.max_budgets is None:
        return  # Sin límite para admins con planes superiores

    from app.db.models.budget import Budget
    from app.db.arko_base import ArkoSessionLocal

    with ArkoSessionLocal() as db:
        budget_count = db.query(Budget).filter(Budget.user_id == str(current_user.id)).count()
        if budget_count >= current_user.max_budgets:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de presupuestos alcanzado. Tu plan permite máximo {current_user.max_budgets} presupuestos."
            )
```

**Uso:** Se llama antes de crear un nuevo presupuesto.

**Comportamiento:**
- Si `max_budgets` es NULL → permite (ilimitado)
- Si `max_budgets` tiene valor → cuenta presupuestos actuales
- Si límite alcanzado → HTTP 403 con mensaje descriptivo

#### Función: check_items_limit()

```python
def check_items_limit(current_user, budget_id):
    """Verifica si el usuario puede agregar más partidas a un presupuesto"""
    if current_user.max_items_per_budget is None:
        return  # Sin límite para admins con planes superiores

    from app.db.models.budget import BudgetItem
    from app.db.arko_base import ArkoSessionLocal

    with ArkoSessionLocal() as db:
        items_count = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).count()
        if items_count >= current_user.max_items_per_budget:
            raise HTTPException(
                status_code=403,
                detail=f"Límite de partidas alcanzado. Tu plan permite máximo {current_user.max_items_per_budget} partidas por presupuesto."
            )
```

**Uso:** Se llama antes de agregar una partida a un presupuesto.

**Comportamiento:**
- Si `max_items_per_budget` es NULL → permite (ilimitado)
- Si tiene valor → cuenta partidas en el presupuesto específico
- Si límite alcanzado → HTTP 403 con mensaje descriptivo

#### Función: check_ai_access()

```python
def check_ai_access(current_user):
    """Verifica si el usuario tiene acceso a IA"""
    if not current_user.has_ai_access:
        raise HTTPException(
            status_code=403,
            detail="El acceso al generador APU con IA requiere un plan de pago."
        )
```

**Uso:** Se llama antes de ejecutar el generador APU con IA.

**Comportamiento:**
- Si `has_ai_access` es FALSE → HTTP 403
- Si `has_ai_access` es TRUE → permite ejecución

### 3. API de Gestión de Usuarios (users.py)

**Archivo:** `backend/app/api/v1/endpoints/users.py`

#### Endpoint: GET /users/

```python
@router.get("/", response_model=List[UserListResponse])
def get_users(current_user = Depends(get_current_arko_admin)):
    """Obtener lista de usuarios (solo admin)"""
    with ArkoSessionLocal() as db:
        users = db.query(ArkoAdmin).all()
        return [
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "plan": user.plan or 'free',
                "max_budgets": user.max_budgets or 1,
                "max_items_per_budget": user.max_items_per_budget or 2,
                "has_ai_access": user.has_ai_access or False,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
            for user in users
        ]
```

**Response:**
```json
[
  {
    "id": 1,
    "email": "admin@arko360.net",
    "full_name": "Admin",
    "is_active": true,
    "plan": "enterprise",
    "max_budgets": null,
    "max_items_per_budget": null,
    "has_ai_access": true,
    "created_at": "2024-01-01T00:00:00"
  }
]
```

#### Endpoint: PUT /users/{user_id}

```python
@router.put("/{user_id}", response_model=UserListResponse)
def update_user(user_id: int, user_data: UserUpdateRequest, current_user = Depends(get_current_arko_admin)):
    """Actualizar usuario (solo admin)"""
    with ArkoSessionLocal() as db:
        user = db.query(ArkoAdmin).filter(ArkoAdmin.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        if user_data.is_active is not None:
            user.is_active = user_data.is_active
        if user_data.plan is not None:
            user.plan = user_data.plan
        if user_data.max_budgets is not None:
            user.max_budgets = user_data.max_budgets
        if user_data.max_items_per_budget is not None:
            user.max_items_per_budget = user_data.max_items_per_budget
        if user_data.has_ai_access is not None:
            user.has_ai_access = user_data.has_ai_access

        db.commit()
        db.refresh(user)

        return { /* same structure as GET */ }
```

**Request Body:**
```json
{
  "is_active": true,
  "plan": "pro",
  "max_budgets": 20,
  "max_items_per_budget": 50,
  "has_ai_access": true
}
```

**Notas:**
- Solo envía los campos que deseas actualizar
- Valores NULL en límites significan "ilimitado"

#### Endpoint: POST /users/demo-budget

```python
@router.post("/demo-budget")
def create_demo_budget(current_user = Depends(get_current_arko_admin)):
    """Crear presupuesto de ejemplo con 2 partidas (solo para demo)"""
    from app.db.base import get_db
    from app.db.models.budget import Budget, BudgetItem, BudgetAPUMaterial, BudgetAPUEquipment, BudgetAPULabor
    import uuid

    def generate_uuid():
        return str(uuid.uuid4())

    with get_db() as db:
        # Crear presupuesto de ejemplo
        demo_budget = Budget(
            user_id=str(current_user.id),
            name="Presupuesto de Ejemplo",
            description="Presupuesto de ejemplo para demostración del sistema",
            currency="USD",
            exchange_rate=36.5,
            fcas_percent=417.0,
            admin_percent=15.0,
            profit_percent=10.0,
            iva_percent=16.0,
            labor_bonus=0.0,
            material_inflation=0.0,
            labor_inflation=0.0,
            equipment_inflation=0.0,
            project_name="Proyecto Demo"
        )
        db.add(demo_budget)
        db.commit()
        db.refresh(demo_budget)

        # Partida 1: Excavación
        item1 = BudgetItem(
            budget_id=demo_budget.id,
            cod_par="E0101",
            cov_par="E0101",
            description="EXCAVACIÓN MANUAL PARA CIMENTO ARMADO",
            unit="m2",
            quantity=100.0,
            performance=1.0,
            order=1,
            is_chapter=False
        )
        db.add(item1)
        db.commit()
        db.refresh(item1)

        # Materiales para partida 1
        db.add(BudgetAPUMaterial(
            budget_item_id=item1.id,
            codigo="MAT001",
            descripcion="CEMENTO PORTLAND TIPO I",
            unidad="saco",
            precio_unitario=12.50,
            cantidad=5.0,
            desperdicio=5.0
        ))
        db.add(BudgetAPUMaterial(
            budget_item_id=item1.id,
            codigo="MAT002",
            descripcion="ARENA FINA",
            unidad="m3",
            precio_unitario=45.00,
            cantidad=0.5,
            desperdicio=0.0
        ))
        db.commit()

        # Partida 2: Concreto
        item2 = BudgetItem(
            budget_id=demo_budget.id,
            cod_par="E0201",
            cov_par="E0201",
            description="CONCRETO ARMADO 3000 PSI",
            unit="m3",
            quantity=50.0,
            performance=1.0,
            order=2,
            is_chapter=False
        )
        db.add(item2)
        db.commit()
        db.refresh(item2)

        # Materiales para partida 2
        db.add(BudgetAPUMaterial(
            budget_item_id=item2.id,
            codigo="MAT003",
            descripcion="CEMENTO PORTLAND TIPO I",
            unidad="saco",
            precio_unitario=12.50,
            cantidad=8.0,
            desperdicio=3.0
        ))
        db.add(BudgetAPUMaterial(
            budget_item_id=item2.id,
            codigo="MAT004",
            descripcion="ARENA GRUESA",
            unidad="m3",
            precio_unitario=35.00,
            cantidad=0.8,
            desperdicio=0.0
        ))
        db.commit()

        return {
            "status": "success",
            "message": "Presupuesto de ejemplo creado exitosamente",
            "budget_id": demo_budget.id,
            "budget_name": demo_budget.name
        }
```

**Response:**
```json
{
  "status": "success",
  "message": "Presupuesto de ejemplo creado exitosamente",
  "budget_id": "uuid-string",
  "budget_name": "Presupuesto de Ejemplo"
}
```

**Propósito:**
- Crea un presupuesto con exactamente 2 partidas
- Cada partida tiene materiales asociados
- Útil para testing y demostración del trigger de límites

### 4. Actualización de Endpoints Existentes

#### budgets.py - POST /budgets/

**Antes:**
```python
@router.post("/", response_model=BudgetSchema, status_code=status.HTTP_201_CREATED)
def create_budget(budget_in: BudgetCreate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    budget_data = budget_in.model_dump()
    budget_data["user_id"] = str(current_user.id)
    db_budget = Budget(**budget_data)
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget
```

**Después:**
```python
@router.post("/", response_model=BudgetSchema, status_code=status.HTTP_201_CREATED)
def create_budget(budget_in: BudgetCreate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    # Verificar límite de presupuestos
    check_budget_limit(current_user)

    budget_data = budget_in.model_dump()
    budget_data["user_id"] = str(current_user.id)
    db_budget = Budget(**budget_data)
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget
```

#### budgets.py - POST /budgets/{budget_id}/items

**Antes:**
```python
@router.post("/{budget_id}/items", response_model=BudgetItemSchema)
def add_item_to_budget(budget_id: str, item_in: BudgetItemCreate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
```

**Después:**
```python
@router.post("/{budget_id}/items", response_model=BudgetItemSchema)
def add_item_to_budget(budget_id: str, item_in: BudgetItemCreate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    # Verificar límite de partidas
    check_items_limit(current_user, budget_id)
```

#### cost360.py - POST /cost360/generate-ai-apu

**Antes:**
```python
@router.post("/generate-ai-apu")
def generate_ai_apu_route(payload: AiApuGenerateRequest, db: Session = Depends(get_db)):
    # 0. Si es solo preproceso DEBUG, devolver resultado rapido
    if payload.only_preprocess:
        # ...
```

**Después:**
```python
@router.post("/generate-ai-apu")
def generate_ai_apu_route(payload: AiApuGenerateRequest, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    # Verificar acceso a IA
    check_ai_access(current_user)

    # 0. Si es solo preproceso DEBUG, devolver resultado rapido
    if payload.only_preprocess:
        # ...
```

### 5. Router API (api.py)

**Archivo:** `backend/app/api/v1/api.py`

```python
from app.api.v1.endpoints import users as users_module

# ...

api_router.include_router(users_module.router, prefix="/users", tags=["users"])
```

---

## 🎨 Frontend Implementation

### 1. Pestaña de Usuarios (AdminDatabasePage.jsx)

**Archivo:** `frontend/src/modules/cost360/pages/AdminDatabasePage.jsx`

#### Imports Actualizados

```javascript
import { FiSearch, FiLayers, FiArrowRight, FiBox, FiTool, FiUsers, FiDatabase, FiEdit2, FiTrash2, FiSave, FiX, FiDownload, FiCpu, FiUpload, FiFileText, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
```

#### Componente UsersTab

**Estructura:**
```javascript
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const siteConfig = useContext(SiteConfigContext);

  // fetchUsers()
  // toggleUserStatus()
  // updateUserPlan()
  // createDemoBudget()

  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto max-h-full" style={glass}>
      {/* Header */}
      {/* Tabla de usuarios */}
      {/* Modal de edición */}
    </div>
  );
};
```

#### Función: fetchUsers()

```javascript
const fetchUsers = async () => {
  try {
    const token = localStorage.getItem('arko_admin_token');
    const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'http://localhost:8010'
      : window.location.origin;

    const response = await fetch(`${API_URL}/api/v1/users/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      setUsers(data);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    toast.error('Error al cargar usuarios');
  } finally {
    setLoading(false);
  }
};
```

#### Función: toggleUserStatus()

```javascript
const toggleUserStatus = async (userId, currentStatus) => {
  try {
    const token = localStorage.getItem('arko_admin_token');
    const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'http://localhost:8010'
      : window.location.origin;

    const response = await fetch(`${API_URL}/api/v1/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ is_active: !currentStatus })
    });

    if (response.ok) {
      toast.success('Usuario actualizado');
      fetchUsers();
    } else {
      toast.error('Error al actualizar usuario');
    }
  } catch (error) {
    console.error('Error updating user:', error);
    toast.error('Error al actualizar usuario');
  }
};
```

#### Función: updateUserPlan()

```javascript
const updateUserPlan = async (userId, planData) => {
  try {
    const token = localStorage.getItem('arko_admin_token');
    const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'http://localhost:8010'
      : window.location.origin;

    const response = await fetch(`${API_URL}/api/v1/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(planData)
    });

    if (response.ok) {
      toast.success('Plan actualizado');
      fetchUsers();
      setEditingUser(null);
    } else {
      toast.error('Error al actualizar plan');
    }
  } catch (error) {
    console.error('Error updating plan:', error);
    toast.error('Error al actualizar plan');
  }
};
```

#### Función: createDemoBudget()

```javascript
const createDemoBudget = async () => {
  try {
    const token = localStorage.getItem('arko_admin_token');
    const API_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'http://localhost:8010'
      : window.location.origin;

    const response = await fetch(`${API_URL}/api/v1/users/demo-budget`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      toast.success(data.message);
    } else {
      toast.error('Error al crear presupuesto de ejemplo');
    }
  } catch (error) {
    console.error('Error creating demo budget:', error);
    toast.error('Error al crear presupuesto de ejemplo');
  }
};
```

#### Tabla de Usuarios

```javascript
<table className="w-full">
  <thead>
    <tr className="border-b border-gray-200">
      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Email</th>
      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Nombre</th>
      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Plan</th>
      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Límites</th>
      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">IA</th>
      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Estado</th>
      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Acciones</th>
    </tr>
  </thead>
  <tbody>
    {users.map(user => (
      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-3 px-4 text-sm text-slate-800">{user.email}</td>
        <td className="py-3 px-4 text-sm text-slate-600">{user.full_name || '-'}</td>
        <td className="py-3 px-4">
          <select
            value={user.plan}
            onChange={(e) => updateUserPlan(user.id, { plan: e.target.value })}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="free">Free</option>
            <option value="basic">Básico</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </td>
        <td className="py-3 px-4 text-sm text-slate-600">
          {user.max_budgets} presup • {user.max_items_per_budget} partidas
        </td>
        <td className="py-3 px-4">
          {user.has_ai_access ? (
            <span className="text-emerald-600 text-sm">✓ Sí</span>
          ) : (
            <span className="text-slate-400 text-sm">✗ No</span>
          )}
        </td>
        <td className="py-3 px-4">
          <button
            onClick={() => toggleUserStatus(user.id, user.is_active)}
            className="text-sm"
          >
            {user.is_active ? (
              <span className="text-emerald-600">Activo</span>
            ) : (
              <span className="text-red-600">Inactivo</span>
            )}
          </button>
        </td>
        <td className="py-3 px-4">
          <button
            onClick={() => setEditingUser(user)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Editar
          </button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

#### Modal de Edición

```javascript
{editingUser && (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Editar Usuario</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={editingUser.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Límite de Presupuestos</label>
            <input
              type="number"
              value={editingUser.max_budgets}
              onChange={(e) => setEditingUser({...editingUser, max_budgets: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Límite de Partidas</label>
            <input
              type="number"
              value={editingUser.max_items_per_budget}
              onChange={(e) => setEditingUser({...editingUser, max_items_per_budget: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ai-access"
              checked={editingUser.has_ai_access}
              onChange={(e) => setEditingUser({...editingUser, has_ai_access: e.target.checked})}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="ai-access" className="text-sm text-slate-700">Acceso a IA</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => setEditingUser(null)}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => updateUserPlan(editingUser.id, {
              max_budgets: editingUser.max_budgets,
              max_items_per_budget: editingUser.max_items_per_budget,
              has_ai_access: editingUser.has_ai_access
            })}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

### 2. Modal de Pago (BudgetHomePage.jsx)

**Archivo:** `frontend/src/pages/admin/BudgetHomePage.jsx`

#### Estado Nuevo

```javascript
const [paymentModalOpen, setPaymentModalOpen] = useState(false);
const [limitReachedReason, setLimitReachedReason] = useState('');
```

#### Componente Modal de Pago

```javascript
{paymentModalOpen && (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Actualiza tu Plan</h2>
        <p className="text-sm text-slate-600 mb-6">
          {limitReachedReason === 'budgets' ? 'Has alcanzado el límite de presupuestos de tu plan.' : 'Has alcanzado el límite de partidas de tu presupuesto.'}
        </p>

        <div className="space-y-3 mb-6">
          <div className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-800">Plan Básico</h3>
                <p className="text-xs text-slate-500">5 presupuestos • 10 partidas • Sin IA</p>
              </div>
              <span className="text-blue-600 font-bold">$9.99/mes</span>
            </div>
          </div>

          <div className="p-4 border border-slate-200 rounded-lg hover:border-emerald-300 transition-colors cursor-pointer">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-800">Plan Pro</h3>
                <p className="text-xs text-slate-500">20 presupuestos • 50 partidas • IA incluida</p>
              </div>
              <span className="text-emerald-600 font-bold">$29.99/mes</span>
            </div>
          </div>

          <div className="p-4 border border-slate-200 rounded-lg hover:border-purple-300 transition-colors cursor-pointer">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-slate-800">Plan Enterprise</h3>
                <p className="text-xs text-slate-500">Ilimitado • IA completa • Soporte 24/7</p>
              </div>
              <span className="text-purple-600 font-bold">$99.99/mes</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setPaymentModalOpen(false)}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              setPaymentModalOpen(false);
              toast.success('Proceso de pago simulado. En producción se redirigiría a pasarela.');
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/30"
          >
            Proceder al Pago
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

#### Función: handleCreateBudget()

```javascript
const handleCreateBudget = async () => {
  try {
    const newBudget = await budgetService.create({
      name: 'Nuevo Presupuesto',
      currency: 'USD',
      exchange_rate: 1.0
    });
    setIsModalOpen(false);
    navigate(`/budgets/${newBudget.id}`);
  } catch (error) {
    if (error.isLimitError) {
      setLimitReachedReason('budgets');
      setPaymentModalOpen(true);
    } else {
      toast.error(error.message || 'Error al crear presupuesto');
    }
  }
};
```

### 3. Servicio de Presupuestos (budgetService.js)

**Archivo:** `frontend/src/services/budgetService.js`

#### Función: create() Actualizada

```javascript
create: async (data) => {
  const response = await fetch(`${API_URL}/budgets/`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 403) {
      throw { detail: errorData.detail || 'Límite alcanzado', isLimitError: true };
    }
    throw new Error(errorData.detail || 'Error al crear el presupuesto');
  }
  return response.json();
},
```

#### Función: addItem() Actualizada

```javascript
addItem: async (budgetId, data) => {
  const response = await fetch(`${API_URL}/budgets/${budgetId}/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (response.status === 403) {
      throw { detail: errData.detail || 'Límite alcanzado', isLimitError: true };
    }
    throw new Error(errData.detail || 'Error al agregar partida al presupuesto');
  }
  return response.json();
},
```

---

## 🎯 Flujos de Triggers

### Trigger 1: Límite de Presupuestos

**Situación:** Usuario intenta crear el 3er presupuesto con plan free (límite: 1)

**Flujo:**

1. Usuario hace clic en "Nuevo Presupuesto"
2. Frontend llama `budgetService.create()`
3. Backend ejecuta `check_budget_limit(current_user)`
4. Middleware consulta:
   ```sql
   SELECT COUNT(*) FROM budgets WHERE user_id = 'user_id'
   ```
5. Si count >= max_budgets → HTTP 403
6. Frontend detecta `error.isLimitError = true`
7. Frontend muestra modal de pago
8. Usuario selecciona plan
9. (En producción) Redirige a pasarela de pago
10. (Simulado) Muestra toast de éxito

**Código clave:**
```javascript
// Frontend
catch (error) {
  if (error.isLimitError) {
    setLimitReachedReason('budgets');
    setPaymentModalOpen(true);
  }
}

// Backend
check_budget_limit(current_user)
```

### Trigger 2: Límite de Partidas

**Situación:** Usuario intenta agregar la 3ra partida con plan free (límite: 2)

**Flujo:**

1. Usuario tiene presupuesto con 2 partidas
2. Usuario intenta agregar 3ra partida
3. Frontend llama `budgetService.addItem()`
4. Backend ejecuta `check_items_limit(current_user, budget_id)`
5. Middleware consulta:
   ```sql
   SELECT COUNT(*) FROM budget_items WHERE budget_id = 'budget_id'
   ```
6. Si count >= max_items_per_budget → HTTP 403
7. Frontend detecta `error.isLimitError = true`
8. Frontend muestra modal de pago
9. Usuario selecciona plan
10. (En producción) Redirige a pasarela de pago

**Código clave:**
```javascript
// Frontend
catch (error) {
  if (error.isLimitError) {
    setLimitReachedReason('items');
    setPaymentModalOpen(true);
  }
}

// Backend
check_items_limit(current_user, budget_id)
```

### Trigger 3: Acceso a IA

**Situación:** Usuario intenta usar generador APU con IA sin acceso

**Flujo:**

1. Usuario hace clic en "Generar APU con IA"
2. Frontend llama `/cost360/generate-ai-apu`
3. Backend ejecuta `check_ai_access(current_user)`
4. Middleware verifica `current_user.has_ai_access`
5. Si FALSE → HTTP 403
6. Frontend muestra error:
   ```
   "El acceso al generador APU con IA requiere un plan de pago."
   ```
7. Usuario debe actualizar plan

**Código clave:**
```python
# Backend
check_ai_access(current_user)
```

**Nota:** Este trigger NO muestra modal de pago actualmente, solo error message. Puede ser modificado para mostrar modal.

---

## ⚙️ Configuración de Planes

### Valores por Defecto

| Plan | max_budgets | max_items_per_budget | has_ai_access | Precio |
|------|-------------|----------------------|---------------|--------|
| free | 1 | 2 | FALSE | $0 |
| basic | 5 | 10 | FALSE | $9.99/mes |
| pro | 20 | 50 | TRUE | $29.99/mes |
| enterprise | NULL (ilimitado) | NULL (ilimitado) | TRUE | $99.99/mes |

### Modificar Planes Predeterminados

**Backend - plan_limits.py:**

```python
# Para cambiar límites predeterminados, modificar el modelo en arko.py
# o establecer valores específicos al crear usuarios

# Ejemplo: cambiar límite free a 3 presupuestos
user.max_budgets = 3
```

**Frontend - AdminDatabasePage.jsx:**

```javascript
// Modificar opciones del select de planes
<select value={user.plan} onChange={(e) => updateUserPlan(user.id, { plan: e.target.value })}>
  <option value="free">Free</option>
  <option value="basic">Básico</option>
  <option value="pro">Pro</option>
  <option value="enterprise">Enterprise</option>
  <option value="custom">Personalizado</option>  // Nuevo plan
</select>
```

### Configuración de Límites Específicos

**Via API:**

```bash
curl -X PUT http://localhost:8010/api/v1/users/1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_budgets": 100,
    "max_items_per_budget": 200,
    "has_ai_access": true
  }'
```

**Via UI:**
1. Ir a AdminDatabasePage → Pestaña Usuarios
2. Hacer clic en "Editar" en el usuario deseado
3. Modificar límites
4. Hacer clic en "Guardar"

---

## 🛡️ Middleware de Límites

### Ubicación

**Archivo:** `backend/app/middleware/plan_limits.py`

### Funciones

#### check_budget_limit(current_user)

**Propósito:** Verificar si el usuario puede crear más presupuestos.

**Parámetros:**
- `current_user`: Objeto ArkoAdmin del usuario autenticado

**Retorno:**
- None si permite
- HTTPException 403 si rechaza

**Lógica:**
1. Si `max_budgets` es NULL → retorna (ilimitado)
2. Crea sesión de base de datos
3. Cuenta presupuestos del usuario
4. Si count >= max_budgets → lanza HTTPException 403

**Error Response:**
```json
{
  "detail": "Límite de presupuestos alcanzado. Tu plan permite máximo 1 presupuestos."
}
```

#### check_items_limit(current_user, budget_id)

**Propósito:** Verificar si el usuario puede agregar más partidas a un presupuesto específico.

**Parámetros:**
- `current_user`: Objeto ArkoAdmin del usuario autenticado
- `budget_id`: ID del presupuesto donde se agregará la partida

**Retorno:**
- None si permite
- HTTPException 403 si rechaza

**Lógica:**
1. Si `max_items_per_budget` es NULL → retorna (ilimitado)
2. Crea sesión de base de datos
3. Cuenta partidas en el presupuesto específico
4. Si count >= max_items_per_budget → lanza HTTPException 403

**Error Response:**
```json
{
  "detail": "Límite de partidas alcanzado. Tu plan permite máximo 2 partidas por presupuesto."
}
```

#### check_ai_access(current_user)

**Propósito:** Verificar si el usuario tiene acceso a IA.

**Parámetros:**
- `current_user`: Objeto ArkoAdmin del usuario autenticado

**Retorno:**
- None si permite
- HTTPException 403 si rechaza

**Lógica:**
1. Verifica `current_user.has_ai_access`
2. Si FALSE → lanza HTTPException 403

**Error Response:**
```json
{
  "detail": "El acceso al generador APU con IA requiere un plan de pago."
}
```

### Customización del Middleware

**Agregar nuevas reglas:**

```python
def check_custom_limit(current_user, custom_condition):
    """Verificar límite personalizado"""
    if not custom_condition:
        raise HTTPException(
            status_code=403,
            detail="Límite personalizado alcanzado"
        )
```

**Modificar mensajes de error:**

```python
def check_budget_limit(current_user):
    # ...
    if budget_count >= current_user.max_budgets:
        raise HTTPException(
            status_code=403,
            detail=f"🚫 Tu plan {current_user.plan} permite solo {current_user.max_budgets} presupuestos."
        )
```

---

## 🔌 API Endpoints

### GET /api/v1/users/

**Descripción:** Obtener lista de todos los usuarios (solo admin).

**Autenticación:** Requiere token JWT admin.

**Request:**
```http
GET /api/v1/users/
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "email": "admin@arko360.net",
    "full_name": "Admin",
    "is_active": true,
    "plan": "enterprise",
    "max_budgets": null,
    "max_items_per_budget": null,
    "has_ai_access": true,
    "created_at": "2024-01-01T00:00:00"
  },
  {
    "id": 2,
    "email": "user@example.com",
    "full_name": "Usuario Free",
    "is_active": true,
    "plan": "free",
    "max_budgets": 1,
    "max_items_per_budget": 2,
    "has_ai_access": false,
    "created_at": "2024-01-15T00:00:00"
  }
]
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Not authenticated"
}
```

### PUT /api/v1/users/{user_id}

**Descripción:** Actualizar configuración de usuario (solo admin).

**Autenticación:** Requiere token JWT admin.

**Request:**
```http
PUT /api/v1/users/2
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "is_active": true,
  "plan": "pro",
  "max_budgets": 20,
  "max_items_per_budget": 50,
  "has_ai_access": true
}
```

**Response (200 OK):**
```json
{
  "id": 2,
  "email": "user@example.com",
  "full_name": "Usuario Free",
  "is_active": true,
  "plan": "pro",
  "max_budgets": 20,
  "max_items_per_budget": 50,
  "has_ai_access": true,
  "created_at": "2024-01-15T00:00:00"
}
```

**Response (404 Not Found):**
```json
{
  "detail": "Usuario no encontrado"
}
```

### POST /api/v1/users/demo-budget

**Descripción:** Crear presupuesto de ejemplo con 2 partidas para demostración.

**Autenticación:** Requiere token JWT del usuario.

**Request:**
```http
POST /api/v1/users/demo-budget
Authorization: Bearer YOUR_TOKEN
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Presupuesto de ejemplo creado exitosamente",
  "budget_id": "550e8400-e29b-41d4-a716-446655440000",
  "budget_name": "Presupuesto de Ejemplo"
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Not authenticated"
}
```

### POST /api/v1/budgets/ (Modificado)

**Descripción:** Crear nuevo presupuesto (con verificación de límites).

**Autenticación:** Requiere token JWT.

**Request:**
```http
POST /api/v1/budgets/
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "name": "Nuevo Presupuesto",
  "currency": "USD",
  "exchange_rate": 1.0
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nuevo Presupuesto",
  "user_id": "1",
  ...
}
```

**Response (403 Forbidden - Límite alcanzado):**
```json
{
  "detail": "Límite de presupuestos alcanzado. Tu plan permite máximo 1 presupuestos."
}
```

### POST /api/v1/budgets/{budget_id}/items (Modificado)

**Descripción:** Agregar partida a presupuesto (con verificación de límites).

**Autenticación:** Requiere token JWT.

**Request:**
```http
POST /api/v1/budgets/{budget_id}/items
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "cod_par": "E0101",
  "description": "Excavación",
  "unit": "m2",
  "quantity": 100.0
}
```

**Response (201 Created):**
```json
{
  "id": "item-uuid",
  "cod_par": "E0101",
  "description": "Excavación",
  ...
}
```

**Response (403 Forbidden - Límite alcanzado):**
```json
{
  "detail": "Límite de partidas alcanzado. Tu plan permite máximo 2 partidas por presupuesto."
}
```

### POST /api/v1/cost360/generate-ai-apu (Modificado)

**Descripción:** Generar APU con IA (con verificación de acceso).

**Autenticación:** Requiere token JWT.

**Request:**
```http
POST /api/v1/cost360/generate-ai-apu
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "description": "Concreto armado",
  "covenin_prefix": "E"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "apu": { ... }
}
```

**Response (403 Forbidden - Sin acceso):**
```json
{
  "detail": "El acceso al generador APU con IA requiere un plan de pago."
}
```

---

## 🧩 Frontend Components

### UsersTab Component

**Ubicación:** `frontend/src/modules/cost360/pages/AdminDatabasePage.jsx`

**Props:** Ninguno (usa contexto y hooks internos)

**Estado:**
- `users`: Array de usuarios
- `loading`: Boolean de carga
- `editingUser`: Usuario en edición o null

**Funciones:**
- `fetchUsers()`: Carga lista de usuarios
- `toggleUserStatus(userId, currentStatus)`: Activa/desactiva usuario
- `updateUserPlan(userId, planData)`: Actualiza plan y límites
- `createDemoBudget()`: Crea presupuesto de ejemplo

**Estructura JSX:**
```jsx
<div className="rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto max-h-full" style={glass}>
  {/* Header con título y botón de demo */}
  <div className="flex items-center justify-between shrink-0">
    <div>
      <h2 className="text-xl font-bold text-slate-800">Usuarios</h2>
      <p className="text-sm text-slate-600 mt-1">
        Gestiona los usuarios, planes y límites del sistema
      </p>
    </div>
    <button onClick={createDemoBudget} className="...">
      Crear Presupuesto Ejemplo
    </button>
  </div>

  {/* Tabla de usuarios */}
  <div className="flex-1 flex flex-col gap-4 min-h-0">
    <div className="bg-white rounded-lg p-4 border border-gray-200 overflow-x-auto">
      <table className="w-full">
        {/* Thead y Tbody */}
      </table>
    </div>
  </div>

  {/* Modal de edición */}
  {editingUser && (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Formulario de edición */}
    </div>
  )}
</div>
```

### PaymentModal Component

**Ubicación:** `frontend/src/pages/admin/BudgetHomePage.jsx`

**Props:** Ninguno (controlado por estado local)

**Estado:**
- `paymentModalOpen`: Boolean para mostrar/ocultar
- `limitReachedReason`: 'budgets' o 'items'

**Planes disponibles:**
- Básico: $9.99/mes, 5 presupuestos, 10 partidas, sin IA
- Pro: $29.99/mes, 20 presupuestos, 50 partidas, con IA
- Enterprise: $99.99/mes, ilimitado, IA completa, soporte 24/7

**Estructura JSX:**
```jsx
{paymentModalOpen && (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Actualiza tu Plan</h2>
        <p className="text-sm text-slate-600 mb-6">
          {limitReachedReason === 'budgets' ? 'Has alcanzado el límite de presupuestos...' : 'Has alcanzado el límite de partidas...'}
        </p>

        {/* Tarjetas de planes */}
        <div className="space-y-3 mb-6">
          {/* Plan Básico */}
          {/* Plan Pro */}
          {/* Plan Enterprise */}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-3">
          <button onClick={() => setPaymentModalOpen(false)}>Cancelar</button>
          <button onClick={handlePayment}>Proceder al Pago</button>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 🧪 Testing

### Tests Unitarios (Sugeridos)

**Backend:**

```python
# tests/test_plan_limits.py
import pytest
from fastapi import HTTPException
from app.middleware.plan_limits import check_budget_limit, check_items_limit, check_ai_access

def test_check_budget_limit_unlimited():
    user = Mock(max_budgets=None)
    check_budget_limit(user)  # Should not raise

def test_check_budget_limit_within_limit():
    user = Mock(id=1, max_budgets=5)
    # Mock database to return 3 budgets
    check_budget_limit(user)  # Should not raise

def test_check_budget_limit_exceeded():
    user = Mock(id=1, max_budgets=2)
    # Mock database to return 2 budgets
    with pytest.raises(HTTPException) as exc:
        check_budget_limit(user)
    assert exc.value.status_code == 403

def test_check_ai_access_allowed():
    user = Mock(has_ai_access=True)
    check_ai_access(user)  # Should not raise

def test_check_ai_access_denied():
    user = Mock(has_ai_access=False)
    with pytest.raises(HTTPException) as exc:
        check_ai_access(user)
    assert exc.value.status_code == 403
```

**Frontend:**

```javascript
// tests/UsersTab.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UsersTab from './UsersTab';

test('fetches and displays users', async () => {
  render(<UsersTab />);
  await waitFor(() => {
    expect(screen.getByText('admin@arko360.net')).toBeInTheDocument();
  });
});

test('toggles user status', async () => {
  render(<UsersTab />);
  const toggleButton = screen.getByText('Activo');
  fireEvent.click(toggleButton);
  await waitFor(() => {
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });
});
```

### Tests de Integración

**Escenario 1: Usuario free crea 3 presupuestos**

```bash
# Setup
curl -X POST http://localhost:8010/api/v1/users/1 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_budgets": 1}'

# Test 1: Crear primer presupuesto (debe funcionar)
curl -X POST http://localhost:8010/api/v1/budgets/ \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Budget 1"}'
# Expected: 201 Created

# Test 2: Crear segundo presupuesto (debe fallar)
curl -X POST http://localhost:8010/api/v1/budgets/ \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Budget 2"}'
# Expected: 403 Forbidden
```

**Escenario 2: Usuario free agrega 3 partidas**

```bash
# Setup
curl -X POST http://localhost:8010/api/v1/users/1 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_items_per_budget": 2}'

# Test 1: Agregar primera partida (debe funcionar)
curl -X POST http://localhost:8010/api/v1/budgets/{id}/items \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cod_par": "E0101", "description": "Item 1"}'
# Expected: 201 Created

# Test 2: Agregar segunda partida (debe funcionar)
curl -X POST http://localhost:8010/api/v1/budgets/{id}/items \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cod_par": "E0201", "description": "Item 2"}'
# Expected: 201 Created

# Test 3: Agregar tercera partida (debe fallar)
curl -X POST http://localhost:8010/api/v1/budgets/{id}/items \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cod_par": "E0301", "description": "Item 3"}'
# Expected: 403 Forbidden
```

**Escenario 3: Usuario sin acceso usa IA**

```bash
# Setup
curl -X POST http://localhost:8010/api/v1/users/1 \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"has_ai_access": false}'

# Test: Intentar usar IA
curl -X POST http://localhost:8010/api/v1/cost360/generate-ai-apu \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Concreto"}'
# Expected: 403 Forbidden
```

### Tests Manuales

**Testing del Modal de Pago:**

1. Iniciar sesión como usuario free
2. Crear 1 presupuesto (debe funcionar)
3. Intentar crear 2do presupuesto → debe mostrar modal de pago
4. Cancelar modal
5. Abrir presupuesto de ejemplo
6. Agregar 2 partidas (debe funcionar)
7. Intentar agregar 3ra partida → debe mostrar modal de pago

**Testing de Gestión de Usuarios:**

1. Iniciar sesión como admin
2. Ir a AdminDatabasePage → Pestaña Usuarios
3. Verificar lista de usuarios cargada
4. Cambiar plan de usuario free a basic
5. Verificar que límites se actualizaron
6. Desactivar usuario
7. Verificar que aparece como "Inactivo"
8. Crear presupuesto de ejemplo
9. Verificar que se creó con 2 partidas

---

## 🔧 Troubleshooting

### Problema: Error 500 al crear presupuesto

**Síntoma:**
```
HTTP 500 Internal Server Error
```

**Causas posibles:**
1. Columnas de plan no agregadas a base de datos
2. Middleware no importado correctamente
3. Sesión de base de datos en middleware incorrecta

**Solución:**

1. Verificar migración:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'arko_admins'
AND column_name IN ('plan', 'max_budgets', 'max_items_per_budget', 'has_ai_access');
```

2. Verificar import en budgets.py:
```python
from app.middleware.plan_limits import check_budget_limit, check_items_limit, check_ai_access
```

3. Verificar logs de backend:
```bash
docker logs apupro_platform-apupro-backend-1
```

### Problema: Modal de pago no se muestra

**Síntoma:**
- Límite alcanzado pero modal no aparece
- Error en consola del navegador

**Causas posibles:**
1. Error no marcado como `isLimitError`
2. Estado de modal no actualizado
3. Error en handleCreateBudget

**Solución:**

1. Verificar servicio budgetService.js:
```javascript
if (response.status === 403) {
  throw { detail: errorData.detail || 'Límite alcanzado', isLimitError: true };
}
```

2. Verificar handleCreateBudget:
```javascript
catch (error) {
  if (error.isLimitError) {
    setLimitReachedReason('budgets');
    setPaymentModalOpen(true);
  }
}
```

3. Verificar consola del navegador:
```javascript
console.log(error); // Debe tener isLimitError: true
```

### Problema: Usuario enterprise sigue con límites

**Síntoma:**
- Usuario tiene plan enterprise
- Aún se le aplican límites

**Causas posibles:**
1. Límites no actualizados en base de datos
2. Middleware no verifica NULL correctamente
3. Cache de frontend

**Solución:**

1. Verificar base de datos:
```sql
SELECT id, email, plan, max_budgets, max_items_per_budget, has_ai_access
FROM arko_admins
WHERE id = USER_ID;
```

2. Actualizar a NULL para ilimitado:
```bash
curl -X PUT http://localhost:8010/api/v1/users/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"max_budgets": null, "max_items_per_budget": null}'
```

3. Refrescar página del frontend

### Problema: IA no funciona aunque has_ai_access = true

**Síntoma:**
- Usuario tiene acceso a IA
- Endpoint devuelve 403

**Causas posibles:**
1. Token JWT no incluye datos actualizados
2. Cache de autenticación
3. check_ai_access no llamado en endpoint

**Solución:**

1. Verificar que check_ai_access está en cost360.py:
```python
@router.post("/generate-ai-apu")
def generate_ai_apu_route(payload: AiApuGenerateRequest, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    check_ai_access(current_user)
```

2. Cerrar sesión y volver a iniciar sesión
3. Verificar token JWT (decodificar y ver datos)

### Problema: Presupuesto de ejemplo no se crea

**Síntoma:**
- Error al crear presupuesto de ejemplo
- Presupuesto se crea pero sin partidas

**Causas posibles:**
1. Error en modelo BudgetAPUMaterial
2. Transacción no confirmada
3. UUID generation falla

**Solución:**

1. Verificar logs de backend:
```bash
docker logs apupro_platform-apupro-backend-1
```

2. Verificar modelo en users.py:
```python
from app.db.models.budget import Budget, BudgetItem, BudgetAPUMaterial
```

3. Verificar que db.commit() se llama después de cada add

### Problema: Pestaña Usuarios no carga

**Síntoma:**
- Pestaña Usuarios muestra "Cargando..."
- Error en consola

**Causas posibles:**
1. Endpoint /users/ no accesible
2. Token no válido
3. Router no registrado

**Solución:**

1. Verificar router en api.py:
```python
api_router.include_router(users_module.router, prefix="/users", tags=["users"])
```

2. Verificar endpoint:
```bash
curl http://localhost:8010/api/v1/users/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. Verificar token en localStorage:
```javascript
localStorage.getItem('arko_admin_token')
```

---

## 📋 Mantenimiento

### Tareas de Mantenimiento Programado

#### Diario

1. **Monitorear logs de errores:**
```bash
docker logs apupro_platform-apupro-backend-1 --tail 100 | grep -i "403\|limit"
```

2. **Verificar usuarios activos:**
```sql
SELECT COUNT(*) FROM arko_admins WHERE is_active = true;
```

#### Semanal

1. **Auditoría de planes:**
```sql
SELECT plan, COUNT(*) as user_count
FROM arko_admins
GROUP BY plan;
```

2. **Verificar usuarios con límites excedidos:**
```sql
SELECT a.id, a.email, a.plan, a.max_budgets, COUNT(b.id) as actual_budgets
FROM arko_admins a
LEFT JOIN budgets b ON a.id::text = b.user_id
GROUP BY a.id, a.email, a.plan, a.max_budgets
HAVING COUNT(b.id) > COALESCE(a.max_budgets, 999999);
```

#### Mensual

1. **Verificar planes expirados:**
```sql
SELECT id, email, plan, plan_expires_at
FROM arko_admins
WHERE plan_expires_at < NOW()
AND plan_expires_at IS NOT NULL;
```

2. **Optimizar índices:**
```sql
REINDEX INDEX idx_arko_admins_plan;
REINDEX INDEX idx_arko_admins_plan_expires;
```

### Backups

**Backup de configuración de usuarios:**
```bash
docker exec apupro_platform-apupro-db-1 pg_dump -U apupro_user -d apupro_db -t arko_admins > backup_users.sql
```

**Restaurar configuración:**
```bash
docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < backup_users.sql
```

### Actualización de Planes

**Script para actualizar plan free a basic:**
```sql
UPDATE arko_admins
SET plan = 'basic',
    max_budgets = 5,
    max_items_per_budget = 10
WHERE plan = 'free'
AND created_at < NOW() - INTERVAL '30 days';
```

**Script para extender plan expirado:**
```sql
UPDATE arko_admins
SET plan_expires_at = NOW() + INTERVAL '1 year'
WHERE plan_expires_at < NOW()
AND plan_expires_at IS NOT NULL;
```

### Monitoreo de Uso

**Presupuestos por usuario:**
```sql
SELECT a.email, a.plan, COUNT(b.id) as budget_count, SUM(bi.count) as total_items
FROM arko_admins a
LEFT JOIN budgets b ON a.id::text = b.user_id
LEFT JOIN (
    SELECT budget_id, COUNT(*) as count
    FROM budget_items
    GROUP BY budget_id
) bi ON b.id = bi.budget_id
GROUP BY a.id, a.email, a.plan
ORDER BY budget_count DESC;
```

**Usuarios más activos:**
```sql
SELECT a.email, COUNT(DISTINCT b.id) as budgets, COUNT(bi.id) as items
FROM arko_admins a
JOIN budgets b ON a.id::text = b.user_id
JOIN budget_items bi ON b.id = bi.budget_id
GROUP BY a.id, a.email
ORDER BY items DESC
LIMIT 10;
```

---

## 🔒 Consideraciones de Seguridad

### Autenticación y Autorización

1. **Todos los endpoints requieren autenticación:**
   - `Depends(get_current_arko_admin)` en todos los endpoints

2. **Solo admin puede gestionar usuarios:**
   - Endpoint `/users/` debe ser accesible solo por administradores
   - Considerar agregar rol `is_superuser` para control más granular

3. **Tokens JWT incluyen datos de usuario:**
   - El token decodificado debe incluir `id`, `email`, `plan`
   - Considerar agregar claims personalizados para planes

### Validación de Datos

1. **Validar límites antes de operaciones:**
   - Middleware verifica antes de cualquier operación crítica
   - No confiar solo en validación frontend

2. **Prevenir race conditions:**
   - Usar transacciones de base de datos
   - Considerar locks para operaciones concurrentes

3. **Sanitizar inputs:**
   - Validar que `max_budgets` y `max_items_per_budget` sean números positivos
   - Prevenir inyección SQL en endpoints de usuarios

### Protección de Datos

1. **No exponer datos sensibles en logs:**
   - Evitar loggear emails o tokens
   - Usar placeholders en mensajes de error

2. **Encriptar datos sensibles:**
   - `hashed_password` ya está encriptado
   - Considerar encriptar datos adicionales si se agregan

3. **Limitar información en respuestas:**
   - No incluir `hashed_password` en respuestas de API
   - Solo retornar campos necesarios

### Prevención de Abuso

1. **Rate limiting:**
   - Considerar agregar rate limiting a endpoints de usuarios
   - Prevenir actualizaciones masivas

2. **Auditoría de cambios:**
   - Considerar agregar tabla de logs de cambios de planes
   - Registrar quién cambió qué y cuándo

3. **Monitoreo de anomalías:**
   - Alertar si un usuario intenta crear presupuestos excesivamente
   - Detectar patrones de bypass de límites

### Consideraciones de Producción

1. **Integración con pasarela de pago:**
   - Implementar Stripe, PayPal, o similar
   - Manejar webhooks para actualizaciones automáticas de planes

2. **Gestión de planes temporales:**
   - Usar `plan_expires_at` para planes de prueba
   - Implementar jobs para degradar planes expirados

3. **Notificaciones:**
   - Notificar cuando se acerca límite
   - Enviar email cuando plan esté por expirar

4. **Compliance:**
   - Cumplir con GDPR/CCPA para datos de usuarios
   - Implementar opción de borrar cuenta

---

## 📞 Soporte y Contacto

Para problemas o preguntas sobre esta implementación:

1. Revisar sección de Troubleshooting
2. Verificar logs de backend y frontend
3. Consultar documentación de FastAPI y React
4. Revisar código fuente en archivos mencionados

---

## 📅 Historial de Cambios

- **2024-XX-XX:** Implementación inicial del sistema de planes
- **2024-XX-XX:** Agregado modal de pago
- **2024-XX-XX:** Agregado presupuesto de ejemplo
- **2024-XX-XX:** Documentación completa

---

## 🎓 Recursos Adicionales

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)

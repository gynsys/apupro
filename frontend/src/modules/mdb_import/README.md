# Importación de presupuestos MDB

Este módulo agrega la importación de proyectos Maprex/Lulo en formato Microsoft
Access (`.mdb`, `.accdb` o `.prx`) como presupuestos de Costbase.

## Flujo

1. El superadmin abre **Gestor de Presupuestos**.
2. Pulsa **Importar MDB**.
3. Selecciona el archivo Access o un ZIP de CSV.
4. El backend ejecuta `mdbtools` o lee el ZIP y obtiene:
   - `ObraProy`
   - `ObraApun`
   - `ObraPart`
   - `ObraMate`
   - `ObraEqui`
   - `ObraMano`
   - `ObraPainMate`
   - `ObraPainEqui`
   - `ObraPainMano`
5. Crea un `Budget` nuevo con sus `BudgetItem` y componentes APU.
6. Devuelve el resumen y el enlace al presupuesto.

## Access antiguo

Si el archivo es Access 1.0/2.0, `mdbtools` no puede abrirlo. El modal ofrece
descargar:

```text
/tools/exportar_mdb_windows.ps1
```

Ese script usa DAO de 32 bits en Windows, exporta los 9 CSV y genera un ZIP
listo para subir en el mismo modal.

## Seguridad

- Solo el superadmin puede llamar al endpoint.
- El archivo se guarda en un temporal y se elimina al terminar.
- No modifica bases Costbase ni el catálogo maestro.

## Limitaciones

- `mdbtools` no abre archivos Access 1.0/2.0.
- Los archivos con contraseña no se pueden abrir sin la clave.
- Si el archivo no es compatible, se debe usar el exportador Windows + ZIP.

## Backend

```text
backend/app/modules/mdb_import/
├── __init__.py
├── router.py
├── service.py
└── README.md
```

Endpoint:

```text
POST /api/v1/budgets/import-mdb
```

## Frontend

```text
frontend/src/modules/mdb_import/
├── components/ImportMdbModal.jsx
├── services/mdbImportService.js
└── README.md
```

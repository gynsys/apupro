# MDB Import

Módulo de importación de presupuestos Maprex/Lulo desde Microsoft Access.

## Endpoint

```text
POST /api/v1/budgets/import-mdb
Content-Type: multipart/form-data
Campo: file
```

Solo superadmin.

## Requisitos

- `mdbtools` instalado en la imagen (`mdb-tables`, `mdb-export`).
- Archivo Access sin contraseña y con el esquema Maprex/Lulo.

## Tablas leídas

```text
ObraProy
ObraApun
ObraPart
ObraMate
ObraEqui
ObraMano
ObraPainMate
ObraPainEqui
ObraPainMano
```

## Resultado

```json
{
  "budget_id": "...",
  "name": "Importado MDB - ...",
  "currency": "VES",
  "items": 45,
  "materials": 132,
  "equipments": 176,
  "labors": 210,
  "warnings": []
}
```

## Limitaciones

- `mdbtools` no soporta bases Access 1.0/2.0. Para esos casos hay que
  exportar desde Access a CSV/Excel.
- Archivos con contraseña no se pueden abrir.

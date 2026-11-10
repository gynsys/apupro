# MDB Import

Módulo de importación de presupuestos Maprex/Lulo desde Microsoft Access.

## Endpoint

```text
POST /api/v1/budgets/import-mdb
Content-Type: multipart/form-data
Campo: file
```

Acepta `.mdb`, `.accdb`, `.prx` y `.zip`.

El ZIP debe contener:

```text
ObraProy.csv
ObraApun.csv
ObraPart.csv
ObraMate.csv
ObraEqui.csv
ObraMano.csv
ObraPainMate.csv
ObraPainEqui.csv
ObraPainMano.csv
```

Solo superadmin.

## Requisitos

- `mdbtools` instalado en la imagen (`mdb-tables`, `mdb-export`).
- Para Access 1.0/2.0, usar el ZIP de CSV generado desde Windows con DAO.

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

- `mdbtools` no soporta bases Access 1.0/2.0. Para esos casos se debe usar el
  exportador Windows y subir el ZIP de CSV.
- Archivos con contraseña no se pueden abrir.

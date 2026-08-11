# Problemas con Exportación a Excel con openpyxl

## Fecha
2026-08-11

## Problemas Encontrados

### 1. Dependencia openpyxl
- **Problema**: La librería `openpyxl` no estaba instalada en el contenedor Docker
- **Solución intentada**: Instalación manual con `pip install openpyxl==3.1.2`
- **Resultado**: La instalación se perdía al reiniciar el contenedor
- **Solución definitiva**: Agregar `RUN pip install openpyxl==3.1.2` al Dockerfile y reconstruir la imagen

### 2. Atributos incorrectos en modelos
- **Problema**: Se usaban nombres de atributos incorrectos en los modelos de APU
- **Errores específicos**:
  - `BudgetItem.unit_price` → No existe en el modelo
  - `CostAPUMaterial.Cant` → El atributo correcto es `CanIns`
  - `CostAPUMaterial.Desperdicio` → El atributo correcto es `Desper`
  - `CostAPUEquipment.Cant` → El atributo correcto es `CanIns`
  - `CostAPUEquipment.CopDep` → El atributo correcto es `Deprec`
- **Solución**: Corregir los nombres de atributos según el modelo real

### 3. Sintaxis de openpyxl
- **Problema**: Uso incorrecto de la función `ws.cell()`
- **Error**: Se usaba notación de celda tipo "B3" pero openpyxl requiere row, column (números)
- **Solución**: Cambiar `ws.cell("B3", valor)` a `ws.cell(3, 2, valor)`

### 4. Estructura de datos CRUD
- **Problema**: Las funciones CRUD devuelven tuplas `(apu_row, master_row)` no objetos simples
- **Error**: Se intentaba acceder directamente a atributos de la tupla
- **Solución**: Desestructurar las tuplas correctamente `(apu_mat, mat)` y acceder a los atributos del objeto master

### 5. Ajuste de dimensiones de columnas
- **Problema**: Error al ajustar anchos de columnas en openpyxl
- **Error**: `AttributeError: 'int' object has no attribute 'reindex'`
- **Solución**: Eliminar el ajuste de dimensiones de columnas para el presupuesto

## Estado Actual
- ✅ **Presupuesto**: Funciona correctamente (exporta XLSX con fórmulas básicas)
- ❌ **APU**: Sigue dando errores 500

## Prueba Alternativa: Google Sheets

### Motivo
Exportar a Google Sheets es más fácil porque:
- API más simple y robusta
- Sin dependencias complejas (no requiere openpyxl)
- Fórmulas más consistentes (ej: `=A1*B1` vs `=RC[-1]*RC[-2]`)
- Formato más fácil de aplicar
- Sin problemas de compatibilidad

### Implementación a Probar
Crear nuevo endpoint: `POST /api/v1/cost360/apu/{item_id}/export-googlesheet`

### Archivos a Crear
- `backend/app/api/v1/endpoints/cost360_google.py` (nuevo)
- Actualizar `backend/app/api/v1/api.py` para incluir el nuevo router

### Archivos a Modificar (Solo si la prueba funciona)
- ELIMINAR: `backend/app/api/v1/endpoints/cost360.py` → Líneas del endpoint `export_apu_excel`
- ELIMINAR: `frontend/src/modules/cost360/pages/APUViewer.jsx` → Función `handleExportToExcel` actual

### Archivos a NO Modificar
- ✅ Mantener: Exportación de presupuesto a Excel (funciona bien)
- ✅ Mantener: Todas las demás funcionalidades

### Pasos de Prueba
1. Crear nuevo endpoint con Google Sheets API
2. Configurar credenciales de Google Cloud
3. Implementar exportación con fórmulas y formato
4. Probar en frontend
5. Si funciona, eliminar implementación de Excel para APU
6. Si NO funciona, mantener implementación actual y seguir con Excel

### Decisión Final
Si Google Sheets funciona correctamente:
- ELIMINAR: Endpoint actual de exportación a Excel para APU
- ELIMINAR: Dependencia openpyxl del Dockerfile (solo si no se usa para presupuesto)
- MANTENER: Exportación de presupuesto a Excel (funciona bien)

# Documentación de Exportación a Excel

## Fecha
2026-08-11

## Resumen
Implementación de exportación a Excel con fórmulas nativas para APU y presupuestos de Cost360/APUpro.

## Archivos Modificados

### Backend
- `backend/app/api/v1/endpoints/cost360.py` - Endpoint de exportación de APU
- `backend/app/api/v1/endpoints/budgets.py` - Endpoint de exportación de presupuesto
- `backend/requirements.txt` - Dependencia openpyxl==3.1.2
- `backend/Dockerfile` - Instalación de openpyxl en la imagen Docker

### Frontend
- `frontend/src/modules/cost360/pages/APUViewer.jsx` - Botón de exportación de APU
- `frontend/src/pages/admin/BudgetHomePage.jsx` - Botón de exportación de presupuesto

## Exportación de APU a Excel

### Endpoint
`POST /api/v1/cost360/apu/{item_id}/export-excel`

### Estructura del Archivo Excel

#### Header (Filas 1-9)
- **B1**: "ANÁLISIS DE PRECIO UNITARIO" (título, tamaño 14, centrado)
- **B3**: "Obra: {nombre_obra}" (vacío si no hay nombre)
- **B4**: Contratante (vacío si no hay contratante)
- **E5**: "Part. No.:" | **F5**: "1"
- **G5**: "Fecha:" | **H5**: Fecha actual formato dd/mm/yyyy
- **B6**: "Descripción:" (tamaño 7)
- **C6:H6**: Descripción de la partida (merge, wrap text, tamaño 7)
- **G8**: "Rendimiento:" | **H8**: Valor de rendimiento
- **B9**: "Código:" | **C9**: Código COVENIN o CodPar
- **E9**: "Unidad:" | **F9**: Unidad
- **G9**: "Cantidad:" | **H9**: "1"

#### Materiales (Filas 11+)
- **Encabezados**: No., Descripción, Und., Cant., Desp., Precio, Total
- **Fórmula Total**: `=ROUND((G{row}*E{row})*((F{row}/100)+1),2)`
- **Fórmula Total Materiales**: `=SUM(H{first}:H{last})`

#### Equipos
- **Encabezados**: No., Descripción, "", Cant., Cop/Dep, Precio, Total
- **Fórmula Total**: `=ROUND((G{row}*E{row})*(F{row}),2)`
- **Fórmula Total Equipos**: `=SUM(H{first}:H{last})`
- **Costo Unitario Equipos**: `=ROUND(H{total_eq}/H9,2)`

#### Mano de Obra
- **Encabezados**: No., Descripción, Cant., Jornal, Bono, Total Jornal, Total Bono
- **Fórmula Total Jornal**: `=ROUND((D{row}*E{row}),2)`
- **Fórmula Total Bono**: `=ROUND((D{row}*F{row}),2)`
- **SubTotal Mano de Obra**: `=SUM(G{first}:G{last})` y `=SUM(H{first}:H{last})`
- **Prestaciones Sociales**: `=ROUND((C{row}/100)*G{sub_row},2)` (valor predeterminado: 435)
- **Total General Mano de Obra**: `=G{ps_row}+H{ps_row}+G{sub_row}+H{sub_row}`
- **Costo Unitario de Mano de Obra**: `=ROUND(H{tg_row}/H9,2)`

#### Resumen
- **Costo Directo Subtotal A**: `=ROUND(H{total_mat}+H{total_eq}+H{cuo_mo},2)`
- **Administración y Gastos Generales**: `=ROUND((H{cd_row}*C{ad_row})/100,2)` (predeterminado: 16%)
- **Subtotal B**: `=H{cd_row}+H{ad_row}`
- **Imprevisto Utilidad**: `=ROUND((H{sb_row}*E{iu_row})/100,2)` (predeterminado: 10%)
- **Subtotal C**: `=H{sb_row}+H{iu_row}`
- **Financiamiento**: `=ROUND((H{sc_row}*E{fin_row})/100,2)` (predeterminado: 0%)
- **Precio Unitario Sin Impuesto**: `=H{sc_row}+H{fin_row}`
- **Impuesto (I.V.A.)**: `=ROUND((H{ps_row}*E{iva_row})/100,2)` (predeterminado: 0%)
- **Otros Impuestos**: `=ROUND((H{ps_row}*E{oi_row})/100,2)` (predeterminado: 0%)
- **Precio Unitario Final**: `=H{ps_row}+H{iva_row}+H{oi_row}`

#### Anchos de Columnas
- A: 12
- B: 8
- C: 50
- D: 12
- E: 12
- F: 12
- G: 15
- H: 18

### Atributos de Modelos Utilizados
- **CostAPUMaterial**: `CanIns` (cantidad), `Desper` (desperdicio)
- **CostAPUEquipment**: `CanIns` (cantidad), `Deprec` (depreciación)
- **CostAPULabor**: `CanIns` (cantidad)
- **CostMaterial**: `Descri`, `UniMat`, `CosMat`
- **CostEquipment**: `Descri`, `CosDia`
- **CostLabor**: `Descri`, `Jornal`, `Bono`

### Referencia
Basado en el script local `C:\Users\pablo\Desktop\BD_COST360\apu_formulas.py`

## Exportación de Presupuesto a Excel

### Endpoint
`POST /api/v1/budgets/{budget_id}/export-excel`

### Estructura del Archivo Excel

#### Header (Filas 1-4)
- **B1**: Nombre del proyecto o "PRESUPUESTO" (tamaño 14, negrita)
- **B2**: "Obra: {project_name}" (vacío si no hay)
- **B3**: "Contratante: {client_name}" (solo si existe)
- **C4**: "RIF: {company_rif}" (solo si existe)

#### Tabla de Partidas (Filas 6+)
- **Encabezados**: Part. No, Código COVENIN, Descripción, Unidad, Cantidad, Precio Unitario, Total
- **Fórmula Total**: `=G{row}*F{row}`

#### Cálculo de Precio Unitario
El precio unitario se calcula dinámicamente desde el APU de cada partida:
```python
total_mat = sum((mat.CosMat * apu_mat.CanIns * (1 + apu_mat.Desper/100)) 
              for apu_mat, mat in mat_rows)
total_eq = sum((eq.CosDia * apu_eq.CanIns * apu_eq.Deprec) 
             for apu_eq, eq in eq_rows)
total_mo = sum((mo.Jornal * apu_mo.CanIns + mo.Bono * apu_mo.CanIns) 
             for apu_mo, mo in mo_rows)
pu = round(total_mat + total_eq + total_mo, 2)
```

#### Totales
- **Total (Sin I.V.A.)**: `=SUM(H{first}:H{last})`
- **I.V.A. ({iva_percent}%)**: `=H{row-1}*{iva_percent/100}`
- **Total General**: `=H{row-2}+H{row-1}`

#### Anchos de Columnas
- B: 8
- C: 15
- D: 60 (descripción más ancha)
- E: 10
- F: 12
- G: 15
- H: 15

### Atributos de Modelo Budget
- `project_name`: Nombre de la obra
- `client_name`: Nombre del contratante
- `company_rif`: RIF de la empresa
- `iva_percent`: Porcentaje de IVA (predeterminado: 16)

## Dependencias

### Python
- `openpyxl==3.1.2` - Generación de archivos Excel con fórmulas nativas

### Instalación en Docker
```dockerfile
RUN pip install openpyxl==3.1.2
```

## Formato de Celdas

### Números
- **Formato**: `#,##0.00` (separador de miles, 2 decimales)

### Fechas
- **Formato**: dd/mm/yyyy

### Texto
- **Header**: Tamaño 14, negrita, centrado
- **Descripciones**: Tamaño 7, wrap text, alineación izquierda
- **Encabezados de tabla**: Negrita, centrado

## Errores Corregidos

### 1. openpyxl no instalado
- **Problema**: `ModuleNotFoundError: No module named 'openpyxl'`
- **Solución**: Agregar `openpyxl==3.1.2` a requirements.txt y Dockerfile

### 2. Atributos incorrectos de modelos
- **Problema**: `AttributeError: 'CostAPUMaterial' object has no attribute 'Cant'`
- **Solución**: Usar atributos correctos: `CanIns`, `Desper`, `Deprec`

### 3. Sintaxis incorrecta de openpyxl
- **Problema**: `AttributeError: 'int' object has no attribute 'reindex'`
- **Solución**: Usar `ws.column_dimensions['B'].width = 8` en lugar de `ws.column_dimensions['B'] = 8`

### 4. Notación de fórmulas
- **Problema**: Fórmulas RC (`=RC[-1]*RC[-2]`) causaban errores
- **Solución**: Usar notación A1 (`=G7*F7`)

### 5. Valores numéricos con formato incorrecto
- **Problema**: `"435.0,00"` causaba error en Excel
- **Solución**: Usar valores numéricos puros `435` en lugar de strings formateados

## Historial de Commits

### APU Excel
- `f25beb3` - Mejorar exportación de APU a Excel con formato y fórmulas basados en apu_formulas.py
- `95547d1` - Corregir formato de valores numéricos en celdas de Excel
- `b1abe51` - Agregar ajuste de anchos de columnas con sintaxis correcta de openpyxl
- `1eb1d8f` - Mejorar formato de header en exportación de APU

### Presupuesto Excel
- `9902ddb` - Mejorar exportación de presupuesto a Excel

## Pruebas

### Script de Diagnóstico
- **Archivo**: `backend/debug_apu_export.py`
- **Propósito**: Prueba individual de cada componente (openpyxl, DB, datos, generación de Excel)
- **Ejecución**: `python debug_apu_export.py`

### Resultados del Diagnóstico
- ✅ openpyxl importado correctamente (versión 3.1.2)
- ✅ Workbook creado exitosamente
- ✅ Conexión a base de datos exitosa
- ✅ Item obtenido correctamente
- ✅ Datos del APU obtenidos correctamente
- ✅ Excel con datos creado exitosamente
- ✅ Excel con fórmulas creado exitosamente

## Notas Importantes

1. **Valores predeterminados**: Los porcentajes (admin_gg, imprevisto_ut, etc.) actualmente están hardcodeados. En el futuro deberían venir de configuración del usuario.

2. **Nombre de obra**: Actualmente usa `item.Descri` como nombre de obra. Debería venir de una tabla de obras.

3. **Contratante**: Actualmente no se almacena en el modelo APU. Debería agregarse a la configuración.

4. **Formulas**: Todas las fórmulas usan notación A1 de Excel para máxima compatibilidad.

5. **Persistencia**: La instalación de openpyxl está en el Dockerfile para que persista entre reconstrucciones del contenedor.

## Referencias

- Script original: `C:\Users\pablo\Desktop\BD_COST360\apu_formulas.py`
- Documentación de openpyxl: https://openpyxl.readthedocs.io/
- Documentación de fórmulas Excel: https://support.microsoft.com/excel

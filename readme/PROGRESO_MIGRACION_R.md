# Bitácora: Migración Base Partidas R Provisional

## Contexto General

El PDF `partidas_R.pdf` (aprox. 1,042 páginas) contiene partidas tipo "R" (Reparación/Rehabilitación) del estándar Covenin, digitadas originalmente en 2015. El objetivo es:

1. Extraer las ~1,042 partidas con sus insumos (M + E + MO).
2. Cruzar contra la Base Maestra existente para **no duplicar** las 172 partidas R que ya están en producción.
3. Dejar que el usuario actualice los precios del 2015 a valores de mercado actual (dolarizados).
4. Subir las partidas nuevas (sin duplicados) a una **Base Provisional R** separada en Postgres (`schema: partidas_r_provisional`) para revisión antes de integrarlas a la base maestra.

---

## Archivos Clave

| Archivo | Ubicación | Descripción |
|---|---|---|
| `partidas_R.pdf` | `C:\Users\pablo\Documents\` | Fuente de datos. ~1,042 páginas. |
| `partidas_R.json` | `C:\Users\pablo\Documents\` | JSON resultado de la extracción. Guardado progresivamente. |
| `extractor_pdf_json.py` | `/apupro_platform/` | Script extractor con IA (Tesseract + pdfplumber). Tiene resume automático. |
| `importador_base_r.py` | `/apupro_platform/` | Script de importación en 2 pasos (step1 y step2). |
| `r_items.txt` | `/apupro_platform/` | Lista de `CovPar` de las partidas R existentes en producción (exportada vía SSH). |
| `precios_para_actualizar.xlsx` | `/apupro_platform/` | Excel generado para que el usuario actualice precios de materiales y equipos. |

---

## NOTA CRÍTICA: CodPar vs CovPar

> ⚠️ Ver `CONFUSION_CODPAR_COVPAR.md` para contexto completo.
>
> - **`CodPar`**: Código interno de la BD (ej. `R001`). NO usar para identificar duplicados.
> - **`CovPar`**: Código Covenin estándar (ej. `R.11.001.0001`). **ESTE ES EL QUE SE USA PARA CRUCE.**
> - En `importador_base_r.py`, el cruce se hace siempre con `WHERE "CovPar" LIKE 'R%'`.

---

## Historial de Ejecución

### Sesión 2026-08-25/26

| # | Acción | Resultado |
|---|---|---|
| 1 | Primera extracción del PDF | Se paró en partida 241 (sin guardado progresivo) |
| 2 | Reescritura de `extractor_pdf_json.py` | Agregado guardado progresivo, auto-resume, y `codigo_covenin` en el JSON |
| 3 | Extracción con auto-resume | Continuó desde partida 242, llegó a 499, luego a 737 |
| 4 | Generación de `preliminar_insumos.xlsx` | 59 mat + 190 eq + 61 MO únicos (de las primeras 499 partidas) |
| 5 | Usuario actualizó precios en Excel | Materiales y Equipos con nuevos precios de mercado |
| 6 | Extracción detenida en 737 | Decisión: primera subida provisional con las 737 ya procesadas |
| 7 | Exportación `r_items.txt` de producción | Hecha vía `ssh_runner.py` + `docker exec psql` al contenedor `apupro_platform-apupro-db-1` |
| 8 | Ejecución de `importador_base_r.py step1` | **EN PROGRESO**: inyecta Covenin en JSON + cruza + genera Excel final |

---

## Próximos Pasos Pendientes

- [ ] Esperar resultado del `step1` → revisar Excel `precios_para_actualizar.xlsx`
- [ ] Usuario actualiza precios en Excel si hay insumos no cubiertos
- [ ] Implementar y ejecutar `step2` → crear schema `partidas_r_provisional` en Postgres
- [ ] Verificar las partidas en el frontend (la base debe aparecer en el selector de bases)
- [ ] Extraer partidas 738–1042 del PDF en otra sesión y repetir el ciclo
- [ ] Una vez validadas, fusionar con la Base Maestra (acción futura separada)


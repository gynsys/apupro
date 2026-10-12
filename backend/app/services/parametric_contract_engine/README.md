# Motor de Contratos Paramétricos Data-Driven (Parametric Contract Engine)

## 1. Propósito
Este módulo implementa el análisis empírico y la ontología paramétrica derivada directamente de las **17.343 partidas maestras** y las **25 familias de materiales** de la base de datos de CostBase.

Su objetivo es:
- Garantizar **cero alucinaciones** y **cero consumo de tokens en navegación**.
- Validar de forma determinista y ultrarrápida (0 ms) que cualquier partida contenga los parámetros físicos críticos (dimensiones, espesores, resistencias, diámetros, dosificaciones, potencias, calibres).
- Proveer chips y opciones 100% reales extraídos de las partidas existentes en la base de datos de obras civiles.

---

## 2. Aislamiento y Desconexión Rápida (Plug & Play)

Este módulo fue diseñado para ser **completamente independiente y desacoplado**. Si por cualquier razón se decide no utilizar:

### Opción A: Desconexión suave (Flag)
En `__init__.py`, cambiar:
```python
ENABLE_PARAMETRIC_ENGINE = False
```
El sistema revertirá automáticamente al validador previo sin romper ningún flujo.

### Opción B: Eliminación total
Basta con eliminar esta carpeta completa:
`backend/app/services/parametric_contract_engine/`

No deja dependencias circulares ni tablas huérfanas.

---

## 3. Componentes del Módulo

- `db_miner.py`: Script de minería de datos que se ejecuta contra PostgreSQL (`cost360_items`) para extraer patrones de frecuencias, familias y parámetros.
- `taxonomy.py`: Diccionario estructurado de familias constructivas, unidades válidas y parámetros críticos obligatorios.
- `contract_evaluator.py`: Función evaluadora que recibe cualquier descripción y dictamina si cumple el contrato paramétrico o qué parámetro exacto falta.
- `chips_catalog.json`: Catálogo de opciones y chips técnicos reales generados a partir de la base de datos.

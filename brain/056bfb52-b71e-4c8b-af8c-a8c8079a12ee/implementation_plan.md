# Plan de Implementación: Sistema de Precios Automatizados (Web Scraping & Factores)

## Objetivo Comercial y Técnico
Crear una arquitectura de actualización de base de datos maestra que permita **automatizar la obtención de precios** desde el mercado real (Web Scraping). Esto abrirá la puerta a un modelo de negocio de "Suscripción de Actualización Automática de Precios".

El mayor reto será sanear y estructurar la base de datos actual: agrupar las descripciones deficientes o sucias en familias ordenadas que puedan ser mapeadas a indicadores de mercado.

## Estrategia Dividida: Mano de Obra vs. Materiales

### 1. Mano de Obra (Estrategia de Factores)
Para el personal, la multiplicación por factores es ideal, ya que los salarios suelen estar tabulados en base a un salario mínimo, salario de convención colectiva o sueldo base.
- Se creará un **Salario Base** (Insumo Líder).
- Los distintos cargos (Albañil, Maestro de Obra, Ayudante) tendrán un `factor_salarial` (Ej. Maestro = Base * 1.5).
- Al actualizar el Salario Base, toda la tabulación de mano de obra se recalcula instantáneamente.

### 2. Materiales (Estrategia de Web Scraping y Saneamiento)
Para los materiales, los factores no son viables porque el mercado es volátil y no lineal. La estrategia será una asignación directa (1 a 1 o 1 a N) desde un **Indicador de Mercado (Scraping)**.

#### Fase A: Saneamiento y Agrupación (El Reto Principal)
1. **Limpieza de Descripciones:** Utilizar la IA para leer el listado completo de materiales, limpiar abreviaciones extrañas, unificar unidades métricas y crear descripciones legibles.
2. **Creación de Familias de Alta Calidad:** Agrupar los miles de insumos en Familias Comerciales Estándar (Ej. "Acero Estructural", "Cementos", "Pinturas", "Cables Eléctricos").

#### Fase B: Arquitectura de Web Scraping
- **`CostMarketIndicator` (Tabla Nueva):** Almacenará los precios reales del mercado en su unidad comercial (ej. "Cuñete de Pintura Exterior", "Saco de Cemento 42.5kg"). Estos precios se alimentarán de un bot de Web Scraping (ej. raspando precios de ferreterías locales como EPA, Novey, etc.).
- **Mapeo Directo:** En la tabla de `CostMaterial`, cada material "sucio/técnico" apuntará a un `CostMarketIndicator`.
- **Conversión de Unidad Comercial a Unidad BD:** Si la BD usa "kg" y el Web Scraper lee "saco de 42.5kg", la tabla de mapeo tendrá la conversión matemática exacta para extraer el precio unitario base sin usar factores de relación de precio, sino factores de **conversión de unidad**.

## User Review Required
> [!IMPORTANT]
> Esta arquitectura está orientada a vender la automatización en el futuro. El siguiente paso lógico, antes de construir el Web Scraper, es **construir el módulo de Saneamiento con IA** para limpiar la base de datos de materiales y asignarles Familias limpias. 
> 
> ¿Quieres que empecemos por crear este módulo de Saneamiento Asistido por IA para ir limpiando las descripciones deficientes?

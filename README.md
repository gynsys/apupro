# CostBase Platform (APUPro)

Plataforma integral de gestión de presupuestos, Análisis de Precios Unitarios (APU), base de datos de insumos de construcción e inteligencia de costos (Cost360).

---

## 📚 Documentación Técnica

La documentación detallada del proyecto se encuentra organizada en el directorio [`readme/`](file:///c:/Users/pablo/Documents/apupro_platform/readme/):

- [Módulo de Planificación y Cronograma de Obra (CPM / Gantt)](file:///c:/Users/pablo/Documents/apupro_platform/readme/MODULO_CRONOGRAMA_CPM.md): Documentación del motor determinista de ruta crítica, modelos relacionales, endpoints y guía para reactivación de la interfaz.
- [Bitácora Cost360](file:///c:/Users/pablo/Documents/apupro_platform/readme/BITACORA_COST360.md)
- [Bitácora Creación y Visor APU](file:///c:/Users/pablo/Documents/apupro_platform/readme/BITACORA_CREACION_Y_VISOR_APU.md)
- [Consultas de Base de Datos](file:///c:/Users/pablo/Documents/apupro_platform/readme/DB_CONSULTAS.md)

---

## 🚀 Despliegue

- **Scripts de despliegue:** `deploycostbase.bat` y `deployapupro.bat`.
- **Pipeline CI/CD:** GitHub Actions `.github/workflows/deploy.yml` hacia DigitalOcean (`167.172.115.154`).

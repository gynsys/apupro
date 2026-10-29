# CostBase Platform (APUPro)

Plataforma integral de gestión de presupuestos, Análisis de Precios Unitarios (APU), base de datos de insumos de construcción e inteligencia de costos (Cost360).

---

## 📚 Documentación Técnica

La documentación detallada del proyecto se encuentra organizada en el directorio [`readme/`](file:///c:/Users/pablo/Documents/apupro_platform/readme/):

- **[Motor v2.0: WorkSpec + Compositor Determinista](file:///c:/Users/pablo/Documents/apupro_platform/readme/MOTOR_V2_WORKSPEC.md)** *(Nueva arquitectura en 2 fases con latencia reducida en 85% y cero alucinaciones de precios)*
- **[Guía Maestra del Generador de APU con IA](file:///c:/Users/pablo/Documents/apupro_platform/readme/ai_apu_generator.md)** *(Pipeline defensivo multi-capa y normativa COVENIN)*
- [Base de datos de LULO a PostgreSQL](readme/Base%20de%20datos%20de%20LULO%20a%20PostgreSQL/README.md) *(documentación de la base Lulowin/Maprex y su conversión a PostgreSQL)*
- [Bitácora Creación y Visor APU](file:///c:/Users/pablo/Documents/apupro_platform/readme/BITACORA_CREACION_Y_VISOR_APU.md)
- [Importación de Presupuestos desde Archivo](readme/IMPORTACION_PRESUPUESTOS_DESDE_ARCHIVO.md)

---

## 🚀 Despliegue

- **Scripts de despliegue:** `deploycostbase.bat` y `deployapupro.bat`.
- **Pipeline CI/CD:** GitHub Actions `.github/workflows/deploy.yml` hacia DigitalOcean (`167.172.115.154`).

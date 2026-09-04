# Guía: Backup y Restauración de Presupuestos

## 📋 Qué es un Backup (.cb)

Un archivo `.cb` es un **backup encriptado** de CostBase que contiene:
- ✅ Todas las partidas del presupuesto
- ✅ Insumos (materiales, equipos, mano de obra)
- ✅ Configuraciones personalizadas
- ✅ Cálculos y totales
- 🔒 Encriptación AES-256 para seguridad

**Solo puede ser importado por tu cuenta** para proteger tus datos.

---

## 🚀 Crear un Backup

### Paso 1: Acceder a tus Presupuestos
1. Inicia sesión en CostBase
2. Ve a la sección "Presupuestos"
3. Localiza el presupuesto que deseas respaldar

### Paso 2: Generar el Backup
1. En la tarjeta del presupuesto, busca el icono **CloudDownload** (Exportar Backup)
2. Click en el icono
3. El sistema genera automáticamente el archivo `.cb`
4. El archivo se descarga con el nombre: `nombre_presupuesto_backup.cb`

### Paso 3: Verificar el Backup
- El archivo debería aparecer en tu carpeta de descargas
- El nombre debe terminar en `.cb`
- El tamaño varía según el tamaño del presupuesto

**⏱️ Tiempo estimado:** 2-3 minutos
**📱 Nivel:** Principiante

---

## 📥 Restaurar un Backup

### Paso 1: Acceder a la Importación
1. En la página principal de Presupuestos
2. Click en el botón **"Importar Backup"**
3. Se abrirá el selector de archivos

### Paso 2: Seleccionar el Archivo
1. Navega a la carpeta donde guardaste el `.cb`
2. Selecciona el archivo `nombre_presupuesto_backup.cb`
3. Click en "Abrir"

### Paso 3: Proceso de Importación
- El sistema verifica que el archivo sea válido
- Desencripta y restaura el presupuesto completo
- El presupuesto aparece en tu lista con todos sus datos originales

### Paso 4: Verificar la Importación
- El presupuesto restaurado debería aparecer en tu lista
- Verifica que las partidas, totales y configuraciones sean correctos
- El presupuesto es independiente de cualquier cambio posterior

**⏱️ Tiempo estimado:** 1-2 minutos
**📱 Nivel:** Principiante

---

## 💡 Casos de Uso Recomendados

### ✅ Cuándo hacer Backup
- Antes de realizar cambios importantes
- Al finalizar proyectos significativos
- Antes de eliminar el presupuesto original
- Para respaldo periódico de proyectos en curso

### ✅ Cuándo restaurar
- Recuperación de proyectos eliminados accidentalmente
- Transferencia entre cuentas (si tienes acceso)
- Restauración de versiones anteriores
- Migración a nuevas cuentas

---

## ⚠️ Notas Importantes

- **Seguridad:** Los archivos `.cb` están encriptados y solo funcionan con tu cuenta
- **Independencia:** Un presupuesto restaurado es completamente independiente del original
- **Compatibilidad:** Los backups son compatibles entre diferentes versiones de CostBase
- **Integridad:** El sistema verifica la integridad del archivo antes de importar

---

## 🔧 Solución de Problemas

### Error: "Archivo no válido"
- Verifica que el archivo termine en `.cb`
- Asegúrate de que el archivo no esté corrupto
- Intenta crear un nuevo backup del presupuesto original

### Error: "No se puede importar"
- Verifica que estás en la misma cuenta que creó el backup
- Confirma que tienes suficiente espacio en tu límite de presupuestos
- Contacta soporte si el problema persiste

---

## 📞 ¿Necesitas más ayuda?

Si tienes problemas con backup o restauración:
- Revisa esta guía nuevamente
- Contacta soporte técnico
- Consulta el centro de ayuda para más tutoriales

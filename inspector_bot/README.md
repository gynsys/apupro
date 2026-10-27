# 🏗️ Bot de Inspección de Obras y Memoria Fotográfica

Bot autónomo de Telegram para inspectores, residentes y gerentes de proyectos de construcción. Convierte reportes rápidos de mensajería en **Informes Diarios de Inspección y Memorias Fotográficas profesionales en PDF**.

---

## 🚀 Fase 1: Ficha Técnica + Memoria Fotográfica (Completada)

### 📌 Flujo de uso:
1. **Pega tu reporte:** Envía el mensaje diario tal como lo redactas en campo:
   ```text
   Fecha: 27/10/2026
   *Obra:* REHABILITACIÓN INTEGRAL DE LA UNIDAD DE PROTECCIÓN INTEGRAL "UKATIRA-INA", UBICADA EN LA AVENIDA PRINCIPAL DE LOS CORALES, ENTRE CALLE 6 Y CALLE 2, PARROQUIA CARABALLEDA, ESTADO LA GUAIRA
   *Nombre de la empresa:* Constructora Truckers C.A
   *Ing. Residente:* Roomelt Yanes
   *Ing. Inspector:* 2 
   Guido Farroni.
   Pablo Milano 
   *Caporal* Jesús Ramirez.
   *Actividades en ejecución:* 
   .- Demolición a mano de elementos de concreto armado.
   .- Acarreo y acopio de escombros.
   .- Bote de escombros.
   *Obreros en obra:* 5 obreros.
    *Caporal de obra:* 1
   ```
2. **Envía las fotos:** El bot confirmará la ficha registrada y quedará a la espera de las fotos. Puedes enviar varias fotos juntas o una a una con su pie de foto.
3. **Genera el PDF:** Escribe `/generar` o presiona el botón interactivo **[📄 Generar PDF]**. El bot compilará y te enviará de inmediato el PDF institucional listo para compartir y firmar.

---

## 🛠️ Comandos de Telegram

* `/start` - Inicia el bot y muestra el mensaje de bienvenida con instrucciones.
* `/generar` - Compila el reporte activo y las fotos en un documento PDF.
* `/ver` - Muestra la ficha actual y cuántas fotos se han acumulado.
* `/nuevo` o `/cancelar` - Reinicia la sesión para comenzar un reporte nuevo.
* `/ayuda` - Muestra la ayuda y el formato del mensaje de inspección.

---

## ⚙️ Cómo ejecutar el Bot

Desde la terminal en el servidor o en tu máquina local:

```bash
python run_inspector_bot.py
```

### Ejecutar como servicio persistente en segundo plano (Linux / Producción):
```bash
nohup python run_inspector_bot.py > inspector_bot.log 2>&1 &
```

---

## 🔮 Fase 2 (Próximo paso): Control de Partidas y Avance Físico
* Subida de presupuesto de obra / cómputos métricos (Excel / COVENIN).
* El bot preguntará o leerá del mensaje las cantidades ejecutadas del día.
* Cálculo automático del % de avance diario y acumulado de la obra vs. metas programadas.

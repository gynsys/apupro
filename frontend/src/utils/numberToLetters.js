export function numeroALetras(numero) {
    const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
    const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
    const diez_diecinueve = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
    const veintes = ["VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
    const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

    function leerDecenas(n) {
        if (n < 10) return unidades[n];
        if (n < 20) return diez_diecinueve[n - 10];
        if (n < 30) return veintes[n - 20];
        const u = n % 10;
        if (u === 0) return decenas[Math.floor(n / 10)];
        return decenas[Math.floor(n / 10)] + " Y " + unidades[u];
    }

    function leerCentenas(n) {
        if (n === 100) return "CIEN";
        return (centenas[Math.floor(n / 100)] + " " + leerDecenas(n % 100)).trim();
    }

    function leerMiles(n) {
        if (n === 0) return "";
        if (n === 1) return "MIL";
        return (leerCentenas(n) + " MIL").trim();
    }

    function leerMillones(n) {
        if (n === 0) return "";
        if (n === 1) return "UN MILLÓN";
        if (n > 1) return (leerCentenas(n) + " MILLONES").trim();
        return "";
    }

    const entero = Math.floor(numero);
    const decimales = Math.round((numero - entero) * 100);
    
    if (entero === 0) return `CERO CON ${String(decimales).padStart(2, '0')}/100`;

    const millones = Math.floor(entero / 1000000);
    const miles = Math.floor((entero / 1000) % 1000);
    const cientos = entero % 1000;

    const partes = [];
    if (millones > 0) partes.push(leerMillones(millones));
    if (miles > 0) partes.push(leerMiles(miles));
    if (cientos > 0) partes.push(leerCentenas(cientos));

    const letras = partes.join(" ").trim();
    return `${letras} CON ${String(decimales).padStart(2, '0')}/100`;
}

# Post-Mortem: Bug de Bases de Datos "Invisibles" para Usuarios Nuevos (Septiembre 2026)

## Descripción del Problema
Los usuarios regulares (ej. `proingenioca@gmail.com` y `milanopabloe@gmail.com`) podían crear bases de datos nuevas exitosamente (recibían el mensaje de "Base de datos creada exitosamente" en el frontend). Sin embargo, al recargar la página o visualizar el grid, **estas bases de datos no se listaban**. 

En cambio, al administrador (`admin@arko360.net`) sí se le listaban sus bases de datos creadas.

## Tiempo de Debugging
~2 horas.

## Diagnóstico y Causa Raíz

1. **Las bases de datos sí se creaban**: Al consultar PostgreSQL, el backend clonaba los esquemas físicos y registraba el `owner_id` correctamente (`proingenioca@gmail.com`). El `POST /cost360/databases` devolvía `200 OK`.
2. **El backend filtraba correctamente**: El endpoint `GET /cost360/databases` (función `list_databases`) comparaba correctamente el `owner_id` con el `current_user.email`.
3. **El problema estaba en el Frontend (`cost360DatabaseService.js`)**:

El sistema de autenticación fue migrado recientemente a usar **Cookies Seguras (HTTPOnly)**. Sin embargo, quedó una **lógica heredada (legacy)** en el servicio del frontend que hacía una validación temprana del `localStorage`:

```javascript
// CÓDIGO VIEJO QUE CAUSÓ EL BUG:
export const cost360DatabaseService = {
  getAll: async () => {
    const token = localStorage.getItem('arko_admin_token') || localStorage.getItem('token');
    
    // AQUÍ ESTABA LA FALLA FATAL:
    if (!token) return { databases: [] }; 
    
    const response = await fetch(`${API_URL}/cost360/databases`, {
      headers: getAuthHeaders()
    });
    // ...
```

### ¿Por qué colisionaban las lógicas?
- Al migrar a cookies HTTPOnly, el sistema **dejó de guardar el token en el `localStorage`**.
- Cuando un usuario **nuevo** se registraba e iniciaba sesión, su sesión se guardaba exclusivamente en la cookie. Su `localStorage` estaba vacío (`token === null`).
- Al llamar a `getAll()`, el condicional `if (!token)` se evaluaba como verdadero, y la función **abortaba silenciosamente** devolviendo `{ databases: [] }` sin siquiera hacer la petición `GET` al servidor.
- Por eso en los logs del servidor NUNCA aparecía la petición `GET /api/v1/cost360/databases`.
- **¿Por qué el POST (crear DB) sí funcionaba?** Porque la función `create()` *no tenía* esta validación previa de `!token`, y la API nativa `fetch` de los navegadores envía las cookies automáticamente si el origen es el mismo (`same-origin`).
- **¿Por qué el administrador sí podía listar bases de datos?** Porque el navegador del administrador guardaba un *token viejo* en el `localStorage` de sesiones pasadas, lo que le permitía pasar la trampa del `if (!token)`.

## Solución Implementada

Se reescribió `cost360DatabaseService.js`:
1. Se **eliminó por completo** la validación de `localStorage`.
2. Se le indicó explícitamente a `fetch` que envíe las cookies usando `credentials: 'include'` o `credentials: 'same-origin'` (en este caso `'include'` por seguridad).

```javascript
// NUEVO CÓDIGO CORREGIDO:
export const cost360DatabaseService = {
  getAll: async () => {
    const response = await fetch(`${API_URL}/cost360/databases`, {
      headers: getAuthHeaders(),
      credentials: 'include' // Obliga a enviar la cookie de sesión HTTPOnly
    });
    if (!response.ok) throw new Error('Error al cargar bases de datos');
    return response.json();
  },
  // ... (se aplicó `credentials: 'include'` en todos los endpoints CRUD)
};
```

## Lección Aprendida (Para futuros desarrollos)
Si el sistema utiliza autenticación por **cookies HTTPOnly**:
1. **NUNCA** hacer validaciones en el frontend que dependan de leer el token en `localStorage` o `sessionStorage`. El frontend es "ciego" ante las cookies HTTPOnly por diseño (para prevenir ataques XSS).
2. Todo servicio que use `fetch` debe llevar siempre el parámetro `credentials: 'include'` para asegurar que la sesión viaje correctamente, y delegar al Backend la validación de seguridad (el Backend responderá `401 Unauthorized` si la cookie no es válida). 
3. Cuando una petición de lectura falla sin dejar rastros en los logs del servidor backend, siempre buscar cortocircuitos (`return` anticipados) en el código del cliente.

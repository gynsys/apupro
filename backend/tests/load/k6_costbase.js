/**
 * Script de Prueba de Carga con Grafana k6 para CostBase (hasta 10,000 VUs).
 *
 * Ejecución:
 *   k6 run -e BASE_URL=https://costbase.net -e AUTH_TOKEN=<jwt_opcional> backend/tests/load/k6_costbase.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },    // Calentamiento: 100 usuarios
    { duration: '1m', target: 500 },     // Carga media: 500 usuarios
    { duration: '2m', target: 2500 },    // Carga alta: 2,500 usuarios
    { duration: '2m', target: 10000 },   // Pico extremo: 10,000 usuarios
    { duration: '30s', target: 0 },      // Enfriamiento
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],      // Menos de 2% de error
    http_req_duration: ['p(95)<1500'],   // 95% de respuestas en < 1.5s
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://costbase.net';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

const MATERIALS_QUERIES = [
  'cemento',
  'cabilla',
  'bloque',
  'concreto',
  'pintura',
  'tuberia',
  'manto',
  'arena',
];

export default function () {
  const headers = AUTH_TOKEN
    ? { Authorization: `Bearer ${AUTH_TOKEN}` }
    : {};

  const roll = Math.random();

  if (roll < 0.60) {
    // Flujo 1 (60%): Navegación de Presupuestos / Configuración
    const url = AUTH_TOKEN
      ? `${BASE_URL}/api/v1/budgets/`
      : `${BASE_URL}/api/v1/arko/config`;
    const res = http.get(url, { headers });
    check(res, {
      'status 200 en navegacion': (r) => r.status === 200,
    });
  } else if (roll < 0.90) {
    // Flujo 2 (30%): Búsqueda de insumos en catálogo Cost360
    const term = MATERIALS_QUERIES[Math.floor(Math.random() * MATERIALS_QUERIES.length)];
    const res = http.get(
      `${BASE_URL}/api/v1/cost360/materials?search=${term}&limit=20`,
      { headers }
    );
    check(res, {
      'status 200/401 en catalogo': (r) => r.status === 200 || r.status === 401,
    });
  } else {
    // Flujo 3 (10%): Healthcheck de infraestructura
    const res = http.get(`${BASE_URL}/api/v1/health`);
    check(res, {
      'healthcheck 200': (r) => r.status === 200,
    });
  }

  // Tiempo de pensamiento realista del usuario entre clics (1 a 3 segundos)
  sleep(1 + Math.random() * 2);
}

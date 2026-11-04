// Genera public/firebase-config.js a partir de variables de entorno (deploy en Netlify u otro hosting).
// Sin FIREBASE_API_KEY no escribe nada y la app arranca en modo demo.
//
// Variables: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
//            FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const env = process.env;
const OUT = fileURLToPath(new URL('../public/firebase-config.js', import.meta.url));

if (!env.FIREBASE_API_KEY) {
  console.log('FIREBASE_API_KEY no está definida: no se genera firebase-config.js (modo demo).');
  process.exit(0);
}

const required = ['FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID'];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error('Faltan variables de entorno: ' + missing.join(', '));
  process.exit(1);
}

const config = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.FIREBASE_APP_ID
};

writeFileSync(OUT, '// Generado en el deploy por scripts/write-firebase-config.mjs. No editar.\n' +
  'export const firebaseConfig = ' + JSON.stringify(config, null, 2) + ';\n');
console.log('firebase-config.js generado para el proyecto ' + config.projectId + '.');

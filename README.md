# Sexto Hombre · Fase 0

_La planilla del cuerpo técnico._

App web (PWA) para que el asistente del entrenador cargue jugada por jugada desde una tablet: cancha, reloj, faltas, cambios obligatorios, historial editable y planilla en PDF para compartir por WhatsApp. Login con Google y datos en Firestore.

La arquitectura y las decisiones (ADRs) están en el documento «Sexto Hombre — Arquitectura».

## Estructura

```
public/
  index.html             carga la app
  app.js                 punto de entrada: arma las dependencias y registra los controladores
  firebase-config.js     configuración del proyecto (vacía = modo demo)
  sw.js                  service worker: la app abre sin señal (lista de módulos en MODULES)
  src/                   código en capas (arquitectura limpia; las dependencias apuntan hacia adentro)
    shared/              utilidades sin dependencias: ids y fechas, escape de HTML, colores
    domain/              reglas del básquet, puras y testeables: catálogo de jugadas, reloj y períodos,
                         cancha, estadísticas y exclusiones, plantel, previa y partido
    application/         casos de uso: sesión del partido (registrar jugadas y guardar), reporte para el PDF, CSV
    infrastructure/      adaptadores
      store/             puerto de datos: Firebase (Auth + Firestore) o modo demo (localStorage)
      pdf/               planilla en PDF (jsPDF + AutoTable), logo y Web Share
      platform/          pantalla encendida, portapapeles, service worker, borrador de la previa
    ui/                  interfaz
      state.js           estado de la interfaz
      render.js          router de pantallas
      events.js          despachador único de eventos del DOM (acciones data-a)
      navigation.js      navegación y sesión del usuario
      views/             HTML de cada pantalla (game/ = pantalla del partido)
      controllers/       acciones de cada pantalla
      components/        piezas de HTML reutilizables
  brand/                 logo de Sexto Hombre (SVG): logo.svg y logo-small.svg (sin costuras, para tamaños chicos)
  fonts/ + fonts.css     Saira Condensed e IBM Plex Sans servidas por la app (OFL), así funcionan sin señal
  vendor/                jsPDF 2.5.1 y jsPDF-AutoTable 3.8.2 (MIT)
tests/                   pruebas unitarias de domain, application y el store demo (node:test)
firestore.rules          reglas de seguridad
firebase.json            Hosting + Firestore
```

Reglas de dependencia: `domain` no conoce el DOM ni el store; `application` usa `domain` y el puerto `store`; `infrastructure` implementa los puertos; `ui` usa todo lo anterior. Al agregar un módulo en `src/`, sumarlo a `MODULES` en `sw.js` y subir `VERSION`.

No hay paso de build: Firebase Hosting sirve `public/` tal cual. El SDK de Firebase (10.12.2) se carga desde gstatic.

## Pruebas

```bash
npm test     # Node 20 o más nuevo, sin dependencias
```

## Probar sin Firebase (modo demo)

```bash
python3 -m http.server 8080 -d public
# abrir http://localhost:8080/?demo=1
```

Con `firebase-config.js` vacío la app también arranca en modo demo. Los datos quedan en el navegador.

## Poner en marcha con Firebase

1. **Crear el proyecto** en https://console.firebase.google.com (plan Spark, gratis).
2. **Authentication → Método de acceso → Google:** habilitarlo y elegir el correo de soporte.
3. **Firestore Database → Crear base de datos:** modo producción, región `southamerica-east1` (São Paulo), la más cercana a Santa Fe.
4. **Configuración del proyecto → Tus apps → Web (</>):** registrar la app y copiar el objeto de configuración en `public/firebase-config.js`.
   - En `authDomain` poné el dominio desde el que vas a servir la app: `TU-PROYECTO.web.app`. Así el login por redirección (el que usa la app instalada en la tablet) funciona en Safari y en navegadores que bloquean cookies de terceros.
   - En Google Cloud Console → APIs y servicios → Credenciales → el cliente OAuth «Web client (auto created by Google Service)», agregá en «URI de redireccionamiento autorizados»: `https://TU-PROYECTO.web.app/__/auth/handler`.
5. **Desplegar:**
   ```bash
   npm i -g firebase-tools
   firebase login
   # en .firebaserc reemplazá TU-PROYECTO por el ID del proyecto
   firebase deploy --only firestore:rules,hosting
   ```
6. **Habilitar a los asistentes (lista blanca):** en Firestore creá la colección `allowlist` y, por cada persona, un documento cuyo ID es su correo **en minúsculas** (por ejemplo `andresmiretti@gmail.com`). El contenido puede quedar vacío o llevar un campo `nombre`. Quien entra con una cuenta que no está en la lista ve «Tu cuenta no está habilitada».
7. **En la tablet:** abrir `https://TU-PROYECTO.web.app` en Chrome (Android) o Safari (iPad) y elegir «Agregar a la pantalla de inicio». Instalada, abre a pantalla completa y sin señal.

## Datos en Firestore

| Ruta | Contenido |
|---|---|
| `allowlist/{correo}` | Correos habilitados (se cargan a mano) |
| `users/{uid}` | Perfil. `lastSetup` (versiones anteriores) solo se usa para precargar el primer plantel |
| `teams/{id}` | Plantel: nombre, color, DT, competición y duración por defecto, jugadores (`id`, `num`, `name`, `active`) y último quinteto. El `id` de cada jugador se mantiene entre partidos |
| `games/{id}` | Partido: plantel de origen (`teamId`), local o visitante (`venue`), equipos, colores, competición, convocados (`roster`, copia del plantel al empezar), en cancha, período, reloj, puntos del rival por período, estado, resumen del tanteador |
| `games/{id}/events/{id}` | Una jugada por documento. ID generado en el dispositivo, `seq`, `rev`, `deleted` |

Nada se borra físicamente: borrar una jugada o un partido lo marca con `deleted: true`.

## Sin señal

Firestore usa caché persistente en el dispositivo: cada jugada se guarda al instante y se envía sola cuando vuelve la conexión. La barra de herramientas muestra «Guardado» o «N sin enviar». El service worker guarda la app para que abra aunque no haya señal (después de haberla abierto una vez con conexión).

## Compartir la planilla por WhatsApp

«Compartir PDF» (en la barra, en la planilla y en el menú del partido) genera el PDF en el dispositivo y abre el menú de compartir del sistema, donde se elige WhatsApp. Al finalizar el partido la app pregunta si se quiere compartir. WhatsApp no deja que una web le envíe un archivo directo, por eso pasa por ese menú. En una computadora sin menú de compartir, el PDF se descarga.

El PDF trae: clubes con sus colores, fecha, competición, estado y tiempo (o «Final»), tanteador, parciales por cuarto y la planilla por jugador con totales, faltas de equipo y técnicas del cuerpo técnico.

## Límites conocidos de la Fase 0

- Un dispositivo por partido. Abrir el mismo partido en dos tablets a la vez puede pisar el reloj y los jugadores en cancha.
- El tanteador del rival es manual; el pase a suplementario depende de que esté cargado.
- Las reglas de Firestore no se probaron contra el emulador. Antes de usarla en un partido real, conviene verificar: (a) un correo fuera de la lista no ve nada, (b) un usuario habilitado no puede leer los partidos de otro.

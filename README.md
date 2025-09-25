# Proyecto Vercel Informe (sin 404)

Estructura:
/
├─ package.json
├─ api/
│  ├─ ask.js          ← POST /api/ask (demo)
│  └─ ping.js         ← GET  /api/ping (comprobación)
└─ public/
   ├─ index.html
   └─ demo-response.json

Despliegue:
1) Sube el contenido de esta carpeta a un repo en GitHub.
2) Vercel → Add New Project → Importa el repo → Deploy.

Comprueba:
- /                    → carga la web
- /demo-response.json  → JSON demo
- /api/ping            → {ok:true,pong:true}
- /api/ask (GET)       → 405

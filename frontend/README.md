# Brightloop frontend

React + TypeScript + Vite. The full application is in `src/BrightloopApp.tsx`, with local styles, charts, and a typed data adapter beside it. The root Vite entry imports this application so the repository uses a single dependency installation and a single build configuration.

Run both the local API and frontend from the repository root with `npm run local`. Run only this UI with `npm run dev` from this directory. Without `VITE_API_URL`, a visibly labeled browser-persistent demonstration workspace is used. With the local URL configured in `.env`, authentication and all operational mutations are routed to the REST API.

Fonts are bundled locally; no CDN, analytics, payment gateway, or external runtime service is used.

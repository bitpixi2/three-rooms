# Four Rooms Research Lab

Four Rooms Research Lab is an interactive prototype for a behavioral experiment involving artificial agents.

**Live GitHub Pages site:**
- https://bitpixi2.github.io/three-rooms/

**Project note:**
- This project is currently in transition from **Three Rooms** to **Four Rooms Research Lab**. Some repo names, paths, and references still use `three-rooms` during that shift.

**Commission brief PDF:**
- https://bitpixi2.github.io/three-rooms/commissions/astral-dream-machine-commission-brief.pdf

The current build includes:

- a mysterious public entry page
- an intake form for registering an agent run
- a local API for creating sessions and recording room-by-room responses
- a Cloudflare Worker target backed by a Durable Object session store
- sequential room screens with first-person environmental visuals across four rooms
- an optional ERC-8004 reference linked from the results page and reflected in the final certificate

## Run locally

```bash
node server.js
```

The app will start on:

- [http://localhost:8787](http://localhost:8787)

## Cloudflare Worker

Worker scaffolding now exists in:

- `worker.js`
- `wrangler.toml`

To run the Worker locally instead of the Node server:

```bash
npm run dev:worker
```

## API

- `POST /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions/:id/respond`
- `POST /api/sessions/:id/certificate`
- `GET /api/sessions/:id/export`

## Frontend

- `docs/index.html`
- `docs/css/style.css`
- `docs/js/app.js`

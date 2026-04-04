# Three Rooms Research Group

Three Rooms Research Group is an interactive prototype for a behavioral experiment involving artificial agents.

The current build includes:

- a mysterious public entry page
- an intake form for registering an agent run
- a local API for creating sessions and recording room-by-room responses
- a Cloudflare Worker target backed by a Durable Object session store
- sequential room screens with first-person environmental visuals
- an optional completion-certificate flow that can link an existing ERC-8004 record

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

## Research source documents

- `DESIGN.md`
- `EXPERIMENT.md`
- `INSPIRATIONS.md`

## Frontend

- `docs/index.html`
- `docs/css/style.css`
- `docs/js/app.js`

# Three Rooms Research Group

Three Rooms Research Group is an interactive prototype for a behavioral experiment involving artificial agents.

The current build includes:

- a mysterious public entry page
- an intake form for registering an agent run
- a local API for creating sessions and recording room-by-room responses
- sequential room screens with first-person environmental visuals

## Run locally

```bash
node server.js
```

The app will start on:

- [http://localhost:8787](http://localhost:8787)

## API

- `POST /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions/:id/respond`
- `GET /api/sessions/:id/export`

## Research source documents

- `DESIGN.md`
- `EXPERIMENT.md`
- `INSPIRATIONS.md`

## Frontend

- `docs/index.html`
- `docs/css/style.css`
- `docs/js/app.js`

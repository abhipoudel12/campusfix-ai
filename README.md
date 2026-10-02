# CampusFix AI

CampusFix AI is a campus maintenance reporting prototype. It supports a **local frontend demo** and a **connected demo** backed by the deployed AWS API.

## Run locally

Requires a current Node.js installation (Node 20.19+ or 22.12+ for Vite 7).

```sh
npm install
npm run dev
```

Open **http://localhost:5173/**. Run `npm test` for the focused logic tests and `npm run build` for a production build.

## What works now

- Responsive form with JPEG, PNG, and WebP upload, preview, replace/remove controls, and an **8 MB** file limit.
- Required building/location and optional notes.
- Four clearly identified sample scenarios: broken walkway lighting, overflowing trash, damaged sidewalk, and water leak.
- Sample reports with title, location, category, severity, description, recommended action, Campus Attention Score, and status.
- Session-only dashboard with counts, score sorting, status filtering, and Open / In progress / Resolved controls.

**Demo limitation:** Uploaded photos are previewed locally but are **not analyzed, uploaded, or stored**. Report facts come only from the selected sample scenario. Reports disappear on refresh, and no report is sent to a facilities team.

### Demo scoring rule

The Campus Attention Score is a simple triage aid, **not a validated safety assessment**. It starts at 25 for Low severity, 50 for Medium, or 70 for High; adds 15 for a hazard and 5 for a recurring issue; and caps at 100. These characteristics are predefined per sample scenario. The score does not use the image or user notes.

## Connected demo and hosting

Set `VITE_API_URL=https://mkebx3gwm5.execute-api.us-east-1.amazonaws.com` when building to use the deployed API. Connected mode sends photos for AI analysis, saves report text, loads and paginates reports, and disables anonymous status editing. The API is deployed but **live AI report creation remains blocked**: four controlled photo attempts have returned HTTP 502, and no report has been saved. The API is public; use only nonprivate demo data. The frontend is not hosted yet. See [docs/amplify-hosting-plan.md](docs/amplify-hosting-plan.md) for the prepared build, hosting cost, and required CORS update.

See [docs/progress.md](docs/progress.md) for milestone evidence and remaining work. Existing AWS connection screenshots are in `docs/screenshots/`.

## Hackathon category and lane

Proposed: `#workplace-efficiency` and `#community`. Campus maintenance triage fits workplace workflows; the Social Good category has narrower focus areas.

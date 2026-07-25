# Backend Mock

This folder contains a lightweight Node.js service for pre-hardware development.

It serves the ESP32-facing payload:

```bash
npm run dev:backend
open http://localhost:8787/api/device-summary
```

No dependencies are required. The service uses Node built-ins only.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | Local server port |
| `MEGACOACH_ROOT` | `../megacoach` from project root | Optional local MegaCoach folder |
| `ASTRO_API_BASE` | `https://thai-astrology-flame.vercel.app` | Thai Astrology API base |

If `MEGACOACH_ROOT` exists, the service reads sanitized summaries from:

- `liff-app/entry-signal-data.json`
- `liff-app/idea-radar.json`
- `liff-app/monthly-plan.json`
- `liff-app/northstar.json`

It never exposes raw private portfolio data or API keys.

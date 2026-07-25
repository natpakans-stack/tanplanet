# TanPlanet Smart Astro Calendar

Pre-hardware workspace for an ESP32 CYD 3.5" smart desk display.

The goal is to prepare the data contract, backend summary service, firmware scaffold, and bring-up checklist before the hardware arrives.

## What Is Ready

| Area | Path | Status |
| --- | --- | --- |
| Project brief | `PROJECT_BRIEF.md` | Full MVP1 scope, tables, Mermaid diagrams |
| Context snapshot | `CONTEXT.md` | Current decisions, status, next steps |
| Backend mock | `backend/` | Runs without npm dependencies |
| Data fixtures | `data/` | Sample device payload and default config |
| Firmware scaffold | `firmware/` | PlatformIO/Arduino ESP32 scaffold |
| Docs | `docs/` | Contract, hardware checklist, shop questions |
| Browser mock UI | `mock-ui/` | Preview device cards from backend |

## Quick Start

Run the local backend:

```bash
npm run dev:backend
```

Open:

- `http://localhost:8787/api/status`
- `http://localhost:8787/api/device-summary`
- `http://localhost:8787/ui`

Print a sample summary:

```bash
npm run print:summary
```

## Mock UI

The browser mock is interactive:

- click a card to open the detail view
- use `‹` / `›` to page through cards
- use `Back` or `Esc` to close detail view

## Hardware Status

Target hardware is a 3.5" ESP32 CYD smart display. Exact variant is not confirmed yet.

Do not finalize display/touch/audio code until the seller confirms:

- model number
- resolution
- display driver
- touch driver
- pinout
- example code
- case fit
- speaker connector details

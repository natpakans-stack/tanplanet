# Device Summary Data Contract

ESP32 should consume a small summarized payload, not raw MegaCoach or astrology data.

Endpoint:

```text
GET /api/device-summary
```

## Top-Level Shape

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `schemaVersion` | string | yes | Contract version |
| `deviceProfile` | string | yes | Intended device profile |
| `updatedAt` | string | yes | ISO timestamp from backend |
| `expiresAt` | string | no | Cache expiry hint |
| `status.overall` | string | yes | `ok`, `degraded`, or `error` |
| `cards` | array | yes | Cards rendered by ESP32 |

## Card Shape

| Field | Type | Required | Example |
| --- | --- | --- | --- |
| `id` | string | yes | `astro_today` |
| `type` | string | yes | `astro`, `market`, `weather`, `token` |
| `title` | string | yes | `ดวงลงทุนวันนี้` |
| `value` | string | yes | `ปานกลาง` |
| `detail` | string | no | `ทำตามแผน ไม่ต้องเร่ง` |
| `tone` | string | yes | `ok`, `neutral`, `caution`, `danger` |
| `priority` | number | no | `50` |

## Supported Card Types

| Type | Purpose | MVP1 |
| --- | --- | --- |
| `clock` | Home clock summary | yes |
| `calendar` | Thai date / holiday | yes |
| `lunar` | Thai lunar / Buddha day | yes |
| `weather` | Weather now / forecast | yes |
| `astro` | Daily astrology signal | yes |
| `market` | MegaCoach market focus | yes |
| `northstar` | Long-term investing principle | yes |
| `token` | AI token/status hook | yes |

## Security Rule

The payload must not include:

- OpenAI / Claude / Codex API keys
- raw private portfolio details
- encrypted/private MegaCoach files
- long AI prompts
- personally sensitive details not needed by the display

ESP32 should only receive short display-ready summaries.


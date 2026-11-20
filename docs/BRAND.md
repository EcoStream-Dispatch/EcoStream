# EcoStream brand guide

Everything here is taken from our logo (`frontend/public/logo.png`).
The colours live in two places that must stay in sync:
- `frontend/tailwind.config.js` (use as Tailwind classes, e.g. `bg-green-700`, `text-navy-900`)
- `frontend/src/styles/index.css` (CSS variables, e.g. `var(--green-700)`)

## Colours

| Token | Hex | Use |
|---|---|---|
| navy-900 | #0B1E36 | headings, sidebar, primary text, truck-icon colour |
| navy-700 | #1D323A | secondary text, borders on dark |
| green-700 | #3E7231 | primary buttons, links, active states |
| green-500 | #5C9A35 | accents, "OK" status, charts |
| green-300 | #8CC152 | highlights, hover, the leaf tone |
| green-50 | #F4F9F1 | soft section backgrounds |
| white | #FFFFFF | page background |
| warning | #E0A100 | warning alerts |
| critical | #C62828 | critical alerts |

### Tyre status colours
| Status | Colour | Tailwind | CSS variable |
|---|---|---|---|
| OK | green-500 | `bg-status-ok` | `--status-ok` |
| Warning | warning | `bg-status-warning` | `--status-warning` |
| Critical | critical | `bg-status-critical` | `--status-critical` |
| Offline | grey #9CA3AF | `bg-status-offline` | `--status-offline` |

Never use colour alone to show status: always add a word or icon too (colour-blind users, bright sunlight on phones).

## Type
- **Montserrat** (600–800) for headings and the brand name. Brand name is always uppercase: **ECOSTREAM**, with "ECO" in green-700 and "STREAM" in navy-900, like the logo.
- **Inter** (400–600) for body text.
- Both load from Google Fonts in `frontend/index.html`.

## Tagline
**PREDICT · PROTECT · PERFORM**

## Feature pillars (icons from `lucide-react`)
| Pillar | Icon |
|---|---|
| Real-Time Tracking | `MapPin` |
| Fuel Efficiency | `Fuel` |
| Predictive Maintenance | `Wrench` (or `Cog`) |
| Safety Assurance | `ShieldCheck` |
| Smart Insights | `BarChart3` |

## Look and feel
- Clean, white background, navy text, green accents.
- No gradients everywhere, no neon, not dark-mode-first. Professional enough to show investors.
- **Mobile first.** Truck owners use phones. Every screen must work at **360 px** width.
- No fake customer logos, testimonials or made-up numbers.

## Logo files
- `frontend/public/logo.png`: full logo (emblem, wordmark, tagline, pillars). Use on big surfaces only.
- `frontend/public/logo-mark.png`: emblem only (cropped from the full logo). Use in headers and as the favicon.

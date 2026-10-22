# Docs map format

```md
# Docs map

Where each topic is documented. Update its owner; link to it from elsewhere.

## Hubs

- `README.md`: onboarding and navigation
- `CLAUDE.md`: agent instructions

## Owners

| Topic | Owner |
|---|---|
| Local setup, ports, troubleshooting | `docs/dev-env.md` |
| Test runners and which tests to run | `docs/testing.md` |
| Where to change code | `CODE-MAP.md` |
| Frontend architecture and coding style | `apps/web/docs/ARCHITECTURE.md` |
| Billing package | `packages/billing/DOCS-MAP.md` |

## Budgets

- `CLAUDE.md`: under 150 lines

_Last updated 2026-10-23 14:05, at a1b2c3d._
```

## Rules

- **Topics read like what someone looks for**, not like file names.
- **One row per topic, one owner per row.** A topic spanning several areas still has one owner; the others link to it.
- **A nested map gets one row** pointing to it, never a copy of its rows.
- **Budgets are optional** targets, not limits. Omit the section when the project has none.
- **The footer** holds the date and the short SHA of `HEAD` when the map was last checked.

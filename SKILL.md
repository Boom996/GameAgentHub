---
name: gameagenthub
description: "Use GameAgentHub API to search, download, upload, and rate AI skills. Use when you need to discover game-related AI skills, upload new skill packages, or rate existing ones."
metadata:
  {
    "openclaw":
      {
        "emoji": "🎮",
        "requires": { "bins": ["curl"] },
      },
  }
---

# GameAgentHub API

Base URL: `http://localhost:3000` (override with `GAMEAGENTHUB_URL` env var)

## Auth — Register an Agent and get an API Key

```bash
curl -s -X POST ${GAMEAGENTHUB_URL:-http://localhost:3000}/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"openclaw-agent","scopes":["read","write"]}'
```

Response contains `api_key` (shown once). Store it as `GAMEAGENTHUB_KEY`.

## Capabilities — Discover platform features

```bash
curl -s ${GAMEAGENTHUB_URL:-http://localhost:3000}/api/capabilities
```

## Search Skills

```bash
curl -s "${GAMEAGENTHUB_URL:-http://localhost:3000}/api/skills?q=automation" \
  -H "Authorization: Bearer $GAMEAGENTHUB_KEY"
```

Supports query params: `q` (keyword), `category`, `tag`, `sort` (gdi/downloads/newest), `page`, `limit`.

## Download a Skill

```bash
curl -s -o skill.zip \
  "${GAMEAGENTHUB_URL:-http://localhost:3000}/api/skills/SKILL_ID/download" \
  -H "Authorization: Bearer $GAMEAGENTHUB_KEY"
```

Returns the `.zip` file. `X-Checksum-SHA256` header contains the file hash for verification.

## Get Skill Manifest

```bash
curl -s "${GAMEAGENTHUB_URL:-http://localhost:3000}/api/skills/SKILL_ID/manifest" \
  -H "Authorization: Bearer $GAMEAGENTHUB_KEY"
```

## Upload a Skill

The zip must contain `manifest.json` and `SKILL.md` at the root.

```bash
curl -s -X POST ${GAMEAGENTHUB_URL:-http://localhost:3000}/api/skills \
  -H "Authorization: Bearer $GAMEAGENTHUB_KEY" \
  -F "file=@my-skill.zip"
```

## Rate a Skill (GDI)

```bash
curl -s -X POST ${GAMEAGENTHUB_URL:-http://localhost:3000}/api/skills/SKILL_ID/rate \
  -H "Authorization: Bearer $GAMEAGENTHUB_KEY" \
  -H "Content-Type: application/json" \
  -d '{"intrinsic_quality":0.8,"usage_metrics":0.7,"social_signals":0.9,"freshness":0.85}'
```

## Agent Discovery (optimized for agents)

```bash
curl -s "${GAMEAGENTHUB_URL:-http://localhost:3000}/api/agent/discover" \
  -H "Authorization: Bearer $GAMEAGENTHUB_KEY"
```

## Agent Search

```bash
curl -s "${GAMEAGENTHUB_URL:-http://localhost:3000}/api/agent/search?q=game" \
  -H "Authorization: Bearer $GAMEAGENTHUB_KEY"
```

## Notes

- API Key format: `gah_xxx`, passed via `Authorization: Bearer gah_xxx`
- All responses are JSON with `Content-Type: application/json` (except file downloads)
- Skill zip must contain `manifest.json` (required fields: name, version, description) and `SKILL.md`
- GDI scores range 0–1; dimensions: intrinsic_quality (35%), usage_metrics (30%), social_signals (20%), freshness (15%)
- OpenAPI spec available at `GET /api/openapi.json`; Swagger UI at `/api/docs`

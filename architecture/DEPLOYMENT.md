# Railway and GitHub Pages Deployment

## Railway API

Service root directory:

```text
backend
```

Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Healthcheck:

```text
/api/health
```

Public domain:

```text
https://global-supply-api-production.up.railway.app
```

Railway variables:

```text
ALLOWED_ORIGINS=https://jd-dev-king.github.io,https://ees-jdl.com,https://www.ees-jdl.com,http://localhost:8080,http://127.0.0.1:8080
NIXPACKS_PYTHON_VERSION=3.12
```

The backend is API-only. GitHub Pages serves the static frontend from `docs/`.

## GitHub Pages

Configure:

```text
Settings → Pages → Deploy from a branch → main → /docs
```

Public frontend:

```text
https://jd-dev-king.github.io/EES-Global-Supply-Nexus/
```

## Verification

```bash
curl https://global-supply-api-production.up.railway.app/api/health
```

CORS preflight:

```bash
curl -i -X OPTIONS \
  -H "Origin: https://jd-dev-king.github.io" \
  -H "Access-Control-Request-Method: GET" \
  https://global-supply-api-production.up.railway.app/api/health
```

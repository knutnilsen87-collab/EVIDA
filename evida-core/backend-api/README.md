# Backend API â€” Evida

FastAPI starter for enterprise control plane.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## Data boundary

Do not add endpoints that store case document content unless a separate privacy/security design is approved.
# Deprecated backend starter

Status: deprecated for enterprise/control-plane use.

Spring Boot (`../services/saksrom-api`) is the authoritative enterprise control plane. This FastAPI starter must not be used for tenant, policy, license, user, audit or provider-routing decisions.

Python remains allowed only as a local AI/document processing worker or prototype adapter until this folder is removed or moved to a legacy area.

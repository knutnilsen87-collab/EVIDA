# Backend API — Saksrom Pro

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

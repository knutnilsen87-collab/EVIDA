from fastapi import FastAPI

from app.routers import ai, audit, devices, diagnostics, health, policies, tenants

app = FastAPI(
    title="Saksrom Pro Backend API",
    version="0.1.0",
    description="Enterprise control plane for Saksrom Pro. No case document content in MVP.",
)

app.include_router(health.router)
app.include_router(tenants.router)
app.include_router(policies.router)
app.include_router(devices.router)
app.include_router(diagnostics.router)
app.include_router(ai.router)
app.include_router(audit.router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "Saksrom Pro Backend API",
        "status": "ok",
        "boundary": "control-plane-only-no-case-content-in-mvp",
    }

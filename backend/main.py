from fastapi import FastAPI
# Import your modules using relative or absolute positioning
from routers.alerts import list_router as alerts_list, inspect_router as alerts_inspect
from routers.allowlists import (
    list_router as allowlists_list,
    inspect_router as allowlists_inspect,
    check_router as allowlists_check,
)
from routers.decisions import list_router as decisions_list, check_router as decisions_check
from routers.machines import list_router as machines_list, inspect_router as machines_inspect
from routers.bouncers import list_router as bouncers_list, inspect_router as bouncers_inspect

# task-01 placeholder import: confirms the config module imports cleanly; wired in task-04.
from config import Config, load_config, resolve_cscli_path  # noqa: F401
import envelope

app = FastAPI(title="CrowdSec CLI Backend API", version="1.0.0")
# Include the routers into the core FastAPI application
app.include_router(alerts_list)
app.include_router(alerts_inspect)
app.include_router(allowlists_list)
app.include_router(allowlists_inspect)
app.include_router(allowlists_check)
app.include_router(bouncers_list)
app.include_router(bouncers_inspect)
app.include_router(decisions_list)
app.include_router(decisions_check)
app.include_router(machines_list)
app.include_router(machines_inspect)

@app.get("/api/v1/health")
async def health():
    return envelope.health_ok()

@app.get("/")
async def root():
    return {"message": "Welcome to the main entry point!"}

from fastapi import FastAPI
# Import your modules using relative or absolute positioning
from routers import alerts

app = FastAPI(title="CrowdSec CLI Backend API", version="1.0.0")

# Include the routers into the core FastAPI application
app.include_router(alerts.router)

@app.get("/")
async def root():
    return {"message": "Welcome to the main entry point!"}
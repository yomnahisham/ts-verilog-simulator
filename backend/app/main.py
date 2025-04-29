from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api import simulation
import os

app = FastAPI(
    title="Vivado-Make API",
    description="A modern web-based alternative to Vivado for Verilog simulation",
    version="1.0.0"
)

# Get CORS origins from environment variable or use default
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files if directory exists
static_dir = "static"
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include routers
app.include_router(simulation.router, prefix="/api/v1", tags=["simulation"])

@app.get("/")
async def root():
    return {"message": "Welcome to Vivado-Make API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

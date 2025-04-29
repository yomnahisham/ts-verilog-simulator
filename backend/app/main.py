from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api import simulation
import os
from mangum import Mangum
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get environment variables with defaults
PORT = int(os.getenv("PORT", "8001"))
HOST = os.getenv("HOST", "0.0.0.0")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

app = FastAPI(
    title="Vivado-Make API",
    description="A modern web-based alternative to Vivado for Verilog simulation",
    version="1.0.0",
    debug=DEBUG
)

# Get CORS origins from environment variable or use default
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://ts-verilog-simulator-frontend.vercel.app").split(",")

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
    return {"message": "Backend is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Handler for AWS Lambda
handler = Mangum(app)

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=DEBUG)

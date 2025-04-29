from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from .api import simulation
import os
import logging
import traceback
import sys
from mangum import Mangum
from dotenv import load_dotenv

# Configure logging to output to stdout/stderr for Vercel
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Log environment information
logger.info(f"Python version: {sys.version}")
logger.info(f"Current working directory: {os.getcwd()}")
logger.info(f"Directory contents: {os.listdir('.')}")

# Load environment variables
load_dotenv()

# Get environment variables with defaults
PORT = int(os.getenv("PORT", "8001"))
HOST = os.getenv("HOST", "0.0.0.0")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Log environment variables (excluding sensitive ones)
logger.info(f"PORT: {PORT}")
logger.info(f"HOST: {HOST}")
logger.info(f"DEBUG: {DEBUG}")

app = FastAPI(
    title="Vivado-Make API",
    description="A modern web-based alternative to Vivado for Verilog simulation",
    version="1.0.0",
    debug=DEBUG
)

# Get CORS origins from environment variable or use default
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://ts-verilog-simulator-frontend.vercel.app").split(",")
logger.info(f"CORS_ORIGINS: {CORS_ORIGINS}")

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
    logger.info(f"Mounting static directory: {static_dir}")
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
else:
    logger.warning(f"Static directory not found: {static_dir}")

# Include routers
try:
    app.include_router(simulation.router, prefix="/api/v1", tags=["simulation"])
    logger.info("Successfully included simulation router")
except Exception as e:
    logger.error(f"Error including simulation router: {str(e)}")
    logger.error(traceback.format_exc())

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"message": "Backend is running"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint called")
    return {"status": "healthy"}

@app.get("/test")
async def test_endpoint():
    """Simple test endpoint to verify the serverless function is working"""
    logger.info("Test endpoint called")
    try:
        # Check if iverilog is available
        import subprocess
        result = subprocess.run(["which", "iverilog"], capture_output=True, text=True)
        iverilog_path = result.stdout.strip()
        
        # Check Python environment
        python_version = sys.version
        current_dir = os.getcwd()
        dir_contents = os.listdir(current_dir)
        
        return {
            "status": "success",
            "message": "Test endpoint is working",
            "iverilog_available": bool(iverilog_path),
            "iverilog_path": iverilog_path,
            "python_version": python_version,
            "current_dir": current_dir,
            "dir_contents": dir_contents
        }
    except Exception as e:
        logger.error(f"Error in test endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": f"Error in test endpoint: {str(e)}",
            "traceback": traceback.format_exc()
        }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    logger.error(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# Handler for AWS Lambda
handler = Mangum(app)

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=DEBUG)

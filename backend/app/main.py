from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
import sys

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

app = FastAPI(
    title="Vivado-Make API",
    description="A modern web-based alternative to Vivado for Verilog simulation",
    version="1.0.0",
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
    return {
        "status": "success",
        "message": "Test endpoint is working",
        "python_version": sys.version,
        "current_dir": os.getcwd(),
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    import traceback
    logger.error(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )

# Handler for AWS Lambda
from mangum import Mangum
handler = Mangum(app)

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)

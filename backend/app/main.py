from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, validator
import os
import logging
import sys
import json
import time
from app.services.verilog_simulator import VerilogSimulator
from app.api import waveform, synthesis, flow, bitstream, implementation, programming

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
    title="OpenNet API",
    description="A modern web-based alternative to Vivado for Verilog simulation",
    version="1.0.0",
)

# Get CORS origins from environment variable or use default
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://open-net.vercel.app").split(",")
logger.info(f"CORS_ORIGINS: {CORS_ORIGINS}")

# Use a more permissive CORS configuration that's known to work with external hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now to test
    allow_credentials=False,  # Set to False when using wildcard origins
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Define models for the simulation API
class SimulationRequest(BaseModel):
    verilog_code: str
    testbench_code: str
    top_module: str
    top_testbench: str

    @validator('verilog_code', 'testbench_code')
    def validate_code(cls, v):
        if not v or not v.strip():
            raise ValueError("Code cannot be empty")
        return v.strip()

    @validator('top_module', 'top_testbench')
    def validate_module_names(cls, v):
        if not v or not v.strip():
            raise ValueError("Module name cannot be empty")
        if not v.strip().isidentifier():
            raise ValueError("Module name must be a valid Verilog identifier")
        return v.strip()

class SimulationResponse(BaseModel):
    success: bool
    output: str
    waveform_data: str

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"message": "Backend is running"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint called")
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "production")
    }

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

@app.post("/api/v1/simulate", response_model=SimulationResponse)
async def simulate_verilog(request: SimulationRequest):
    """Real simulation endpoint using Icarus Verilog"""
    logger.info(f"Simulation request received for {request.top_module}")
    try:
        # Create a simulator instance
        simulator = VerilogSimulator()
        
        # Run the simulation
        success, output, waveform_data = await simulator.compile_and_simulate(
            request.verilog_code,
            request.testbench_code,
            request.top_module,
            request.top_testbench
        )
        
        if not success:
            # Return error response with proper structure
            return SimulationResponse(
                success=False,
                output=output,
                waveform_data=""
            )
            
        return SimulationResponse(
            success=success,
            output=output,
            waveform_data=waveform_data
        )
    except Exception as e:
        logger.error(f"Error in simulation: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return SimulationResponse(
            success=False,
            output=f"Simulation error: {str(e)}",
            waveform_data=""
        )

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

# Mount all API routers
app.include_router(waveform.router, prefix="/api/v1/waveform", tags=["waveform"])
app.include_router(synthesis.router, prefix="/api/v1/synthesis", tags=["synthesis"])
app.include_router(flow.router, prefix="/api/v1/flow", tags=["flow"])
app.include_router(bitstream.router, prefix="/api/v1/bitstream", tags=["bitstream"])
app.include_router(implementation.router, prefix="/api/v1/implementation", tags=["implementation"])
app.include_router(programming.router, prefix="/api/v1/programming", tags=["programming"])

# Handler for AWS Lambda
from mangum import Mangum
handler = Mangum(app)

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)

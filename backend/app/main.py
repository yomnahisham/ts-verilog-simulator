from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator
import os
import logging
import sys
import json
import time

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
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://ts-verilog-simulator-frontend-git-main-yomna-othmans-projects.vercel.app").split(",")
logger.info(f"CORS_ORIGINS: {CORS_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
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

# Mock simulation function
def mock_simulate(verilog_code, testbench_code, top_module, top_testbench):
    """Mock simulation function that doesn't rely on external tools"""
    logger.info(f"Mock simulating {top_module} with testbench {top_testbench}")
    
    # Simulate processing time
    time.sleep(0.5)
    
    # Generate mock output
    output = f"Mock simulation of {top_module} with testbench {top_testbench}\n"
    output += "Simulation completed successfully\n"
    
    # Generate mock waveform data
    waveform_data = """
$date
    Date text. For example: June 26, 1989 10:05:41
$end
$version
    VCD generator version info
$end
$timescale
    1s
$end
$scope module top $end
$var wire 1 ! clk $end
$var wire 1 " rst $end
$var wire 8 # data $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
0!
0"
b00000000 #
$end
#100
1!
0"
b00000001 #
#200
0!
0"
b00000010 #
#300
1!
0"
b00000011 #
#400
0!
0"
b00000100 #
#500
1!
0"
b00000101 #
#600
0!
0"
b00000110 #
#700
1!
0"
b00000111 #
#800
0!
0"
b00001000 #
#900
1!
0"
b00001001 #
#1000
0!
0"
b00001010 #
"""
    
    return True, output, waveform_data

@app.get("/")
async def root():
    logger.info("Root endpoint called")
    return {"message": "Backend is running"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint called")
    return JSONResponse(
        content={
            "status": "healthy",
            "timestamp": time.time(),
            "version": "1.0.0",
            "environment": os.getenv("ENVIRONMENT", "production")
        },
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    )

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
    """Mock simulation endpoint that doesn't rely on external tools"""
    logger.info(f"Simulation request received for {request.top_module}")
    try:
        success, output, waveform_data = mock_simulate(
            request.verilog_code,
            request.testbench_code,
            request.top_module,
            request.top_testbench
        )
        
        if not success:
            raise HTTPException(status_code=400, detail=output)
            
        return SimulationResponse(
            success=success,
            output=output,
            waveform_data=waveform_data
        )
    except Exception as e:
        logger.error(f"Error in simulation: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

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

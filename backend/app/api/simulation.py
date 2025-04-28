from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from ..services.verilog_simulator import VerilogSimulator

router = APIRouter()

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

@router.post("/simulate", response_model=SimulationResponse)
async def simulate_verilog(request: SimulationRequest):
    simulator = VerilogSimulator()
    try:
        success, output, waveform_data = await simulator.compile_and_simulate(
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
    finally:
        simulator.cleanup() 
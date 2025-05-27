from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
from ..yosys.yosys_interface import YosysInterface

router = APIRouter()
yosys = YosysInterface()

class SynthesisRequest(BaseModel):
    verilog_code: str
    top_module: str
    optimization_level: Optional[int] = 2

class AnalysisRequest(BaseModel):
    verilog_code: str
    top_module: str

@router.post("/synthesize")
async def synthesize(request: SynthesisRequest) -> Dict:
    """
    Synthesize the given Verilog code.
    
    Args:
        request (SynthesisRequest): The synthesis request containing Verilog code and top module
        
    Returns:
        Dict: Synthesis results
    """
    try:
        result = yosys.synthesize(request.verilog_code, request.top_module)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize")
async def optimize(request: SynthesisRequest) -> Dict:
    """
    Optimize the given Verilog code.
    
    Args:
        request (SynthesisRequest): The optimization request containing Verilog code and top module
        
    Returns:
        Dict: Optimization results
    """
    try:
        result = yosys.optimize(
            request.verilog_code,
            request.top_module,
            request.optimization_level
        )
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
async def analyze(request: AnalysisRequest) -> Dict:
    """
    Analyze the given Verilog code.
    
    Args:
        request (AnalysisRequest): The analysis request containing Verilog code and top module
        
    Returns:
        Dict: Analysis results
    """
    try:
        result = yosys.analyze(request.verilog_code, request.top_module)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 
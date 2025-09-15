from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
import logging

from ..services.synthesis_service import SynthesisService

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize synthesis service
synthesis_service = SynthesisService()

# Request/Response models
class SynthesisRequest(BaseModel):
    verilog_code: str
    top_module: str
    device_family: str
    device_part: str
    constraints: Optional[str] = None

    @validator('verilog_code')
    def validate_verilog_code(cls, v):
        if not v or not v.strip():
            raise ValueError("Verilog code cannot be empty")
        return v.strip()

    @validator('top_module')
    def validate_top_module(cls, v):
        if not v or not v.strip():
            raise ValueError("Top module name cannot be empty")
        if not v.strip().isidentifier():
            raise ValueError("Top module name must be a valid Verilog identifier")
        return v.strip()

    @validator('device_family')
    def validate_device_family(cls, v):
        valid_families = ['xilinx_7series', 'lattice_ice40', 'lattice_ecp5']
        if v not in valid_families:
            raise ValueError(f"Device family must be one of: {valid_families}")
        return v

    @validator('device_part')
    def validate_device_part(cls, v):
        if not v or not v.strip():
            raise ValueError("Device part cannot be empty")
        return v.strip()

class SynthesisResponse(BaseModel):
    success: bool
    output: str
    results: Dict[str, Any]
    device_family: str
    device_part: str
    top_module: str

class DeviceListResponse(BaseModel):
    supported_devices: Dict[str, Dict[str, list]]

@router.get("/devices", response_model=DeviceListResponse)
async def get_supported_devices():
    """Get list of supported FPGA devices for synthesis"""
    try:
        devices = synthesis_service.get_supported_devices()
        return DeviceListResponse(supported_devices=devices)
    except Exception as e:
        logger.error(f"Error getting supported devices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get supported devices: {str(e)}")

@router.post("/synthesize", response_model=SynthesisResponse)
async def synthesize_design(request: SynthesisRequest):
    """Synthesize Verilog design using F4PGA"""
    try:
        logger.info(f"Synthesis request for {request.top_module} on {request.device_family}/{request.device_part}")
        
        # Validate device
        if not synthesis_service.validate_device(request.device_family, request.device_part):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported device: {request.device_family}/{request.device_part}"
            )
        
        # Run synthesis
        success, output, results = synthesis_service.synthesize_design(
            request.verilog_code,
            request.top_module,
            request.device_family,
            request.device_part,
            request.constraints
        )
        
        if not success:
            logger.error(f"Synthesis failed: {output}")
            raise HTTPException(status_code=400, detail=f"Synthesis failed: {output}")
        
        logger.info(f"Synthesis completed successfully for {request.top_module}")
        
        return SynthesisResponse(
            success=success,
            output=output,
            results=results,
            device_family=request.device_family,
            device_part=request.device_part,
            top_module=request.top_module
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Synthesis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Synthesis error: {str(e)}")

@router.post("/validate-device")
async def validate_device(device_family: str, device_part: str):
    """Validate if a device is supported for synthesis"""
    try:
        is_valid = synthesis_service.validate_device(device_family, device_part)
        return {
            "valid": is_valid,
            "device_family": device_family,
            "device_part": device_part
        }
    except Exception as e:
        logger.error(f"Device validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device validation error: {str(e)}")

@router.get("/health")
async def synthesis_health():
    """Health check for synthesis service"""
    try:
        # Test if synthesis service is working by checking supported devices
        devices = synthesis_service.get_supported_devices()
        return {
            "status": "healthy",
            "service": "synthesis",
            "supported_families": list(devices.keys())
        }
    except Exception as e:
        logger.error(f"Synthesis health check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Synthesis service unhealthy: {str(e)}")


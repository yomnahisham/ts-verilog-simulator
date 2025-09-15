from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
import logging

from ..services.implementation_service import ImplementationService

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize implementation service
implementation_service = ImplementationService()

# Request/Response models
class ImplementationRequest(BaseModel):
    netlist_json: str
    top_module: str
    device_family: str
    device_part: str
    constraints: Optional[str] = None

    @validator('netlist_json')
    def validate_netlist_json(cls, v):
        if not v or not v.strip():
            raise ValueError("Netlist JSON cannot be empty")
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

class ImplementationResponse(BaseModel):
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
    """Get list of supported FPGA devices for implementation"""
    try:
        devices = implementation_service.supported_devices
        return DeviceListResponse(supported_devices=devices)
    except Exception as e:
        logger.error(f"Error getting supported devices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get supported devices: {str(e)}")

@router.post("/implement", response_model=ImplementationResponse)
async def implement_design(request: ImplementationRequest):
    """Implement design using place & route"""
    try:
        logger.info(f"Implementation request for {request.top_module} on {request.device_family}/{request.device_part}")
        
        # Validate device
        if not implementation_service.validate_device(request.device_family, request.device_part):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported device: {request.device_family}/{request.device_part}"
            )
        
        # Run implementation
        success, output, results = implementation_service.implement_design(
            request.netlist_json,
            request.top_module,
            request.device_family,
            request.device_part,
            request.constraints
        )
        
        if not success:
            logger.error(f"Implementation failed: {output}")
            raise HTTPException(status_code=400, detail=f"Implementation failed: {output}")
        
        logger.info(f"Implementation completed successfully for {request.top_module}")
        
        return ImplementationResponse(
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
        logger.error(f"Implementation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Implementation error: {str(e)}")

@router.post("/validate-device")
async def validate_device(device_family: str, device_part: str):
    """Validate if a device is supported for implementation"""
    try:
        is_valid = implementation_service.validate_device(device_family, device_part)
        return {
            "valid": is_valid,
            "device_family": device_family,
            "device_part": device_part
        }
    except Exception as e:
        logger.error(f"Device validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device validation error: {str(e)}")

@router.get("/health")
async def implementation_health():
    """Health check for implementation service"""
    try:
        # Test if implementation service is working by checking supported devices
        devices = implementation_service.supported_devices
        return {
            "status": "healthy",
            "service": "implementation",
            "supported_families": list(devices.keys())
        }
    except Exception as e:
        logger.error(f"Implementation health check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Implementation service unhealthy: {str(e)}")


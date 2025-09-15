from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any, List
import logging
import base64

from ..services.programming_service import ProgrammingService

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize programming service
programming_service = ProgrammingService()

# Request/Response models
class ProgrammingRequest(BaseModel):
    bitstream_b64: str
    device_family: str
    device_part: str
    programming_mode: str = 'auto'
    verify: bool = True

    @validator('bitstream_b64')
    def validate_bitstream_b64(cls, v):
        if not v or not v.strip():
            raise ValueError("Bitstream data cannot be empty")
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

    @validator('programming_mode')
    def validate_programming_mode(cls, v):
        valid_modes = ['auto', 'jtag', 'spi', 'qspi']
        if v not in valid_modes:
            raise ValueError(f"Programming mode must be one of: {valid_modes}")
        return v

class ProgrammingResponse(BaseModel):
    success: bool
    output: str
    results: Dict[str, Any]
    device_family: str
    device_part: str

class DeviceDetectionResponse(BaseModel):
    success: bool
    output: str
    devices: List[Dict[str, Any]]

class ProgrammingStatusResponse(BaseModel):
    success: bool
    output: str
    status: Dict[str, Any]

class DeviceListResponse(BaseModel):
    supported_devices: Dict[str, Dict[str, list]]

class ProgrammingModesResponse(BaseModel):
    device_family: str
    supported_modes: List[str]

@router.get("/devices", response_model=DeviceListResponse)
async def get_supported_devices():
    """Get list of supported FPGA devices for programming"""
    try:
        devices = programming_service.supported_devices
        return DeviceListResponse(supported_devices=devices)
    except Exception as e:
        logger.error(f"Error getting supported devices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get supported devices: {str(e)}")

@router.get("/detect", response_model=DeviceDetectionResponse)
async def detect_fpga_devices():
    """Detect connected FPGA devices"""
    try:
        logger.info("Detecting FPGA devices")
        
        success, output, devices = programming_service.detect_fpga_devices()
        
        return DeviceDetectionResponse(
            success=success,
            output=output,
            devices=devices
        )
        
    except Exception as e:
        logger.error(f"Device detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device detection error: {str(e)}")

@router.post("/program", response_model=ProgrammingResponse)
async def program_fpga(request: ProgrammingRequest):
    """Program FPGA with bitstream"""
    try:
        logger.info(f"Programming request for {request.device_family}/{request.device_part}")
        
        # Decode base64 bitstream
        try:
            bitstream_data = base64.b64decode(request.bitstream_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 bitstream data: {str(e)}")
        
        # Validate device
        if not programming_service.validate_device(request.device_family, request.device_part):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported device: {request.device_family}/{request.device_part}"
            )
        
        # Run programming
        success, output, results = programming_service.program_fpga(
            bitstream_data,
            request.device_family,
            request.device_part,
            request.programming_mode,
            request.verify
        )
        
        if not success:
            logger.error(f"Programming failed: {output}")
            raise HTTPException(status_code=400, detail=f"Programming failed: {output}")
        
        logger.info(f"Programming completed successfully for {request.device_family}/{request.device_part}")
        
        return ProgrammingResponse(
            success=success,
            output=output,
            results=results,
            device_family=request.device_family,
            device_part=request.device_part
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Programming error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Programming error: {str(e)}")

@router.get("/status", response_model=ProgrammingStatusResponse)
async def get_programming_status():
    """Get current programming status"""
    try:
        success, output, status = programming_service.get_programming_status()
        
        return ProgrammingStatusResponse(
            success=success,
            output=output,
            status=status
        )
        
    except Exception as e:
        logger.error(f"Programming status error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Programming status error: {str(e)}")

@router.get("/modes/{device_family}", response_model=ProgrammingModesResponse)
async def get_supported_programming_modes(device_family: str):
    """Get supported programming modes for device family"""
    try:
        modes = programming_service.get_supported_programming_modes(device_family)
        
        return ProgrammingModesResponse(
            device_family=device_family,
            supported_modes=modes
        )
        
    except Exception as e:
        logger.error(f"Programming modes error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Programming modes error: {str(e)}")

@router.post("/validate-device")
async def validate_device(device_family: str, device_part: str):
    """Validate if a device is supported for programming"""
    try:
        is_valid = programming_service.validate_device(device_family, device_part)
        return {
            "valid": is_valid,
            "device_family": device_family,
            "device_part": device_part
        }
    except Exception as e:
        logger.error(f"Device validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device validation error: {str(e)}")

@router.get("/health")
async def programming_health():
    """Health check for programming service"""
    try:
        # Test if programming service is working by checking status
        success, output, status = programming_service.get_programming_status()
        
        return {
            "status": "healthy" if success else "unhealthy",
            "service": "programming",
            "openfpgaloader_available": status.get('openfpgaloader_available', False),
            "version": status.get('version', 'unknown')
        }
    except Exception as e:
        logger.error(f"Programming health check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Programming service unhealthy: {str(e)}")


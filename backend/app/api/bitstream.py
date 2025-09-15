from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any
import logging
import base64

from ..services.bitstream_service import BitstreamService

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize bitstream service
bitstream_service = BitstreamService()

# Request/Response models
class BitstreamRequest(BaseModel):
    implementation_data: str
    top_module: str
    device_family: str
    device_part: str
    data_format: str = 'fasm'

    @validator('implementation_data')
    def validate_implementation_data(cls, v):
        if not v or not v.strip():
            raise ValueError("Implementation data cannot be empty")
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

    @validator('data_format')
    def validate_data_format(cls, v):
        valid_formats = ['fasm', 'asc', 'config']
        if v not in valid_formats:
            raise ValueError(f"Data format must be one of: {valid_formats}")
        return v

class BitstreamResponse(BaseModel):
    success: bool
    output: str
    results: Dict[str, Any]
    device_family: str
    device_part: str
    top_module: str

class BitstreamInfoResponse(BaseModel):
    size_bytes: int
    size_kb: float
    size_mb: float
    device_family: str
    format: str
    checksum: str

class DeviceListResponse(BaseModel):
    supported_devices: Dict[str, Dict[str, list]]

@router.get("/devices", response_model=DeviceListResponse)
async def get_supported_devices():
    """Get list of supported FPGA devices for bitstream generation"""
    try:
        devices = bitstream_service.supported_devices
        return DeviceListResponse(supported_devices=devices)
    except Exception as e:
        logger.error(f"Error getting supported devices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get supported devices: {str(e)}")

@router.post("/generate", response_model=BitstreamResponse)
async def generate_bitstream(request: BitstreamRequest):
    """Generate bitstream from implementation data"""
    try:
        logger.info(f"Bitstream generation request for {request.top_module} on {request.device_family}/{request.device_part}")
        
        # Validate device
        if not bitstream_service.validate_device(request.device_family, request.device_part):
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported device: {request.device_family}/{request.device_part}"
            )
        
        # Run bitstream generation
        success, output, results = bitstream_service.generate_bitstream(
            request.implementation_data,
            request.top_module,
            request.device_family,
            request.device_part,
            request.data_format
        )
        
        if not success:
            logger.error(f"Bitstream generation failed: {output}")
            raise HTTPException(status_code=400, detail=f"Bitstream generation failed: {output}")
        
        # Convert bitstream to base64 for JSON response
        if 'bitstream_file' in results and results['bitstream_file']:
            results['bitstream_file_b64'] = base64.b64encode(results['bitstream_file']).decode('utf-8')
            # Remove binary data from results
            del results['bitstream_file']
        
        logger.info(f"Bitstream generation completed successfully for {request.top_module}")
        
        return BitstreamResponse(
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
        logger.error(f"Bitstream generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bitstream generation error: {str(e)}")

@router.post("/validate")
async def validate_bitstream(bitstream_b64: str, device_family: str):
    """Validate bitstream format and content"""
    try:
        # Decode base64 bitstream
        try:
            bitstream_data = base64.b64decode(bitstream_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 bitstream data: {str(e)}")
        
        # Validate bitstream
        is_valid, message = bitstream_service.validate_bitstream(bitstream_data, device_family)
        
        return {
            "valid": is_valid,
            "message": message,
            "device_family": device_family,
            "size_bytes": len(bitstream_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bitstream validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bitstream validation error: {str(e)}")

@router.post("/info")
async def get_bitstream_info(bitstream_b64: str, device_family: str):
    """Get information about the bitstream"""
    try:
        # Decode base64 bitstream
        try:
            bitstream_data = base64.b64decode(bitstream_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 bitstream data: {str(e)}")
        
        # Get bitstream info
        info = bitstream_service.get_bitstream_info(bitstream_data, device_family)
        
        return BitstreamInfoResponse(**info)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bitstream info error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bitstream info error: {str(e)}")

@router.post("/validate-device")
async def validate_device(device_family: str, device_part: str):
    """Validate if a device is supported for bitstream generation"""
    try:
        is_valid = bitstream_service.validate_device(device_family, device_part)
        return {
            "valid": is_valid,
            "device_family": device_family,
            "device_part": device_part
        }
    except Exception as e:
        logger.error(f"Device validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device validation error: {str(e)}")

@router.get("/health")
async def bitstream_health():
    """Health check for bitstream service"""
    try:
        # Test if bitstream service is working by checking supported devices
        devices = bitstream_service.supported_devices
        return {
            "status": "healthy",
            "service": "bitstream",
            "supported_families": list(devices.keys())
        }
    except Exception as e:
        logger.error(f"Bitstream health check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bitstream service unhealthy: {str(e)}")


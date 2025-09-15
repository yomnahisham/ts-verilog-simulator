from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, Dict, Any, List
import logging

from ..services.fpga_flow_service import FPGAFlowService

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize FPGA flow service
fpga_flow_service = FPGAFlowService()

# Request/Response models
class CompleteFlowRequest(BaseModel):
    verilog_code: str
    top_module: str
    device_family: str
    device_part: str
    constraints: Optional[str] = None
    stages: Optional[List[str]] = None
    program_fpga: bool = False

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

    @validator('stages')
    def validate_stages(cls, v):
        if v is not None:
            valid_stages = ['synthesis', 'implementation', 'bitstream_generation', 'programming']
            for stage in v:
                if stage not in valid_stages:
                    raise ValueError(f"Invalid stage: {stage}. Must be one of: {valid_stages}")
        return v

class SynthesisOnlyRequest(BaseModel):
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

class ImplementationOnlyRequest(BaseModel):
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

class BitstreamOnlyRequest(BaseModel):
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

class FlowResponse(BaseModel):
    success: bool
    output: str
    results: Dict[str, Any]

class DeviceDetectionResponse(BaseModel):
    success: bool
    output: str
    devices: List[Dict[str, Any]]

class SupportedDevicesResponse(BaseModel):
    synthesis: Dict[str, Dict[str, list]]
    implementation: Dict[str, Dict[str, list]]
    bitstream: Dict[str, Dict[str, list]]
    programming: Dict[str, Dict[str, list]]

@router.get("/devices", response_model=SupportedDevicesResponse)
async def get_supported_devices():
    """Get list of supported FPGA devices for all services"""
    try:
        devices = fpga_flow_service.get_supported_devices()
        return SupportedDevicesResponse(**devices)
    except Exception as e:
        logger.error(f"Error getting supported devices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get supported devices: {str(e)}")

@router.get("/detect", response_model=DeviceDetectionResponse)
async def detect_fpga_devices():
    """Detect connected FPGA devices"""
    try:
        logger.info("Detecting FPGA devices")
        
        success, output, devices = fpga_flow_service.detect_fpga_devices()
        
        return DeviceDetectionResponse(
            success=success,
            output=output,
            devices=devices
        )
        
    except Exception as e:
        logger.error(f"Device detection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Device detection error: {str(e)}")

@router.post("/complete", response_model=FlowResponse)
async def run_complete_flow(request: CompleteFlowRequest):
    """Run complete FPGA design flow"""
    try:
        logger.info(f"Complete flow request for {request.top_module} on {request.device_family}/{request.device_part}")
        
        # Run complete flow
        success, output, results = fpga_flow_service.run_complete_flow(
            request.verilog_code,
            request.top_module,
            request.device_family,
            request.device_part,
            request.constraints,
            request.stages,
            request.program_fpga
        )
        
        if not success:
            logger.error(f"Complete flow failed: {output}")
            raise HTTPException(status_code=400, detail=f"Complete flow failed: {output}")
        
        logger.info(f"Complete flow completed successfully for {request.top_module}")
        
        return FlowResponse(
            success=success,
            output=output,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Complete flow error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Complete flow error: {str(e)}")

@router.post("/synthesis", response_model=FlowResponse)
async def run_synthesis_only(request: SynthesisOnlyRequest):
    """Run synthesis stage only"""
    try:
        logger.info(f"Synthesis only request for {request.top_module} on {request.device_family}/{request.device_part}")
        
        # Run synthesis only
        success, output, results = fpga_flow_service.run_synthesis_only(
            request.verilog_code,
            request.top_module,
            request.device_family,
            request.device_part,
            request.constraints
        )
        
        if not success:
            logger.error(f"Synthesis only failed: {output}")
            raise HTTPException(status_code=400, detail=f"Synthesis only failed: {output}")
        
        logger.info(f"Synthesis only completed successfully for {request.top_module}")
        
        return FlowResponse(
            success=success,
            output=output,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Synthesis only error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Synthesis only error: {str(e)}")

@router.post("/implementation", response_model=FlowResponse)
async def run_implementation_only(request: ImplementationOnlyRequest):
    """Run implementation stage only"""
    try:
        logger.info(f"Implementation only request for {request.top_module} on {request.device_family}/{request.device_part}")
        
        # Run implementation only
        success, output, results = fpga_flow_service.run_implementation_only(
            request.netlist_json,
            request.top_module,
            request.device_family,
            request.device_part,
            request.constraints
        )
        
        if not success:
            logger.error(f"Implementation only failed: {output}")
            raise HTTPException(status_code=400, detail=f"Implementation only failed: {output}")
        
        logger.info(f"Implementation only completed successfully for {request.top_module}")
        
        return FlowResponse(
            success=success,
            output=output,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Implementation only error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Implementation only error: {str(e)}")

@router.post("/bitstream", response_model=FlowResponse)
async def run_bitstream_only(request: BitstreamOnlyRequest):
    """Run bitstream generation stage only"""
    try:
        logger.info(f"Bitstream only request for {request.top_module} on {request.device_family}/{request.device_part}")
        
        # Run bitstream only
        success, output, results = fpga_flow_service.run_bitstream_only(
            request.implementation_data,
            request.top_module,
            request.device_family,
            request.device_part,
            request.data_format
        )
        
        if not success:
            logger.error(f"Bitstream only failed: {output}")
            raise HTTPException(status_code=400, detail=f"Bitstream only failed: {output}")
        
        logger.info(f"Bitstream only completed successfully for {request.top_module}")
        
        return FlowResponse(
            success=success,
            output=output,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bitstream only error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bitstream only error: {str(e)}")

@router.get("/health")
async def flow_health():
    """Health check for FPGA flow service"""
    try:
        # Test if flow service is working by checking supported devices
        devices = fpga_flow_service.get_supported_devices()
        
        return {
            "status": "healthy",
            "service": "fpga_flow",
            "supported_families": {
                "synthesis": list(devices['synthesis'].keys()),
                "implementation": list(devices['implementation'].keys()),
                "bitstream": list(devices['bitstream'].keys()),
                "programming": list(devices['programming'].keys())
            }
        }
    except Exception as e:
        logger.error(f"Flow health check error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Flow service unhealthy: {str(e)}")


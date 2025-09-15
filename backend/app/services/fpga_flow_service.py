import os
import tempfile
import logging
from typing import Dict, List, Tuple, Optional
from pathlib import Path

from .synthesis_service import SynthesisService
from .implementation_service import ImplementationService
from .bitstream_service import BitstreamService
from .programming_service import ProgrammingService

logger = logging.getLogger(__name__)

class FPGAFlowService:
    """Service for complete FPGA design flow orchestration"""
    
    def __init__(self):
        self.synthesis_service = SynthesisService()
        self.implementation_service = ImplementationService()
        self.bitstream_service = BitstreamService()
        self.programming_service = ProgrammingService()
        
        self.flow_stages = [
            'synthesis',
            'implementation', 
            'bitstream_generation',
            'programming'
        ]
    
    def run_complete_flow(self, 
                         verilog_code: str,
                         top_module: str,
                         device_family: str,
                         device_part: str,
                         constraints: Optional[str] = None,
                         stages: Optional[List[str]] = None,
                         program_fpga: bool = False) -> Tuple[bool, str, Dict]:
        """
        Run complete FPGA design flow
        
        Args:
            verilog_code: Verilog source code
            top_module: Top-level module name
            device_family: FPGA device family
            device_part: Specific device part
            constraints: Optional constraint file content
            stages: List of stages to run (default: all)
            program_fpga: Whether to program the FPGA
            
        Returns:
            Tuple of (success, output, results_dict)
        """
        try:
            if stages is None:
                stages = self.flow_stages.copy()
            
            if program_fpga and 'programming' not in stages:
                stages.append('programming')
            
            # Validate device
            if not self._validate_device(device_family, device_part):
                return False, f"Unsupported device: {device_family}/{device_part}", {}
            
            results = {
                'stages_completed': [],
                'stages_failed': [],
                'overall_success': False,
                'device_family': device_family,
                'device_part': device_part,
                'top_module': top_module,
                'stage_results': {}
            }
            
            # Stage 1: Synthesis
            if 'synthesis' in stages:
                logger.info("Starting synthesis stage")
                success, output, synth_results = self.synthesis_service.synthesize_design(
                    verilog_code, top_module, device_family, device_part, constraints
                )
                
                results['stage_results']['synthesis'] = {
                    'success': success,
                    'output': output,
                    'results': synth_results
                }
                
                if success:
                    results['stages_completed'].append('synthesis')
                    logger.info("Synthesis completed successfully")
                else:
                    results['stages_failed'].append('synthesis')
                    logger.error(f"Synthesis failed: {output}")
                    return False, f"Synthesis failed: {output}", results
            
            # Stage 2: Implementation
            if 'implementation' in stages:
                logger.info("Starting implementation stage")
                
                # Get netlist from synthesis
                if 'synthesis' not in results['stage_results']:
                    return False, "Implementation requires synthesis to be completed first", results
                
                netlist_json = results['stage_results']['synthesis']['results'].get('netlist_json')
                if not netlist_json:
                    return False, "No netlist available from synthesis", results
                
                success, output, impl_results = self.implementation_service.implement_design(
                    netlist_json, top_module, device_family, device_part, constraints
                )
                
                results['stage_results']['implementation'] = {
                    'success': success,
                    'output': output,
                    'results': impl_results
                }
                
                if success:
                    results['stages_completed'].append('implementation')
                    logger.info("Implementation completed successfully")
                else:
                    results['stages_failed'].append('implementation')
                    logger.error(f"Implementation failed: {output}")
                    return False, f"Implementation failed: {output}", results
            
            # Stage 3: Bitstream Generation
            if 'bitstream_generation' in stages:
                logger.info("Starting bitstream generation stage")
                
                # Get implementation data
                if 'implementation' not in results['stage_results']:
                    return False, "Bitstream generation requires implementation to be completed first", results
                
                impl_data = self._get_implementation_data(results['stage_results']['implementation']['results'], device_family)
                if not impl_data:
                    return False, "No implementation data available", results
                
                data_format = self._get_data_format(device_family)
                success, output, bitstream_results = self.bitstream_service.generate_bitstream(
                    impl_data, top_module, device_family, device_part, data_format
                )
                
                results['stage_results']['bitstream_generation'] = {
                    'success': success,
                    'output': output,
                    'results': bitstream_results
                }
                
                if success:
                    results['stages_completed'].append('bitstream_generation')
                    logger.info("Bitstream generation completed successfully")
                else:
                    results['stages_failed'].append('bitstream_generation')
                    logger.error(f"Bitstream generation failed: {output}")
                    return False, f"Bitstream generation failed: {output}", results
            
            # Stage 4: Programming
            if 'programming' in stages:
                logger.info("Starting programming stage")
                
                # Get bitstream data
                if 'bitstream_generation' not in results['stage_results']:
                    return False, "Programming requires bitstream generation to be completed first", results
                
                bitstream_data = results['stage_results']['bitstream_generation']['results'].get('bitstream_file')
                if not bitstream_data:
                    return False, "No bitstream data available", results
                
                success, output, prog_results = self.programming_service.program_fpga(
                    bitstream_data, device_family, device_part, verify=True
                )
                
                results['stage_results']['programming'] = {
                    'success': success,
                    'output': output,
                    'results': prog_results
                }
                
                if success:
                    results['stages_completed'].append('programming')
                    logger.info("Programming completed successfully")
                else:
                    results['stages_failed'].append('programming')
                    logger.error(f"Programming failed: {output}")
                    return False, f"Programming failed: {output}", results
            
            # Determine overall success
            results['overall_success'] = len(results['stages_failed']) == 0
            
            # Generate summary output
            summary_output = self._generate_flow_summary(results)
            
            return results['overall_success'], summary_output, results
            
        except Exception as e:
            logger.error(f"FPGA flow error: {str(e)}")
            return False, f"FPGA flow failed: {str(e)}", {}
    
    def run_synthesis_only(self, 
                          verilog_code: str,
                          top_module: str,
                          device_family: str,
                          device_part: str,
                          constraints: Optional[str] = None) -> Tuple[bool, str, Dict]:
        """Run synthesis stage only"""
        return self.run_complete_flow(
            verilog_code, top_module, device_family, device_part, 
            constraints, stages=['synthesis']
        )
    
    def run_implementation_only(self, 
                               netlist_json: str,
                               top_module: str,
                               device_family: str,
                               device_part: str,
                               constraints: Optional[str] = None) -> Tuple[bool, str, Dict]:
        """Run implementation stage only"""
        try:
            success, output, results = self.implementation_service.implement_design(
                netlist_json, top_module, device_family, device_part, constraints
            )
            
            flow_results = {
                'stages_completed': ['implementation'] if success else [],
                'stages_failed': [] if success else ['implementation'],
                'overall_success': success,
                'device_family': device_family,
                'device_part': device_part,
                'top_module': top_module,
                'stage_results': {
                    'implementation': {
                        'success': success,
                        'output': output,
                        'results': results
                    }
                }
            }
            
            return success, output, flow_results
            
        except Exception as e:
            logger.error(f"Implementation only error: {str(e)}")
            return False, f"Implementation failed: {str(e)}", {}
    
    def run_bitstream_only(self, 
                          implementation_data: str,
                          top_module: str,
                          device_family: str,
                          device_part: str,
                          data_format: str = 'fasm') -> Tuple[bool, str, Dict]:
        """Run bitstream generation stage only"""
        try:
            success, output, results = self.bitstream_service.generate_bitstream(
                implementation_data, top_module, device_family, device_part, data_format
            )
            
            flow_results = {
                'stages_completed': ['bitstream_generation'] if success else [],
                'stages_failed': [] if success else ['bitstream_generation'],
                'overall_success': success,
                'device_family': device_family,
                'device_part': device_part,
                'top_module': top_module,
                'stage_results': {
                    'bitstream_generation': {
                        'success': success,
                        'output': output,
                        'results': results
                    }
                }
            }
            
            return success, output, flow_results
            
        except Exception as e:
            logger.error(f"Bitstream generation only error: {str(e)}")
            return False, f"Bitstream generation failed: {str(e)}", {}
    
    def detect_fpga_devices(self) -> Tuple[bool, str, List[Dict]]:
        """Detect connected FPGA devices"""
        return self.programming_service.detect_fpga_devices()
    
    def get_supported_devices(self) -> Dict:
        """Get all supported devices from all services"""
        return {
            'synthesis': self.synthesis_service.get_supported_devices(),
            'implementation': self.implementation_service.supported_devices,
            'bitstream': self.bitstream_service.supported_devices,
            'programming': self.programming_service.supported_devices
        }
    
    def _validate_device(self, device_family: str, device_part: str) -> bool:
        """Validate device across all services"""
        return (self.synthesis_service.validate_device(device_family, device_part) and
                self.implementation_service.validate_device(device_family, device_part) and
                self.bitstream_service.validate_device(device_family, device_part) and
                self.programming_service.validate_device(device_family, device_part))
    
    def _get_implementation_data(self, impl_results: Dict, device_family: str) -> Optional[str]:
        """Get implementation data based on device family"""
        if device_family == 'xilinx_7series':
            return impl_results.get('fasm_file')
        elif device_family == 'lattice_ice40':
            return impl_results.get('asc_file')
        elif device_family == 'lattice_ecp5':
            return impl_results.get('config_file')
        return None
    
    def _get_data_format(self, device_family: str) -> str:
        """Get data format based on device family"""
        if device_family == 'xilinx_7series':
            return 'fasm'
        elif device_family == 'lattice_ice40':
            return 'asc'
        elif device_family == 'lattice_ecp5':
            return 'config'
        return 'unknown'
    
    def _generate_flow_summary(self, results: Dict) -> str:
        """Generate summary of the flow execution"""
        summary = []
        summary.append("=== FPGA Design Flow Summary ===")
        summary.append(f"Device: {results['device_family']}/{results['device_part']}")
        summary.append(f"Top Module: {results['top_module']}")
        summary.append(f"Overall Success: {results['overall_success']}")
        summary.append("")
        
        summary.append("Stages Completed:")
        for stage in results['stages_completed']:
            summary.append(f"  ✓ {stage}")
        
        if results['stages_failed']:
            summary.append("Stages Failed:")
            for stage in results['stages_failed']:
                summary.append(f"  ✗ {stage}")
        
        summary.append("")
        
        # Add stage-specific summaries
        for stage, stage_result in results['stage_results'].items():
            if stage_result['success']:
                summary.append(f"{stage.upper()} Results:")
                if stage == 'synthesis' and 'statistics' in stage_result['results']:
                    stats = stage_result['results']['statistics']
                    summary.append(f"  LUTs: {stats.get('lut_count', 0)}")
                    summary.append(f"  FFs: {stats.get('ff_count', 0)}")
                    summary.append(f"  Total Cells: {stats.get('total_cells', 0)}")
                elif stage == 'implementation' and 'utilization_report' in stage_result['results']:
                    util = stage_result['results']['utilization_report']
                    summary.append(f"  LUT Usage: {util.get('lut_percentage', 0):.1f}%")
                    summary.append(f"  FF Usage: {util.get('ff_percentage', 0):.1f}%")
                elif stage == 'bitstream_generation' and 'bitstream_size' in stage_result['results']:
                    size = stage_result['results']['bitstream_size']
                    summary.append(f"  Bitstream Size: {size} bytes ({size/1024:.1f} KB)")
                elif stage == 'programming' and 'programming_time' in stage_result['results']:
                    time = stage_result['results']['programming_time']
                    summary.append(f"  Programming Time: {time:.2f} seconds")
                summary.append("")
        
        return "\n".join(summary)


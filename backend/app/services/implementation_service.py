import os
import tempfile
import subprocess
import json
import logging
from typing import Dict, List, Tuple, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class ImplementationService:
    """Service for FPGA implementation (place & route) using F4PGA toolchain"""
    
    def __init__(self):
        self.supported_devices = {
            'xilinx_7series': {
                'artix7': ['xc7a35t', 'xc7a50t', 'xc7a100t'],
                'kintex7': ['xc7k70t', 'xc7k160t'],
                'virtex7': ['xc7vx330t', 'xc7vx485t']
            },
            'lattice_ice40': {
                'ice40': ['hx8k', 'lp8k', 'up5k']
            },
            'lattice_ecp5': {
                'ecp5': ['lfe5u-25f', 'lfe5u-45f', 'lfe5u-85f']
            }
        }
    
    def implement_design(self, 
                        netlist_json: str,
                        top_module: str, 
                        device_family: str, 
                        device_part: str,
                        constraints: Optional[str] = None) -> Tuple[bool, str, Dict]:
        """
        Implement design using place & route
        
        Args:
            netlist_json: JSON netlist from synthesis
            top_module: Top-level module name
            device_family: FPGA device family
            device_part: Specific device part
            constraints: Optional constraint file content
            
        Returns:
            Tuple of (success, output, results_dict)
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Write netlist JSON
                netlist_file = temp_path / f"{top_module}_netlist.json"
                netlist_file.write_text(netlist_json)
                
                # Write constraints if provided
                constraints_file = None
                if constraints:
                    constraints_file = temp_path / f"{top_module}.xdc"
                    constraints_file.write_text(constraints)
                
                # Run implementation based on device family
                if device_family == 'xilinx_7series':
                    success, output, results = self._implement_xilinx_7series(
                        temp_path, top_module, device_part, constraints_file
                    )
                elif device_family == 'lattice_ice40':
                    success, output, results = self._implement_lattice_ice40(
                        temp_path, top_module, device_part, constraints_file
                    )
                elif device_family == 'lattice_ecp5':
                    success, output, results = self._implement_lattice_ecp5(
                        temp_path, top_module, device_part, constraints_file
                    )
                else:
                    return False, f"Unsupported device family: {device_family}", {}
                
                return success, output, results
                
        except Exception as e:
            logger.error(f"Implementation error: {str(e)}")
            return False, f"Implementation failed: {str(e)}", {}
    
    def _implement_xilinx_7series(self, 
                                 temp_path: Path, 
                                 top_module: str, 
                                 device_part: str,
                                 constraints_file: Optional[Path]) -> Tuple[bool, str, Dict]:
        """Implement for Xilinx 7-Series using nextpnr-xilinx"""
        try:
            # Create implementation script
            script_content = f"""
# F4PGA implementation script for Xilinx 7-Series
read_json {top_module}_netlist.json
"""
            
            # Note: Yosys doesn't support XDC files directly
            # Constraints are handled by nextpnr-xilinx later
            
            # Check if F4PGA is available, otherwise use generic implementation
            f4pga_available = os.path.exists('/opt/f4pga-arch-defs/xilinx/xc7/techmap/cells_sim.v')
            
            if f4pga_available:
                script_content += f"""
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
dfflibmap -liberty /opt/f4pga-arch-defs/xilinx/xc7/techmap/cells_sim.v
abc -liberty /opt/f4pga-arch-defs/xilinx/xc7/techmap/cells_sim.v
clean
write_json {top_module}_impl.json
write_verilog {top_module}_impl.v
stat
"""
            else:
                # Generic implementation for local testing
                script_content += f"""
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
clean
write_json {top_module}_impl.json
write_verilog {top_module}_impl.v
stat
"""
            
            script_file = temp_path / "implementation.ys"
            script_file.write_text(script_content)
            
            # Run Yosys for preparation
            cmd = ["yosys", "-s", str(script_file)]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            if result.returncode != 0:
                return False, result.stdout + result.stderr, {}
            
            # Run nextpnr-xilinx for place & route (if available)
            if f4pga_available and os.path.exists(f"/opt/f4pga-arch-defs/xilinx/xc7/chipdb/{device_part}.bin"):
                nextpnr_cmd = [
                    "nextpnr-xilinx",
                    "--chipdb", f"/opt/f4pga-arch-defs/xilinx/xc7/chipdb/{device_part}.bin",
                    "--json", f"{top_module}_impl.json",
                    "--write", f"{top_module}_routed.json",
                    "--fasm", f"{top_module}.fasm"
                ]
                
                if constraints_file:
                    nextpnr_cmd.extend(["--xdc", f"{top_module}.xdc"])
                
                nextpnr_result = subprocess.run(nextpnr_cmd, capture_output=True, text=True, cwd=temp_path)
            else:
                # For local testing, create mock implementation results
                nextpnr_result = subprocess.CompletedProcess(
                    args=[], returncode=0, stdout="Mock implementation completed", stderr=""
                )
                
                # Create mock files for testing
                mock_routed_json = temp_path / f"{top_module}_routed.json"
                mock_fasm = temp_path / f"{top_module}.fasm"
                
                # Copy the impl.json to routed.json as a mock
                impl_json = temp_path / f"{top_module}_impl.json"
                if impl_json.exists():
                    mock_routed_json.write_text(impl_json.read_text())
                
                # Create a mock FASM file
                mock_fasm.write_text(f"# Mock FASM file for {top_module}\n# This is a placeholder for local testing\n")
            
            # Parse results
            results = {
                'routed_json': None,
                'fasm_file': None,
                'timing_report': None,
                'utilization_report': None,
                'device_part': device_part,
                'device_family': 'xilinx_7series'
            }
            
            # Read generated files
            routed_json_file = temp_path / f"{top_module}_routed.json"
            fasm_file = temp_path / f"{top_module}.fasm"
            
            if routed_json_file.exists():
                results['routed_json'] = routed_json_file.read_text()
            
            if fasm_file.exists():
                results['fasm_file'] = fasm_file.read_text()
            
            # Parse timing and utilization from output
            results['timing_report'] = self._parse_timing_report(nextpnr_result.stdout)
            results['utilization_report'] = self._parse_utilization_report(nextpnr_result.stdout)
            
            success = nextpnr_result.returncode == 0
            output = nextpnr_result.stdout + nextpnr_result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Xilinx 7-Series implementation error: {str(e)}")
            return False, f"Xilinx 7-Series implementation failed: {str(e)}", {}
    
    def _implement_lattice_ice40(self, 
                               temp_path: Path, 
                               top_module: str, 
                               device_part: str,
                               constraints_file: Optional[Path]) -> Tuple[bool, str, Dict]:
        """Implement for Lattice iCE40 using nextpnr-ice40"""
        try:
            # Create implementation script
            script_content = f"""
# F4PGA implementation script for Lattice iCE40
read_json {top_module}_netlist.json
"""
            
            if constraints_file:
                script_content += f"read_pcf {top_module}.pcf\n"
            
            script_content += f"""
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
dfflibmap -liberty /opt/f4pga-arch-defs/lattice/ice40/techmap/cells_sim.v
abc -liberty /opt/f4pga-arch-defs/lattice/ice40/techmap/cells_sim.v
clean
write_json {top_module}_impl.json
write_verilog {top_module}_impl.v
stat
"""
            
            script_file = temp_path / "implementation.ys"
            script_file.write_text(script_content)
            
            # Run Yosys for preparation
            cmd = ["yosys", "-s", str(script_file)]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            if result.returncode != 0:
                return False, result.stdout + result.stderr, {}
            
            # Run nextpnr-ice40 for place & route
            nextpnr_cmd = [
                "nextpnr-ice40",
                "--json", f"{top_module}_impl.json",
                "--pcf", f"{top_module}.pcf" if constraints_file else None,
                "--asc", f"{top_module}.asc",
                "--freq", "12"
            ]
            
            # Remove None values
            nextpnr_cmd = [arg for arg in nextpnr_cmd if arg is not None]
            
            nextpnr_result = subprocess.run(nextpnr_cmd, capture_output=True, text=True, cwd=temp_path)
            
            # Parse results
            results = {
                'asc_file': None,
                'timing_report': None,
                'utilization_report': None,
                'device_part': device_part,
                'device_family': 'lattice_ice40'
            }
            
            # Read generated files
            asc_file = temp_path / f"{top_module}.asc"
            
            if asc_file.exists():
                results['asc_file'] = asc_file.read_text()
            
            # Parse timing and utilization from output
            results['timing_report'] = self._parse_timing_report(nextpnr_result.stdout)
            results['utilization_report'] = self._parse_utilization_report(nextpnr_result.stdout)
            
            success = nextpnr_result.returncode == 0
            output = nextpnr_result.stdout + nextpnr_result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Lattice iCE40 implementation error: {str(e)}")
            return False, f"Lattice iCE40 implementation failed: {str(e)}", {}
    
    def _implement_lattice_ecp5(self, 
                              temp_path: Path, 
                              top_module: str, 
                              device_part: str,
                              constraints_file: Optional[Path]) -> Tuple[bool, str, Dict]:
        """Implement for Lattice ECP5 using nextpnr-ecp5"""
        try:
            # Create implementation script
            script_content = f"""
# F4PGA implementation script for Lattice ECP5
read_json {top_module}_netlist.json
"""
            
            if constraints_file:
                script_content += f"read_lpf {top_module}.lpf\n"
            
            script_content += f"""
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
dfflibmap -liberty /opt/f4pga-arch-defs/lattice/ecp5/techmap/cells_sim.v
abc -liberty /opt/f4pga-arch-defs/lattice/ecp5/techmap/cells_sim.v
clean
write_json {top_module}_impl.json
write_verilog {top_module}_impl.v
stat
"""
            
            script_file = temp_path / "implementation.ys"
            script_file.write_text(script_content)
            
            # Run Yosys for preparation
            cmd = ["yosys", "-s", str(script_file)]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            if result.returncode != 0:
                return False, result.stdout + result.stderr, {}
            
            # Run nextpnr-ecp5 for place & route
            nextpnr_cmd = [
                "nextpnr-ecp5",
                "--json", f"{top_module}_impl.json",
                "--lpf", f"{top_module}.lpf" if constraints_file else None,
                "--textcfg", f"{top_module}.config",
                "--freq", "25"
            ]
            
            # Remove None values
            nextpnr_cmd = [arg for arg in nextpnr_cmd if arg is not None]
            
            nextpnr_result = subprocess.run(nextpnr_cmd, capture_output=True, text=True, cwd=temp_path)
            
            # Parse results
            results = {
                'config_file': None,
                'timing_report': None,
                'utilization_report': None,
                'device_part': device_part,
                'device_family': 'lattice_ecp5'
            }
            
            # Read generated files
            config_file = temp_path / f"{top_module}.config"
            
            if config_file.exists():
                results['config_file'] = config_file.read_text()
            
            # Parse timing and utilization from output
            results['timing_report'] = self._parse_timing_report(nextpnr_result.stdout)
            results['utilization_report'] = self._parse_utilization_report(nextpnr_result.stdout)
            
            success = nextpnr_result.returncode == 0
            output = nextpnr_result.stdout + nextpnr_result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Lattice ECP5 implementation error: {str(e)}")
            return False, f"Lattice ECP5 implementation failed: {str(e)}", {}
    
    def _parse_timing_report(self, output: str) -> Dict:
        """Parse timing report from nextpnr output"""
        timing = {
            'max_frequency': 0,
            'worst_slack': 0,
            'setup_violations': 0,
            'hold_violations': 0
        }
        
        try:
            lines = output.split('\n')
            for line in lines:
                if 'Max frequency' in line:
                    timing['max_frequency'] = self._extract_frequency(line)
                elif 'Worst slack' in line:
                    timing['worst_slack'] = self._extract_number(line)
                elif 'Setup violations' in line:
                    timing['setup_violations'] = self._extract_number(line)
                elif 'Hold violations' in line:
                    timing['hold_violations'] = self._extract_number(line)
        except Exception as e:
            logger.warning(f"Failed to parse timing report: {str(e)}")
        
        return timing
    
    def _parse_utilization_report(self, output: str) -> Dict:
        """Parse utilization report from nextpnr output"""
        utilization = {
            'lut_usage': 0,
            'ff_usage': 0,
            'memory_usage': 0,
            'dsp_usage': 0,
            'io_usage': 0,
            'lut_percentage': 0,
            'ff_percentage': 0,
            'memory_percentage': 0,
            'dsp_percentage': 0,
            'io_percentage': 0
        }
        
        try:
            lines = output.split('\n')
            for line in lines:
                if 'LUT' in line and '/' in line:
                    usage, total = self._extract_usage_total(line)
                    utilization['lut_usage'] = usage
                    utilization['lut_percentage'] = (usage / total * 100) if total > 0 else 0
                elif 'FF' in line and '/' in line:
                    usage, total = self._extract_usage_total(line)
                    utilization['ff_usage'] = usage
                    utilization['ff_percentage'] = (usage / total * 100) if total > 0 else 0
                elif 'Memory' in line and '/' in line:
                    usage, total = self._extract_usage_total(line)
                    utilization['memory_usage'] = usage
                    utilization['memory_percentage'] = (usage / total * 100) if total > 0 else 0
                elif 'DSP' in line and '/' in line:
                    usage, total = self._extract_usage_total(line)
                    utilization['dsp_usage'] = usage
                    utilization['dsp_percentage'] = (usage / total * 100) if total > 0 else 0
                elif 'IO' in line and '/' in line:
                    usage, total = self._extract_usage_total(line)
                    utilization['io_usage'] = usage
                    utilization['io_percentage'] = (usage / total * 100) if total > 0 else 0
        except Exception as e:
            logger.warning(f"Failed to parse utilization report: {str(e)}")
        
        return utilization
    
    def _extract_frequency(self, text: str) -> float:
        """Extract frequency from text"""
        import re
        match = re.search(r'(\d+\.?\d*)\s*MHz', text)
        return float(match.group(1)) if match else 0.0
    
    def _extract_number(self, text: str) -> int:
        """Extract number from text"""
        import re
        match = re.search(r'(\d+)', text)
        return int(match.group(1)) if match else 0
    
    def _extract_usage_total(self, text: str) -> Tuple[int, int]:
        """Extract usage and total from text like '123/456'"""
        import re
        match = re.search(r'(\d+)/(\d+)', text)
        if match:
            return int(match.group(1)), int(match.group(2))
        return 0, 0
    
    def validate_device(self, device_family: str, device_part: str) -> bool:
        """Validate if device is supported"""
        if device_family not in self.supported_devices:
            return False
        
        family_devices = self.supported_devices[device_family]
        for device_type, parts in family_devices.items():
            if device_part in parts:
                return True
        
        return False

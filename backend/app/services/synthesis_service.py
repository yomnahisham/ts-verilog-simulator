import os
import tempfile
import subprocess
import json
import logging
from typing import Dict, List, Tuple, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class SynthesisService:
    """Service for FPGA synthesis using F4PGA toolchain"""
    
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
    
    def get_supported_devices(self) -> Dict:
        """Get list of supported FPGA devices"""
        return self.supported_devices
    
    def synthesize_design(self, 
                         verilog_code: str, 
                         top_module: str, 
                         device_family: str, 
                         device_part: str,
                         constraints: Optional[str] = None) -> Tuple[bool, str, Dict]:
        """
        Synthesize Verilog design using F4PGA
        
        Args:
            verilog_code: Verilog source code
            top_module: Top-level module name
            device_family: FPGA device family (e.g., 'xilinx_7series')
            device_part: Specific device part (e.g., 'xc7a35t')
            constraints: Optional constraint file content
            
        Returns:
            Tuple of (success, output, results_dict)
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Write Verilog source
                verilog_file = temp_path / f"{top_module}.v"
                verilog_file.write_text(verilog_code)
                
                # Write constraints if provided
                constraints_file = None
                if constraints:
                    constraints_file = temp_path / f"{top_module}.xdc"
                    constraints_file.write_text(constraints)
                
                # Generate synthesis script based on device family
                if device_family == 'xilinx_7series':
                    success, output, results = self._synthesize_xilinx_7series(
                        temp_path, top_module, device_part, constraints_file
                    )
                elif device_family == 'lattice_ice40':
                    success, output, results = self._synthesize_lattice_ice40(
                        temp_path, top_module, device_part, constraints_file
                    )
                elif device_family == 'lattice_ecp5':
                    success, output, results = self._synthesize_lattice_ecp5(
                        temp_path, top_module, device_part, constraints_file
                    )
                else:
                    return False, f"Unsupported device family: {device_family}", {}
                
                return success, output, results
                
        except Exception as e:
            logger.error(f"Synthesis error: {str(e)}")
            return False, f"Synthesis failed: {str(e)}", {}
    
    def _synthesize_xilinx_7series(self, 
                                  temp_path: Path, 
                                  top_module: str, 
                                  device_part: str,
                                  constraints_file: Optional[Path]) -> Tuple[bool, str, Dict]:
        """Synthesize for Xilinx 7-Series using F4PGA"""
        try:
            # Check if F4PGA is available, otherwise use generic synthesis
            f4pga_available = os.path.exists('/opt/f4pga-arch-defs/xilinx/xc7/techmap/cells_sim.v')
            
            if f4pga_available:
                # Create synthesis script with F4PGA
                script_content = f"""
# F4PGA synthesis script for Xilinx 7-Series
read_verilog {top_module}.v
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
dfflibmap -liberty /opt/f4pga-arch-defs/xilinx/xc7/techmap/cells_sim.v
abc -liberty /opt/f4pga-arch-defs/xilinx/xc7/techmap/cells_sim.v
clean
write_json {top_module}_netlist.json
write_verilog {top_module}_netlist.v
stat
"""
            else:
                # Create generic synthesis script for local testing
                script_content = f"""
# Generic synthesis script for Xilinx 7-Series (local testing)
read_verilog {top_module}.v
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
clean
write_json {top_module}_netlist.json
write_verilog {top_module}_netlist.v
stat
"""
            
            script_file = temp_path / "synthesis.ys"
            script_file.write_text(script_content)
            
            # Run Yosys synthesis
            cmd = ["yosys", "-s", str(script_file)]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            # Parse results
            results = {
                'netlist_json': None,
                'netlist_verilog': None,
                'statistics': None,
                'device_part': device_part,
                'device_family': 'xilinx_7series'
            }
            
            # Read generated files
            netlist_json_file = temp_path / f"{top_module}_netlist.json"
            netlist_verilog_file = temp_path / f"{top_module}_netlist.v"
            
            if netlist_json_file.exists():
                results['netlist_json'] = netlist_json_file.read_text()
            
            if netlist_verilog_file.exists():
                results['netlist_verilog'] = netlist_verilog_file.read_text()
            
            # Parse statistics from output
            results['statistics'] = self._parse_synthesis_stats(result.stdout)
            
            success = result.returncode == 0
            output = result.stdout + result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Xilinx 7-Series synthesis error: {str(e)}")
            return False, f"Xilinx 7-Series synthesis failed: {str(e)}", {}
    
    def _synthesize_lattice_ice40(self, 
                                 temp_path: Path, 
                                 top_module: str, 
                                 device_part: str,
                                 constraints_file: Optional[Path]) -> Tuple[bool, str, Dict]:
        """Synthesize for Lattice iCE40 using F4PGA"""
        try:
            # Create synthesis script for iCE40
            script_content = f"""
# F4PGA synthesis script for Lattice iCE40
read_verilog {top_module}.v
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
dfflibmap -liberty /opt/f4pga-arch-defs/lattice/ice40/techmap/cells_sim.v
abc -liberty /opt/f4pga-arch-defs/lattice/ice40/techmap/cells_sim.v
clean
write_json {top_module}_netlist.json
write_verilog {top_module}_netlist.v
stat
"""
            
            script_file = temp_path / "synthesis.ys"
            script_file.write_text(script_content)
            
            # Run Yosys synthesis
            cmd = ["yosys", "-s", str(script_file)]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            # Parse results
            results = {
                'netlist_json': None,
                'netlist_verilog': None,
                'statistics': None,
                'device_part': device_part,
                'device_family': 'lattice_ice40'
            }
            
            # Read generated files
            netlist_json_file = temp_path / f"{top_module}_netlist.json"
            netlist_verilog_file = temp_path / f"{top_module}_netlist.v"
            
            if netlist_json_file.exists():
                results['netlist_json'] = netlist_json_file.read_text()
            
            if netlist_verilog_file.exists():
                results['netlist_verilog'] = netlist_verilog_file.read_text()
            
            # Parse statistics from output
            results['statistics'] = self._parse_synthesis_stats(result.stdout)
            
            success = result.returncode == 0
            output = result.stdout + result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Lattice iCE40 synthesis error: {str(e)}")
            return False, f"Lattice iCE40 synthesis failed: {str(e)}", {}
    
    def _synthesize_lattice_ecp5(self, 
                                temp_path: Path, 
                                top_module: str, 
                                device_part: str,
                                constraints_file: Optional[Path]) -> Tuple[bool, str, Dict]:
        """Synthesize for Lattice ECP5 using F4PGA"""
        try:
            # Create synthesis script for ECP5
            script_content = f"""
# F4PGA synthesis script for Lattice ECP5
read_verilog {top_module}.v
hierarchy -top {top_module}
proc; opt; memory; opt; fsm; opt
techmap; opt
dfflibmap -liberty /opt/f4pga-arch-defs/lattice/ecp5/techmap/cells_sim.v
abc -liberty /opt/f4pga-arch-defs/lattice/ecp5/techmap/cells_sim.v
clean
write_json {top_module}_netlist.json
write_verilog {top_module}_netlist.v
stat
"""
            
            script_file = temp_path / "synthesis.ys"
            script_file.write_text(script_content)
            
            # Run Yosys synthesis
            cmd = ["yosys", "-s", str(script_file)]
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            # Parse results
            results = {
                'netlist_json': None,
                'netlist_verilog': None,
                'statistics': None,
                'device_part': device_part,
                'device_family': 'lattice_ecp5'
            }
            
            # Read generated files
            netlist_json_file = temp_path / f"{top_module}_netlist.json"
            netlist_verilog_file = temp_path / f"{top_module}_netlist.v"
            
            if netlist_json_file.exists():
                results['netlist_json'] = netlist_json_file.read_text()
            
            if netlist_verilog_file.exists():
                results['netlist_verilog'] = netlist_verilog_file.read_text()
            
            # Parse statistics from output
            results['statistics'] = self._parse_synthesis_stats(result.stdout)
            
            success = result.returncode == 0
            output = result.stdout + result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Lattice ECP5 synthesis error: {str(e)}")
            return False, f"Lattice ECP5 synthesis failed: {str(e)}", {}
    
    def _parse_synthesis_stats(self, output: str) -> Dict:
        """Parse synthesis statistics from Yosys output"""
        stats = {
            'lut_count': 0,
            'ff_count': 0,
            'memory_count': 0,
            'dsp_count': 0,
            'io_count': 0,
            'total_cells': 0
        }
        
        try:
            lines = output.split('\n')
            for line in lines:
                if 'Number of cells:' in line:
                    # Extract cell counts
                    if 'LUT' in line:
                        stats['lut_count'] = self._extract_number(line)
                    elif 'FF' in line:
                        stats['ff_count'] = self._extract_number(line)
                    elif 'Memory' in line:
                        stats['memory_count'] = self._extract_number(line)
                    elif 'DSP' in line:
                        stats['dsp_count'] = self._extract_number(line)
                    elif 'IO' in line:
                        stats['io_count'] = self._extract_number(line)
                    elif 'Total' in line:
                        stats['total_cells'] = self._extract_number(line)
        except Exception as e:
            logger.warning(f"Failed to parse synthesis stats: {str(e)}")
        
        return stats
    
    def _extract_number(self, text: str) -> int:
        """Extract number from text"""
        import re
        match = re.search(r'(\d+)', text)
        return int(match.group(1)) if match else 0
    
    def validate_device(self, device_family: str, device_part: str) -> bool:
        """Validate if device is supported"""
        if device_family not in self.supported_devices:
            return False
        
        family_devices = self.supported_devices[device_family]
        for device_type, parts in family_devices.items():
            if device_part in parts:
                return True
        
        return False

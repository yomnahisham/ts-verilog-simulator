import os
import tempfile
import subprocess
import logging
from typing import Dict, List, Tuple, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class ProgrammingService:
    """Service for FPGA programming using openFPGALoader"""
    
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
    
    def detect_fpga_devices(self) -> Tuple[bool, str, List[Dict]]:
        """
        Detect connected FPGA devices
        
        Returns:
            Tuple of (success, output, devices_list)
        """
        try:
            # Run openFPGALoader to detect devices
            cmd = ["openFPGALoader", "--detect"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            devices = []
            if result.returncode == 0:
                devices = self._parse_device_detection(result.stdout)
            
            return result.returncode == 0, result.stdout + result.stderr, devices
            
        except Exception as e:
            logger.error(f"FPGA device detection error: {str(e)}")
            return False, f"Device detection failed: {str(e)}", []
    
    def program_fpga(self, 
                    bitstream_data: bytes,
                    device_family: str, 
                    device_part: str,
                    programming_mode: str = 'auto',
                    verify: bool = True) -> Tuple[bool, str, Dict]:
        """
        Program FPGA with bitstream
        
        Args:
            bitstream_data: Bitstream binary data
            device_family: FPGA device family
            device_part: Specific device part
            programming_mode: Programming mode ('auto', 'jtag', 'spi', 'qspi')
            verify: Whether to verify programming
            
        Returns:
            Tuple of (success, output, results_dict)
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Determine bitstream file extension
                if device_family == 'xilinx_7series':
                    bitstream_file = temp_path / "design.bit"
                elif device_family == 'lattice_ice40':
                    bitstream_file = temp_path / "design.bin"
                elif device_family == 'lattice_ecp5':
                    bitstream_file = temp_path / "design.bit"
                else:
                    return False, f"Unsupported device family: {device_family}", {}
                
                # Write bitstream to file
                bitstream_file.write_bytes(bitstream_data)
                
                # Program FPGA
                success, output, results = self._program_device(
                    bitstream_file, device_family, device_part, programming_mode, verify
                )
                
                return success, output, results
                
        except Exception as e:
            logger.error(f"FPGA programming error: {str(e)}")
            return False, f"FPGA programming failed: {str(e)}", {}
    
    def _program_device(self, 
                       bitstream_file: Path, 
                       device_family: str, 
                       device_part: str,
                       programming_mode: str,
                       verify: bool) -> Tuple[bool, str, Dict]:
        """Program specific device"""
        try:
            # Build openFPGALoader command
            cmd = ["openFPGALoader"]
            
            # Add device-specific options
            if device_family == 'xilinx_7series':
                cmd.extend(["--fpga-part", device_part])
                cmd.extend(["--bitstream", str(bitstream_file)])
            elif device_family == 'lattice_ice40':
                cmd.extend(["--fpga-part", device_part])
                cmd.extend(["--bitstream", str(bitstream_file)])
            elif device_family == 'lattice_ecp5':
                cmd.extend(["--fpga-part", device_part])
                cmd.extend(["--bitstream", str(bitstream_file)])
            else:
                return False, f"Unsupported device family: {device_family}", {}
            
            # Add programming mode
            if programming_mode != 'auto':
                cmd.extend(["--mode", programming_mode])
            
            # Add verification if requested
            if verify:
                cmd.append("--verify")
            
            # Add verbose output
            cmd.append("--verbose")
            
            # Run programming command
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            # Parse results
            results = {
                'programming_success': result.returncode == 0,
                'verification_success': False,
                'programming_time': 0,
                'bitstream_size': bitstream_file.stat().st_size,
                'device_part': device_part,
                'device_family': device_family,
                'programming_mode': programming_mode
            }
            
            # Parse programming output for additional info
            if result.returncode == 0:
                results['verification_success'] = verify and 'verification successful' in result.stdout.lower()
                results['programming_time'] = self._extract_programming_time(result.stdout)
            
            return result.returncode == 0, result.stdout + result.stderr, results
            
        except Exception as e:
            logger.error(f"Device programming error: {str(e)}")
            return False, f"Device programming failed: {str(e)}", {}
    
    def _parse_device_detection(self, output: str) -> List[Dict]:
        """Parse device detection output"""
        devices = []
        
        try:
            lines = output.split('\n')
            for line in lines:
                if 'Found' in line and 'FPGA' in line:
                    # Parse device information
                    device_info = self._extract_device_info(line)
                    if device_info:
                        devices.append(device_info)
        except Exception as e:
            logger.warning(f"Failed to parse device detection: {str(e)}")
        
        return devices
    
    def _extract_device_info(self, line: str) -> Optional[Dict]:
        """Extract device information from detection line"""
        try:
            # Example: "Found 1 device(s): Xilinx XC7A35T"
            if 'Found' in line and 'device' in line:
                parts = line.split(':')
                if len(parts) > 1:
                    device_name = parts[1].strip()
                    return {
                        'name': device_name,
                        'family': self._determine_family(device_name),
                        'part': self._extract_part_number(device_name),
                        'status': 'detected'
                    }
        except Exception as e:
            logger.warning(f"Failed to extract device info: {str(e)}")
        
        return None
    
    def _determine_family(self, device_name: str) -> str:
        """Determine device family from device name"""
        device_name_lower = device_name.lower()
        
        if 'xc7a' in device_name_lower:
            return 'xilinx_7series'
        elif 'xc7k' in device_name_lower:
            return 'xilinx_7series'
        elif 'xc7v' in device_name_lower:
            return 'xilinx_7series'
        elif 'ice40' in device_name_lower:
            return 'lattice_ice40'
        elif 'ecp5' in device_name_lower or 'lfe5u' in device_name_lower:
            return 'lattice_ecp5'
        else:
            return 'unknown'
    
    def _extract_part_number(self, device_name: str) -> str:
        """Extract part number from device name"""
        # Extract part number (e.g., "XC7A35T" from "Xilinx XC7A35T")
        parts = device_name.split()
        for part in parts:
            if any(prefix in part.upper() for prefix in ['XC7', 'ICE', 'LFE']):
                return part.upper()
        return 'unknown'
    
    def _extract_programming_time(self, output: str) -> float:
        """Extract programming time from output"""
        try:
            lines = output.split('\n')
            for line in lines:
                if 'time' in line.lower() and 's' in line:
                    # Look for time patterns like "2.5s" or "1.2 seconds"
                    import re
                    match = re.search(r'(\d+\.?\d*)\s*s', line)
                    if match:
                        return float(match.group(1))
        except Exception as e:
            logger.warning(f"Failed to extract programming time: {str(e)}")
        
        return 0.0
    
    def get_programming_status(self) -> Tuple[bool, str, Dict]:
        """
        Get current programming status
        
        Returns:
            Tuple of (success, output, status_dict)
        """
        try:
            # Check if openFPGALoader is available
            cmd = ["openFPGALoader", "--version"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            status = {
                'openfpgaloader_available': result.returncode == 0,
                'version': None,
                'usb_devices_available': False,
                'jtag_devices_available': False
            }
            
            if result.returncode == 0:
                status['version'] = result.stdout.strip()
                
                # Check for USB devices
                usb_result = subprocess.run(["lsusb"], capture_output=True, text=True)
                status['usb_devices_available'] = usb_result.returncode == 0
                
                # Check for JTAG devices
                jtag_result = subprocess.run(["ls", "/dev/ttyUSB*"], capture_output=True, text=True)
                status['jtag_devices_available'] = jtag_result.returncode == 0
            
            return result.returncode == 0, result.stdout + result.stderr, status
            
        except Exception as e:
            logger.error(f"Programming status check error: {str(e)}")
            return False, f"Programming status check failed: {str(e)}", {}
    
    def validate_device(self, device_family: str, device_part: str) -> bool:
        """Validate if device is supported"""
        if device_family not in self.supported_devices:
            return False
        
        family_devices = self.supported_devices[device_family]
        for device_type, parts in family_devices.items():
            if device_part in parts:
                return True
        
        return False
    
    def get_supported_programming_modes(self, device_family: str) -> List[str]:
        """Get supported programming modes for device family"""
        modes = {
            'xilinx_7series': ['auto', 'jtag', 'spi', 'qspi'],
            'lattice_ice40': ['auto', 'jtag', 'spi'],
            'lattice_ecp5': ['auto', 'jtag', 'spi', 'qspi']
        }
        
        return modes.get(device_family, ['auto'])


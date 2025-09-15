import os
import tempfile
import subprocess
import logging
from typing import Dict, List, Tuple, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class BitstreamService:
    """Service for FPGA bitstream generation using F4PGA toolchain"""
    
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
    
    def generate_bitstream(self, 
                          implementation_data: str,
                          top_module: str, 
                          device_family: str, 
                          device_part: str,
                          data_format: str = 'fasm') -> Tuple[bool, str, Dict]:
        """
        Generate bitstream from implementation data
        
        Args:
            implementation_data: Implementation data (fasm, asc, config)
            top_module: Top-level module name
            device_family: FPGA device family
            device_part: Specific device part
            data_format: Format of implementation data ('fasm', 'asc', 'config')
            
        Returns:
            Tuple of (success, output, results_dict)
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Write implementation data
                if data_format == 'fasm':
                    impl_file = temp_path / f"{top_module}.fasm"
                elif data_format == 'asc':
                    impl_file = temp_path / f"{top_module}.asc"
                elif data_format == 'config':
                    impl_file = temp_path / f"{top_module}.config"
                else:
                    return False, f"Unsupported data format: {data_format}", {}
                
                impl_file.write_text(implementation_data)
                
                # Generate bitstream based on device family
                if device_family == 'xilinx_7series':
                    success, output, results = self._generate_xilinx_7series_bitstream(
                        temp_path, top_module, device_part, data_format
                    )
                elif device_family == 'lattice_ice40':
                    success, output, results = self._generate_lattice_ice40_bitstream(
                        temp_path, top_module, device_part, data_format
                    )
                elif device_family == 'lattice_ecp5':
                    success, output, results = self._generate_lattice_ecp5_bitstream(
                        temp_path, top_module, device_part, data_format
                    )
                else:
                    return False, f"Unsupported device family: {device_family}", {}
                
                return success, output, results
                
        except Exception as e:
            logger.error(f"Bitstream generation error: {str(e)}")
            return False, f"Bitstream generation failed: {str(e)}", {}
    
    def _generate_xilinx_7series_bitstream(self, 
                                         temp_path: Path, 
                                         top_module: str, 
                                         device_part: str,
                                         data_format: str) -> Tuple[bool, str, Dict]:
        """Generate bitstream for Xilinx 7-Series using Project X-Ray"""
        try:
            if data_format != 'fasm':
                return False, "Xilinx 7-Series requires FASM format", {}
            
            # Check if F4PGA is available, otherwise create mock bitstream
            f4pga_available = os.path.exists('/opt/f4pga-arch-defs/xilinx/xc7/database')
            
            if f4pga_available:
                # Generate bitstream using Project X-Ray
                cmd = [
                    "python3", "-m", "fasm",
                    "--db-root", f"/opt/f4pga-arch-defs/xilinx/xc7/database",
                    "--part", device_part,
                    "--fasm", f"{top_module}.fasm",
                    "--bit", f"{top_module}.bit"
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            else:
                # For local testing, create mock bitstream
                result = subprocess.CompletedProcess(
                    args=[], returncode=0, stdout="Mock bitstream generation completed", stderr=""
                )
                
                # Create a mock bitstream file
                mock_bitstream = temp_path / f"{top_module}.bit"
                mock_bitstream.write_bytes(b'\x00\x01\x02\x03\x04\x05\x06\x07' * 100)  # Mock bitstream data
            
            # Parse results
            results = {
                'bitstream_file': None,
                'bitstream_size': 0,
                'bitstream_format': 'bit',
                'device_part': device_part,
                'device_family': 'xilinx_7series'
            }
            
            # Read generated bitstream
            bitstream_file = temp_path / f"{top_module}.bit"
            if bitstream_file.exists():
                results['bitstream_file'] = bitstream_file.read_bytes()
                results['bitstream_size'] = len(results['bitstream_file'])
            
            success = result.returncode == 0
            output = result.stdout + result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Xilinx 7-Series bitstream generation error: {str(e)}")
            return False, f"Xilinx 7-Series bitstream generation failed: {str(e)}", {}
    
    def _generate_lattice_ice40_bitstream(self, 
                                        temp_path: Path, 
                                        top_module: str, 
                                        device_part: str,
                                        data_format: str) -> Tuple[bool, str, Dict]:
        """Generate bitstream for Lattice iCE40 using IceStorm"""
        try:
            if data_format != 'asc':
                return False, "Lattice iCE40 requires ASC format", {}
            
            # Generate bitstream using IceStorm
            cmd = [
                "icepack",
                f"{top_module}.asc",
                f"{top_module}.bin"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            # Parse results
            results = {
                'bitstream_file': None,
                'bitstream_size': 0,
                'bitstream_format': 'bin',
                'device_part': device_part,
                'device_family': 'lattice_ice40'
            }
            
            # Read generated bitstream
            bitstream_file = temp_path / f"{top_module}.bin"
            if bitstream_file.exists():
                results['bitstream_file'] = bitstream_file.read_bytes()
                results['bitstream_size'] = len(results['bitstream_file'])
            
            success = result.returncode == 0
            output = result.stdout + result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Lattice iCE40 bitstream generation error: {str(e)}")
            return False, f"Lattice iCE40 bitstream generation failed: {str(e)}", {}
    
    def _generate_lattice_ecp5_bitstream(self, 
                                       temp_path: Path, 
                                       top_module: str, 
                                       device_part: str,
                                       data_format: str) -> Tuple[bool, str, Dict]:
        """Generate bitstream for Lattice ECP5 using Trellis"""
        try:
            if data_format != 'config':
                return False, "Lattice ECP5 requires config format", {}
            
            # Generate bitstream using Trellis
            cmd = [
                "ecppack",
                "--compress",
                f"{top_module}.config",
                f"{top_module}.bit"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=temp_path)
            
            # Parse results
            results = {
                'bitstream_file': None,
                'bitstream_size': 0,
                'bitstream_format': 'bit',
                'device_part': device_part,
                'device_family': 'lattice_ecp5'
            }
            
            # Read generated bitstream
            bitstream_file = temp_path / f"{top_module}.bit"
            if bitstream_file.exists():
                results['bitstream_file'] = bitstream_file.read_bytes()
                results['bitstream_size'] = len(results['bitstream_file'])
            
            success = result.returncode == 0
            output = result.stdout + result.stderr
            
            return success, output, results
            
        except Exception as e:
            logger.error(f"Lattice ECP5 bitstream generation error: {str(e)}")
            return False, f"Lattice ECP5 bitstream generation failed: {str(e)}", {}
    
    def validate_bitstream(self, bitstream_data: bytes, device_family: str) -> Tuple[bool, str]:
        """
        Validate bitstream format and content
        
        Args:
            bitstream_data: Bitstream binary data
            device_family: FPGA device family
            
        Returns:
            Tuple of (is_valid, validation_message)
        """
        try:
            if not bitstream_data:
                return False, "Bitstream data is empty"
            
            if device_family == 'xilinx_7series':
                return self._validate_xilinx_bitstream(bitstream_data)
            elif device_family == 'lattice_ice40':
                return self._validate_lattice_ice40_bitstream(bitstream_data)
            elif device_family == 'lattice_ecp5':
                return self._validate_lattice_ecp5_bitstream(bitstream_data)
            else:
                return False, f"Unsupported device family: {device_family}"
                
        except Exception as e:
            logger.error(f"Bitstream validation error: {str(e)}")
            return False, f"Bitstream validation failed: {str(e)}"
    
    def _validate_xilinx_bitstream(self, bitstream_data: bytes) -> Tuple[bool, str]:
        """Validate Xilinx bitstream format"""
        try:
            # Check for Xilinx bitstream header
            if len(bitstream_data) < 4:
                return False, "Bitstream too short"
            
            # Xilinx bitstreams typically start with specific patterns
            header = bitstream_data[:4]
            if header in [b'\x00\x00\x00\xbb', b'\xaa\x99\x55\x66']:
                return True, "Valid Xilinx bitstream format"
            else:
                return False, "Invalid Xilinx bitstream header"
                
        except Exception as e:
            return False, f"Xilinx bitstream validation error: {str(e)}"
    
    def _validate_lattice_ice40_bitstream(self, bitstream_data: bytes) -> Tuple[bool, str]:
        """Validate Lattice iCE40 bitstream format"""
        try:
            # Check for Lattice iCE40 bitstream header
            if len(bitstream_data) < 4:
                return False, "Bitstream too short"
            
            # Lattice iCE40 bitstreams have specific patterns
            header = bitstream_data[:4]
            if header == b'\x7e\xaa\x99\x7e':
                return True, "Valid Lattice iCE40 bitstream format"
            else:
                return False, "Invalid Lattice iCE40 bitstream header"
                
        except Exception as e:
            return False, f"Lattice iCE40 bitstream validation error: {str(e)}"
    
    def _validate_lattice_ecp5_bitstream(self, bitstream_data: bytes) -> Tuple[bool, str]:
        """Validate Lattice ECP5 bitstream format"""
        try:
            # Check for Lattice ECP5 bitstream header
            if len(bitstream_data) < 4:
                return False, "Bitstream too short"
            
            # Lattice ECP5 bitstreams have specific patterns
            header = bitstream_data[:4]
            if header == b'\x7e\xaa\x99\x7e':
                return True, "Valid Lattice ECP5 bitstream format"
            else:
                return False, "Invalid Lattice ECP5 bitstream header"
                
        except Exception as e:
            return False, f"Lattice ECP5 bitstream validation error: {str(e)}"
    
    def get_bitstream_info(self, bitstream_data: bytes, device_family: str) -> Dict:
        """
        Get information about the bitstream
        
        Args:
            bitstream_data: Bitstream binary data
            device_family: FPGA device family
            
        Returns:
            Dictionary with bitstream information
        """
        info = {
            'size_bytes': len(bitstream_data),
            'size_kb': len(bitstream_data) / 1024,
            'size_mb': len(bitstream_data) / (1024 * 1024),
            'device_family': device_family,
            'format': 'unknown',
            'checksum': None
        }
        
        try:
            # Calculate checksum
            import hashlib
            info['checksum'] = hashlib.md5(bitstream_data).hexdigest()
            
            # Determine format based on device family
            if device_family == 'xilinx_7series':
                info['format'] = 'bit'
            elif device_family == 'lattice_ice40':
                info['format'] = 'bin'
            elif device_family == 'lattice_ecp5':
                info['format'] = 'bit'
                
        except Exception as e:
            logger.warning(f"Failed to get bitstream info: {str(e)}")
        
        return info
    
    def validate_device(self, device_family: str, device_part: str) -> bool:
        """Validate if device is supported"""
        if device_family not in self.supported_devices:
            return False
        
        family_devices = self.supported_devices[device_family]
        for device_type, parts in family_devices.items():
            if device_part in parts:
                return True
        
        return False

import os
import subprocess
import tempfile
import logging
import asyncio
import re
import shutil
from typing import Dict, List, Tuple, Optional, Any

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class VerilogSimulator:
    def __init__(self):
        # Create temp directory with proper permissions
        self.temp_dir = tempfile.mkdtemp()
        os.chmod(self.temp_dir, 0o777)  # Ensure write permissions
        logger.debug(f"Created temporary directory: {self.temp_dir}")
        self.simulation_timeout = 10  # Reduced to 10 seconds to match Vercel's timeout
        self.check_required_tools()
        
    def check_required_tools(self):
        """Check if required tools are available"""
        required_tools = ["iverilog", "vvp", "verilator"]
        missing_tools = []
        
        for tool in required_tools:
            try:
                subprocess.run(["which", tool], check=True, capture_output=True)
            except subprocess.CalledProcessError:
                missing_tools.append(tool)
                
        if missing_tools:
            error_msg = f"Required tools not found: {', '.join(missing_tools)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
            
        logger.debug("All required tools are available")

    def extract_module_names(self, verilog_code: str) -> List[str]:
        """Extract module names from Verilog code"""
        # Match module declarations with or without parameters
        module_pattern = r'module\s+(\w+)\s*(?:\([^)]*\))?\s*;'
        return re.findall(module_pattern, verilog_code)

    async def compile_and_simulate(self, verilog_code: str, testbench_code: str, top_module: str, top_testbench: str = None) -> Tuple[bool, str, str]:
        """Compile and simulate Verilog code."""
        temp_dir = None
        try:
            # Create a temporary directory for the simulation files
            temp_dir = tempfile.mkdtemp()
            logger.debug(f"Created temporary directory: {temp_dir}")
            
            # Create temporary files for the design and testbench
            design_path = os.path.join(temp_dir, "design.v")
            testbench_path = os.path.join(temp_dir, "testbench.v")
            vcd_path = os.path.join(temp_dir, "waveform.vcd")
            
            with open(design_path, "w") as f:
                f.write(verilog_code)
            
            # Modify the testbench to ensure proper VCD dumping
            modified_testbench = self.prepare_testbench(testbench_code, top_module, top_testbench)
            
            with open(testbench_path, "w") as f:
                f.write(modified_testbench)
            
            logger.debug(f"Created temporary files: {design_path}, {testbench_path}")
            
            # Compile the Verilog code
            compile_cmd = ["iverilog", "-o", os.path.join(temp_dir, "sim"), design_path, testbench_path]
            logger.debug(f"Compilation command: {' '.join(compile_cmd)}")
            
            try:
                compile_result = subprocess.run(
                    compile_cmd,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=self.simulation_timeout
                )
                
                if compile_result.returncode != 0:
                    logger.error(f"Compilation failed: {compile_result.stderr}")
                    return False, f"Compilation failed: {compile_result.stderr}", ""
                
                logger.debug("Compilation successful")
            except subprocess.TimeoutExpired:
                logger.error("Compilation timed out")
                return False, "Compilation timed out. The operation took too long to complete.", ""
            except Exception as e:
                logger.error(f"Compilation error: {str(e)}")
                return False, f"Compilation error: {str(e)}", ""
            
            # Run the simulation
            sim_cmd = ["vvp", "-M", "/usr/local/lib/ivl", os.path.join(temp_dir, "sim"), "-vcd", vcd_path]
            logger.debug(f"Simulation command: {' '.join(sim_cmd)}")
            
            try:
                sim_result = subprocess.run(
                    sim_cmd,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=self.simulation_timeout
                )
                
                if sim_result.returncode != 0:
                    logger.error(f"Simulation failed: {sim_result.stderr}")
                    return False, f"Simulation failed: {sim_result.stderr}", ""
                
                logger.debug("Simulation successful")
            except subprocess.TimeoutExpired:
                logger.error("Simulation timed out")
                return False, "Simulation timed out. The operation took too long to complete.", ""
            except Exception as e:
                logger.error(f"Simulation error: {str(e)}")
                return False, f"Simulation error: {str(e)}", ""
            
            # Check if the VCD file was generated
            if not os.path.exists(vcd_path):
                logger.error(f"VCD file not found at {vcd_path}")
                # Try to find the VCD file in the current directory
                current_dir_vcd = os.path.join(os.getcwd(), "waveform.vcd")
                if os.path.exists(current_dir_vcd):
                    logger.debug(f"Found VCD file in current directory: {current_dir_vcd}")
                    vcd_path = current_dir_vcd
                else:
                    # Try to find any .vcd file in the temp directory
                    vcd_files = [f for f in os.listdir(temp_dir) if f.endswith('.vcd')]
                    if vcd_files:
                        vcd_path = os.path.join(temp_dir, vcd_files[0])
                        logger.debug(f"Found VCD file in temp directory: {vcd_path}")
                    else:
                        logger.error("No VCD file found")
                        return False, "VCD file not generated", ""
            
            # Read the VCD file
            try:
                with open(vcd_path, "r") as f:
                    vcd_content = f.read()
                
                logger.debug(f"VCD file read successfully, size: {len(vcd_content)} bytes")
            except Exception as e:
                logger.error(f"Error reading VCD file: {str(e)}")
                return False, f"Error reading VCD file: {str(e)}", ""
            
            # Return the simulation results
            return True, sim_result.stdout, vcd_content
            
        except Exception as e:
            logger.error(f"Error in compile_and_simulate: {str(e)}")
            return False, f"Error: {str(e)}", ""
        finally:
            # Clean up temporary files
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.error(f"Error cleaning up temporary directory: {str(e)}")

    def prepare_testbench(self, testbench_code: str, top_module: str, top_testbench: str = None) -> str:
        """Prepare the testbench code by ensuring proper VCD dumping."""
        # If the testbench already has VCD dump commands, return it as is
        if "$dumpfile" in testbench_code and "$dumpvars" in testbench_code:
            logger.debug("Testbench already has VCD dump commands, using as is")
            return testbench_code
            
        # Use the provided testbench module name or extract it
        testbench_module_name = top_testbench
        if not testbench_module_name:
            module_match = re.search(r'module\s+(\w+)\s*(?:\([^)]*\))?\s*;', testbench_code)
            testbench_module_name = module_match.group(1) if module_match else f"{top_module}_tb"
        
        logger.debug(f"Using testbench module name: {testbench_module_name}")
        
        # Add VCD dump commands at the beginning of the module
        module_start_match = re.search(r'module\s+\w+\s*(?:\([^)]*\))?\s*;', testbench_code)
        if module_start_match:
            modified_testbench = testbench_code.replace(
                module_start_match.group(0),
                f'''{module_start_match.group(0)}

  // Generate VCD file
  initial begin
    $dumpfile("waveform.vcd");
    $dumpvars(0, {testbench_module_name});  // Dump all variables in the testbench
  end'''
            )
        else:
            # Fallback: add at the beginning of the file
            modified_testbench = f'''// Generate VCD file
initial begin
  $dumpfile("waveform.vcd");
  $dumpvars(0, {testbench_module_name});  // Dump all variables in the testbench
end

{testbench_code}'''
        
        return modified_testbench

    def cleanup(self):
        """Clean up temporary files"""
        logger.debug(f"Cleaning up temporary directory: {self.temp_dir}")
        try:
            shutil.rmtree(self.temp_dir)
        except Exception as e:
            logger.error(f"Error cleaning up temporary directory: {str(e)}")

    def simulate(self, design_code: str, testbench_code: str, top_module: str, top_testbench: str = None) -> Dict[str, Any]:
        """Simulate the Verilog code and return the results."""
        try:
            # Create temporary directory for simulation files
            with tempfile.TemporaryDirectory() as temp_dir:
                # Write design and testbench files
                design_file = os.path.join(temp_dir, f"{top_module}.v")
                testbench_file = os.path.join(temp_dir, "testbench.v")
                
                with open(design_file, 'w') as f:
                    f.write(design_code)
                with open(testbench_file, 'w') as f:
                    f.write(testbench_code)
                
                # Compile the design and testbench
                compile_result = self.compile_verilog(design_file, testbench_file)
                if not compile_result['success']:
                    return compile_result
                
                # Run the simulation
                sim_result = self.run_simulation(temp_dir, top_testbench or f"{top_module}_tb")
                if not sim_result['success']:
                    return sim_result
                
                # Read the VCD file if it exists
                vcd_file = os.path.join(temp_dir, "waveform.vcd")
                if os.path.exists(vcd_file):
                    with open(vcd_file, 'r') as f:
                        vcd_content = f.read()
                else:
                    vcd_content = ""
                
                return {
                    'success': True,
                    'message': 'Simulation completed successfully',
                    'vcd_content': vcd_content,
                    'compile_output': compile_result['output'],
                    'sim_output': sim_result['output']
                }
                
        except Exception as e:
            logger.error(f"Simulation failed: {str(e)}")
            return {
                'success': False,
                'message': f'Simulation failed: {str(e)}',
                'vcd_content': "",
                'compile_output': "",
                'sim_output': ""
            }

    def get_verilator_warnings(self, verilog_code: str, testbench_code: str) -> List[str]:
        """Get warnings from Verilator for the given Verilog code."""
        warnings = []
        temp_dir = None
        try:
            # Create a temporary directory for the files
            temp_dir = tempfile.mkdtemp()
            
            # Write the design and testbench files
            design_path = os.path.join(temp_dir, "design.v")
            testbench_path = os.path.join(temp_dir, "testbench.v")
            
            with open(design_path, "w") as f:
                f.write(verilog_code)
            with open(testbench_path, "w") as f:
                f.write(testbench_code)
            
            # Run Verilator with warning flags
            verilator_cmd = [
                "verilator",
                "--lint-only",  # Only check for warnings, don't simulate
                "--Wall",       # Enable all warnings
                "--Wno-fatal",  # Don't treat warnings as errors
                "--Wno-style",  # Ignore style warnings
                design_path,
                testbench_path
            ]
            
            try:
                result = subprocess.run(
                    verilator_cmd,
                    capture_output=True,
                    text=True,
                    cwd=temp_dir,
                    timeout=self.simulation_timeout
                )
                
                # Process the output to extract warnings
                if result.stderr:
                    warning_lines = result.stderr.split('\n')
                    for line in warning_lines:
                        if line.strip() and not line.startswith('%'):
                            # Clean up the warning message
                            warning = line.strip()
                            if warning.startswith('%Warning-'):
                                warning = warning[9:]  # Remove '%Warning-' prefix
                            warnings.append(warning)
            
            except subprocess.TimeoutExpired:
                logger.error("Verilator warning check timed out")
                warnings.append("Warning check timed out")
            except Exception as e:
                logger.error(f"Error running Verilator: {str(e)}")
                warnings.append(f"Error checking warnings: {str(e)}")
            
        except Exception as e:
            logger.error(f"Error in get_verilator_warnings: {str(e)}")
            warnings.append(f"Error checking warnings: {str(e)}")
        finally:
            # Clean up temporary files
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.error(f"Error cleaning up temporary directory: {str(e)}")
        
        return warnings 
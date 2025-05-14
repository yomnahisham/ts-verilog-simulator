import os
import subprocess
import tempfile
import logging
import asyncio
import re
import shutil
import json
from typing import Dict, List, Tuple, Optional, Any, Generator
from app.config import Config

# Configure logging
logging.basicConfig(level=getattr(logging, Config.LOG_LEVEL))
logger = logging.getLogger(__name__)

class VerilogSimulator:
    def __init__(self):
        # Create temp directory with proper permissions
        self.temp_dir = tempfile.mkdtemp()
        os.chmod(self.temp_dir, 0o777)  # Ensure write permissions
        logger.debug(f"Created temporary directory: {self.temp_dir}")
        
        # Load configuration
        config = Config.get_simulation_config()
        self.simulation_timeout = config['simulation_timeout']
        self.chunk_size = config['chunk_size']
        self.max_chunks = config['max_chunks']
        self.iverilog_path = config['iverilog_path']
        self.vvp_path = config['vvp_path']
        self.ivl_lib_path = config['ivl_lib_path']
        self.vcd_filename = config['vcd_filename']
        
        self.check_required_tools()
        
    def check_required_tools(self):
        """Check if required tools are available"""
        required_tools = [self.iverilog_path, self.vvp_path]
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

    async def compile_and_simulate(self, verilog_code: str, testbench_code: str, top_module: str, top_testbench: str = None) -> Generator[Dict[str, Any], None, None]:
        """Compile and simulate Verilog code in chunks."""
        temp_dir = None
        try:
            # Create a temporary directory for the simulation files
            temp_dir = tempfile.mkdtemp()
            logger.debug(f"Created temporary directory: {temp_dir}")
            
            # Create temporary files for the design and testbench
            design_path = os.path.join(temp_dir, "design.v")
            testbench_path = os.path.join(temp_dir, "testbench.v")
            vcd_path = os.path.join(temp_dir, self.vcd_filename)
            
            with open(design_path, "w") as f:
                f.write(verilog_code)
            
            # Modify the testbench to ensure proper VCD dumping
            modified_testbench = self.prepare_testbench(testbench_code, top_module, top_testbench)
            
            with open(testbench_path, "w") as f:
                f.write(modified_testbench)
            
            logger.debug(f"Created temporary files: {design_path}, {testbench_path}")
            
            # Compile the Verilog code
            compile_cmd = [self.iverilog_path, "-o", os.path.join(temp_dir, "sim"), design_path, testbench_path]
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
                    error_msg = compile_result.stderr.strip()
                    formatted_error = self.format_verilog_error(error_msg, verilog_code, testbench_code)
                    logger.error(f"Compilation failed: {formatted_error}")
                    yield {
                        'success': False,
                        'error': formatted_error,
                        'is_complete': True
                    }
                    return
                
                logger.debug("Compilation successful")
            except subprocess.TimeoutExpired:
                logger.error("Compilation timed out")
                yield {
                    'success': False,
                    'error': "Compilation timed out. The operation took too long to complete.",
                    'is_complete': True
                }
                return
            except Exception as e:
                logger.error(f"Compilation error: {str(e)}")
                yield {
                    'success': False,
                    'error': f"Compilation error: {str(e)}",
                    'is_complete': True
                }
                return

            # Run simulation in chunks
            current_time = 0
            last_vcd_content = ""
            chunk_count = 0
            
            while chunk_count < self.max_chunks:
                try:
                    chunk_count += 1
                    logger.debug(f"Starting simulation chunk {chunk_count} at time {current_time}")
                    
                    # Run simulation for this chunk
                    sim_cmd = [
                        self.vvp_path,
                        "-M", self.ivl_lib_path,
                        os.path.join(temp_dir, "sim"),
                        "-vcd", vcd_path,
                        "-t", str(current_time),
                        "-e", str(current_time + self.chunk_size)
                    ]
                    
                    logger.debug(f"Simulation command: {' '.join(sim_cmd)}")
                    
                    sim_result = subprocess.run(
                        sim_cmd,
                        capture_output=True,
                        text=True,
                        cwd=temp_dir,
                        timeout=self.simulation_timeout
                    )
                    
                    if sim_result.returncode != 0:
                        error_msg = sim_result.stderr.strip()
                        formatted_error = self.format_verilog_error(error_msg, verilog_code, testbench_code)
                        logger.error(f"Simulation failed in chunk {chunk_count}: {formatted_error}")
                        yield {
                            'success': False,
                            'error': formatted_error,
                            'is_complete': True
                        }
                        return
                    
                    # Read the VCD file
                    if os.path.exists(vcd_path):
                        with open(vcd_path, "r") as f:
                            vcd_content = f.read()
                            
                        # Only send the new content since last chunk
                        new_vcd_content = vcd_content[len(last_vcd_content):]
                        last_vcd_content = vcd_content
                        
                        logger.debug(f"Chunk {chunk_count}: Generated {len(new_vcd_content)} bytes of VCD data")
                            
                        # Yield the chunk results
                        yield {
                            'success': True,
                            'output': sim_result.stdout,
                            'waveform_data': new_vcd_content,
                            'time_range': (current_time, current_time + self.chunk_size),
                            'is_complete': False
                        }
                    else:
                        logger.debug(f"Chunk {chunk_count}: No VCD file generated, simulation complete")
                        # No more data, simulation is complete
                        yield {
                            'success': True,
                            'output': sim_result.stdout,
                            'is_complete': True
                        }
                        break
                    
                    current_time += self.chunk_size
                    
                except subprocess.TimeoutExpired:
                    logger.error(f"Simulation chunk {chunk_count} timed out")
                    yield {
                        'success': False,
                        'error': "Simulation timed out. The operation took too long to complete.",
                        'is_complete': True
                    }
                    break
                except Exception as e:
                    logger.error(f"Simulation error in chunk {chunk_count}: {str(e)}")
                    yield {
                        'success': False,
                        'error': f"Simulation error: {str(e)}",
                        'is_complete': True
                    }
                    break
            
            if chunk_count >= self.max_chunks:
                logger.warning(f"Simulation reached maximum chunk limit ({self.max_chunks})")
                yield {
                    'success': False,
                    'error': f"Simulation exceeded maximum time limit ({self.max_chunks * self.chunk_size} time units)",
                    'is_complete': True
                }
                
        except Exception as e:
            logger.error(f"Error in compile_and_simulate: {str(e)}")
            yield {
                'success': False,
                'error': f"Error: {str(e)}",
                'is_complete': True
            }
        finally:
            # Clean up temporary files
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except Exception as e:
                    logger.error(f"Error cleaning up temporary directory: {str(e)}")

    def format_verilog_error(self, error_msg: str, verilog_code: str, testbench_code: str) -> str:
        """Format Verilog error messages to be more readable and helpful."""
        # Split the error message into lines
        error_lines = error_msg.split('\n')
        formatted_lines = []
        
        for line in error_lines:
            # Check if the line contains a file and line number reference
            if ':' in line:
                parts = line.split(':')
                if len(parts) >= 3:
                    file_name = parts[0].strip()
                    line_num = parts[1].strip()
                    error_text = ':'.join(parts[2:]).strip()
                    
                    # Determine if the error is in the design or testbench
                    if file_name == "design.v":
                        code_lines = verilog_code.split('\n')
                        context = "Design"
                    else:
                        code_lines = testbench_code.split('\n')
                        context = "Testbench"
                    
                    try:
                        line_num_int = int(line_num)
                        if 0 <= line_num_int - 1 < len(code_lines):
                            # Add the error line with context
                            formatted_lines.append(f"\n{context} Error at line {line_num}:")
                            formatted_lines.append(f"Error: {error_text}")
                            formatted_lines.append(f"Code: {code_lines[line_num_int - 1].strip()}")
                            continue
                    except ValueError:
                        pass
            
            # If the line doesn't match the pattern, add it as is
            formatted_lines.append(line)
        
        return '\n'.join(formatted_lines)

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
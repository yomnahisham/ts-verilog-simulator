import subprocess
import tempfile
import os
import json
from typing import Dict, List, Optional, Union
from pathlib import Path

class YosysInterface:
    def __init__(self):
        self.yosys_path = "yosys"  # Assuming Yosys is in PATH
        self.temp_dir = tempfile.mkdtemp()
        
    def _run_yosys_command(self, script_content: str) -> Dict:
        """
        Run a Yosys command and return the results.
        
        Args:
            script_content (str): The Yosys script content to execute
            
        Returns:
            Dict: Results from Yosys execution
        """
        # Create a temporary script file
        script_path = os.path.join(self.temp_dir, "yosys_script.ys")
        with open(script_path, "w") as f:
            f.write(script_content)
            
        try:
            # Run Yosys with the script
            result = subprocess.run(
                [self.yosys_path, script_path],
                capture_output=True,
                text=True,
                check=True
            )
            
            return {
                "success": True,
                "output": result.stdout,
                "error": result.stderr
            }
        except subprocess.CalledProcessError as e:
            return {
                "success": False,
                "output": e.stdout,
                "error": e.stderr
            }
            
    def synthesize(self, verilog_code: str, top_module: str) -> Dict:
        """
        Synthesize the given Verilog code.
        
        Args:
            verilog_code (str): The Verilog code to synthesize
            top_module (str): The name of the top module
            
        Returns:
            Dict: Synthesis results
        """
        # Create a temporary Verilog file
        verilog_path = os.path.join(self.temp_dir, "design.v")
        with open(verilog_path, "w") as f:
            f.write(verilog_code)
            
        # Create Yosys script
        script = f"""
        # Read the Verilog file
        read_verilog {verilog_path}
        
        # Set the top module
        hierarchy -top {top_module}
        
        # Basic synthesis
        synth -top {top_module}
        
        # Generate JSON netlist
        write_json {os.path.join(self.temp_dir, "netlist.json")}
        
        # Generate statistics
        stat
        """
        
        # Run synthesis
        result = self._run_yosys_command(script)
        
        if result["success"]:
            # Read the generated netlist
            netlist_path = os.path.join(self.temp_dir, "netlist.json")
            if os.path.exists(netlist_path):
                with open(netlist_path, "r") as f:
                    result["netlist"] = json.load(f)
                    
        return result
        
    def optimize(self, verilog_code: str, top_module: str, optimization_level: int = 2) -> Dict:
        """
        Optimize the given Verilog code.
        
        Args:
            verilog_code (str): The Verilog code to optimize
            top_module (str): The name of the top module
            optimization_level (int): Optimization level (0-3)
            
        Returns:
            Dict: Optimization results
        """
        # Create a temporary Verilog file
        verilog_path = os.path.join(self.temp_dir, "design.v")
        with open(verilog_path, "w") as f:
            f.write(verilog_code)
            
        # Create Yosys script with optimizations
        script = f"""
        # Read the Verilog file
        read_verilog {verilog_path}
        
        # Set the top module
        hierarchy -top {top_module}
        
        # Basic synthesis
        synth -top {top_module}
        
        # Run optimizations
        opt -full
        opt_clean
        opt_expr
        opt_merge
        opt_muxtree
        opt_reduce
        opt_rmdff
        opt_rmunused
        opt_share
        
        # Generate JSON netlist
        write_json {os.path.join(self.temp_dir, "netlist.json")}
        
        # Generate statistics
        stat
        """
        
        # Run optimization
        result = self._run_yosys_command(script)
        
        if result["success"]:
            # Read the generated netlist
            netlist_path = os.path.join(self.temp_dir, "netlist.json")
            if os.path.exists(netlist_path):
                with open(netlist_path, "r") as f:
                    result["netlist"] = json.load(f)
                    
        return result
        
    def analyze(self, verilog_code: str, top_module: str) -> Dict:
        """
        Analyze the given Verilog code.
        
        Args:
            verilog_code (str): The Verilog code to analyze
            top_module (str): The name of the top module
            
        Returns:
            Dict: Analysis results
        """
        # Create a temporary Verilog file
        verilog_path = os.path.join(self.temp_dir, "design.v")
        with open(verilog_path, "w") as f:
            f.write(verilog_code)
            
        # Create Yosys script for analysis
        script = f"""
        # Read the Verilog file
        read_verilog {verilog_path}
        
        # Set the top module
        hierarchy -top {top_module}
        
        # Generate hierarchy information
        hierarchy -generate
        
        # Generate statistics
        stat
        
        # Generate timing information
        synth -top {top_module}
        dfflibmap
        abc -dff
        stat
        """
        
        # Run analysis
        return self._run_yosys_command(script)
        
    def cleanup(self):
        """Clean up temporary files."""
        import shutil
        shutil.rmtree(self.temp_dir) 
import os
from typing import Dict, Any

class Config:
    # Simulation settings
    SIMULATION_TIMEOUT: int = int(os.getenv('SIMULATION_TIMEOUT', '10'))  # seconds
    CHUNK_SIZE: int = int(os.getenv('SIMULATION_CHUNK_SIZE', '1000'))  # time units
    MAX_CHUNKS: int = int(os.getenv('MAX_SIMULATION_CHUNKS', '100'))  # maximum number of chunks
    
    # File paths
    IVERILOG_PATH: str = os.getenv('IVERILOG_PATH', 'iverilog')
    VVP_PATH: str = os.getenv('VVP_PATH', 'vvp')
    IVL_LIB_PATH: str = os.getenv('IVL_LIB_PATH', '/usr/local/lib/ivl')
    
    # VCD settings
    VCD_FILENAME: str = os.getenv('VCD_FILENAME', 'waveform.vcd')
    
    # Logging settings
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    
    @classmethod
    def get_simulation_config(cls) -> Dict[str, Any]:
        """Get all simulation-related configuration values."""
        return {
            'simulation_timeout': cls.SIMULATION_TIMEOUT,
            'chunk_size': cls.CHUNK_SIZE,
            'max_chunks': cls.MAX_CHUNKS,
            'iverilog_path': cls.IVERILOG_PATH,
            'vvp_path': cls.VVP_PATH,
            'ivl_lib_path': cls.IVL_LIB_PATH,
            'vcd_filename': cls.VCD_FILENAME
        } 
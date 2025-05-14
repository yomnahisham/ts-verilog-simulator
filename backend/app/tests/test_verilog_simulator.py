import pytest
import asyncio
from app.services.verilog_simulator import VerilogSimulator
from app.config import Config

@pytest.fixture
def simulator():
    return VerilogSimulator()

@pytest.mark.asyncio
async def test_chunked_simulation(simulator):
    """Test that simulation works in chunks and produces valid VCD output."""
    # Simple counter design
    design = """
    module counter(
        input wire clk,
        input wire rst,
        output reg [3:0] count
    );
        always @(posedge clk or posedge rst) begin
            if (rst)
                count <= 4'b0000;
            else
                count <= count + 1;
        end
    endmodule
    """
    
    # Testbench that runs for multiple chunks
    testbench = """
    module counter_tb;
        reg clk;
        reg rst;
        wire [3:0] count;
        
        counter dut (
            .clk(clk),
            .rst(rst),
            .count(count)
        );
        
        initial begin
            $dumpfile("waveform.vcd");
            $dumpvars(0, counter_tb);
            
            clk = 0;
            rst = 1;
            #10;
            rst = 0;
            
            // Run for enough time to span multiple chunks
            repeat(100) begin
                #5;
                clk = ~clk;
            end
            
            $finish;
        end
    endmodule
    """
    
    # Collect results from the generator
    results = []
    async for result in simulator.compile_and_simulate(design, testbench, "counter", "counter_tb"):
        results.append(result)
    
    # Verify results
    assert len(results) > 0, "Should receive at least one result"
    
    # Check that we got waveform data
    waveform_data = ""
    for result in results:
        if 'waveform_data' in result:
            waveform_data += result['waveform_data']
    
    assert waveform_data, "Should have waveform data"
    assert "$var" in waveform_data, "VCD file should contain signal definitions"
    assert "#" in waveform_data, "VCD file should contain timestamps"
    
    # Check that simulation completed successfully
    assert results[-1]['is_complete'], "Simulation should complete"
    assert results[-1]['success'], "Simulation should succeed"

@pytest.mark.asyncio
async def test_simulation_timeout(simulator):
    """Test that simulation respects timeout limits."""
    # Design that runs indefinitely
    design = """
    module infinite_loop(
        input wire clk,
        output reg out
    );
        always @(posedge clk) begin
            out = ~out;
        end
    endmodule
    """
    
    testbench = """
    module infinite_loop_tb;
        reg clk;
        wire out;
        
        infinite_loop dut (
            .clk(clk),
            .out(out)
        );
        
        initial begin
            $dumpfile("waveform.vcd");
            $dumpvars(0, infinite_loop_tb);
            
            clk = 0;
            forever #5 clk = ~clk;
        end
    endmodule
    """
    
    # Get config values
    config = Config.get_simulation_config()
    max_chunks = config['max_chunks']
    
    # Collect results
    results = []
    async for result in simulator.compile_and_simulate(design, testbench, "infinite_loop", "infinite_loop_tb"):
        results.append(result)
        if result['is_complete']:
            break
    
    # Verify that simulation was limited by max_chunks
    assert len(results) > 0, "Should receive at least one result"
    assert not results[-1]['success'], "Simulation should fail due to timeout"
    assert "exceeded maximum time limit" in results[-1]['error'], "Error should mention time limit"

@pytest.mark.asyncio
async def test_compilation_error(simulator):
    """Test handling of compilation errors."""
    # Invalid Verilog code
    design = """
    module invalid_module(
        input wire clk,
        output reg out
    );
        always @(posedge clk) begin
            out = ~out  // Missing semicolon
        end
    endmodule
    """
    
    testbench = """
    module invalid_module_tb;
        reg clk;
        wire out;
        
        invalid_module dut (
            .clk(clk),
            .out(out)
        );
        
        initial begin
            clk = 0;
            #100 $finish;
        end
    endmodule
    """
    
    # Collect results
    results = []
    async for result in simulator.compile_and_simulate(design, testbench, "invalid_module", "invalid_module_tb"):
        results.append(result)
        if result['is_complete']:
            break
    
    # Verify error handling
    assert len(results) == 1, "Should receive exactly one result for compilation error"
    assert not results[0]['success'], "Compilation should fail"
    assert "error" in results[0], "Should have error message"
    assert results[0]['is_complete'], "Should be marked as complete"

@pytest.mark.asyncio
async def test_simulation_error(simulator):
    """Test handling of simulation errors."""
    # Design with simulation error
    design = """
    module error_module(
        input wire clk,
        output reg out
    );
        always @(posedge clk) begin
            out = 1'bx;  // Will cause simulation error
        end
    endmodule
    """
    
    testbench = """
    module error_module_tb;
        reg clk;
        wire out;
        
        error_module dut (
            .clk(clk),
            .out(out)
        );
        
        initial begin
            $dumpfile("waveform.vcd");
            $dumpvars(0, error_module_tb);
            
            clk = 0;
            #10;
            clk = 1;
            #10;
            $finish;
        end
    endmodule
    """
    
    # Collect results
    results = []
    async for result in simulator.compile_and_simulate(design, testbench, "error_module", "error_module_tb"):
        results.append(result)
        if result['is_complete']:
            break
    
    # Verify error handling
    assert len(results) > 0, "Should receive at least one result"
    assert not results[-1]['success'], "Simulation should fail"
    assert "error" in results[-1], "Should have error message"
    assert results[-1]['is_complete'], "Should be marked as complete" 
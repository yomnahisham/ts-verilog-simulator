import asyncio
from app.services.verilog_simulator import VerilogSimulator

async def test():
    # Create a design with a port mismatch error
    design_code = """
    module test;
        reg a;
        initial begin
            a = 1;
        end
    endmodule
    """
    
    # Create a testbench that tries to connect to a non-existent port
    testbench_code = """
    module test_tb;
        reg clk;
        test dut(clk);  // Error: test module doesn't have a clk port
        
        initial begin
            clk = 0;
            forever #5 clk = ~clk;
        end
    endmodule
    """
    
    simulator = VerilogSimulator()
    success, output, vcd = await simulator.compile_and_simulate(
        design_code,
        testbench_code,
        'test',
        'test_tb'
    )
    
    print("\n=== Test Results ===")
    print("Success:", success)
    print("\nOutput:")
    print(output)
    
    simulator.cleanup()

if __name__ == "__main__":
    asyncio.run(test()) 
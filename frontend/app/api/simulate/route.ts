import { NextResponse } from 'next/server';
import { z } from 'zod';

// Define the request schema using Zod
const SimulationRequestSchema = z.object({
  verilog_code: z.string().min(1, "Verilog code cannot be empty"),
  testbench_code: z.string().min(1, "Testbench code cannot be empty"),
  top_module: z.string().min(1, "Top module name cannot be empty"),
  top_testbench: z.string().min(1, "Top testbench name cannot be empty")
});

// Define the response type
type SimulationResponse = {
  success: boolean;
  output: string;
  waveform_data: string;
};

// Mock simulation function
function mockSimulate(
  verilogCode: string,
  testbenchCode: string,
  topModule: string,
  topTestbench: string
): SimulationResponse {
  // Simulate processing time
  const output = `Mock simulation of ${topModule} with testbench ${topTestbench}\nSimulation completed successfully\n`;
  
  // Generate mock waveform data
  const waveformData = `$date
    Date text. For example: June 26, 1989 10:05:41
$end
$version
    VCD generator version info
$end
$timescale
    1s
$end
$scope module top $end
$var wire 1 ! clk $end
$var wire 1 " rst $end
$var wire 8 # data $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
0!
0"`;

  return {
    success: true,
    output,
    waveform_data: waveformData
  };
}

export async function POST(request: Request) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = SimulationRequestSchema.parse(body);

    // Run the simulation
    const result = mockSimulate(
      validatedData.verilog_code,
      validatedData.testbench_code,
      validatedData.top_module,
      validatedData.top_testbench
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
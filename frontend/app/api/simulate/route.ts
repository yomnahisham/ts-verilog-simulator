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

// Backend configuration
const BACKEND_BASE_URL = 'https://ts-verilog-simulator-backend.onrender.com';
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api/v1`;

// Real simulation function that calls the backend
async function simulateVerilog(
  verilogCode: string,
  testbenchCode: string,
  topModule: string,
  topTestbench: string
): Promise<SimulationResponse> {
  const response = await fetch(`${BACKEND_API_URL}/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      verilog_code: verilogCode,
      testbench_code: testbenchCode,
      top_module: topModule,
      top_testbench: topTestbench
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || `Simulation failed: ${response.statusText}`);
  }

  return await response.json();
}

export async function POST(request: Request) {
  try {
    // Parse and validate the request body
    const body = await request.json();
    const validatedData = SimulationRequestSchema.parse(body);

    // Run the simulation using the backend
    const result = await simulateVerilog(
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
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 
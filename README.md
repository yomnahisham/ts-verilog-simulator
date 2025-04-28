# Verilog Make

A modern web-based alternative to Vivado for Verilog simulation and testing. This project provides a user-friendly interface for digital design students and professionals who need access to Verilog simulation tools without installing complex software.

## Features

- **Modern Web-Based IDE**: Edit Verilog code with syntax highlighting and code completion
- **Integrated Simulation**: Run Verilog simulations directly in your browser
- **Waveform Visualization**: View simulation results with an interactive waveform viewer
- **Testbench Management**: Create and manage testbenches for your designs
- **Module Detection**: Automatically detect modules in your Verilog code
- **Real-time Feedback**: Get immediate feedback on simulation results

## Tech Stack

- **Frontend**: Next.js with TypeScript, Monaco Editor, and custom waveform viewer
- **Backend**: Python FastAPI server
- **Verilog Simulator**: Icarus Verilog (iverilog)
- **Waveform Format**: VCD (Value Change Dump)

## Project Structure

```
vivado-make/
├── frontend/           # Next.js frontend application
│   ├── app/            # Next.js app directory
│   │   ├── components/ # React components
│   │   ├── design/     # Design editor page
│   │   ├── testbench/  # Testbench editor page
│   │   └── simulation/ # Simulation page
│   └── public/         # Static assets
└── backend/            # Python FastAPI backend
    ├── app/            # Application code
    │   ├── api/        # API endpoints
    │   └── services/   # Business logic
    └── test/           # Test files
```

## Setup Instructions

1. Install dependencies:
   ```bash
   # Frontend
   cd frontend
   npm install

   # Backend
   cd backend
   pip install -r requirements.txt
   ```

2. Install Icarus Verilog:
   ```bash
   # macOS
   brew install icarus-verilog

   # Ubuntu/Debian
   sudo apt-get install iverilog
   ```

3. Start the development servers:
   ```bash
   # Frontend
   cd frontend
   npm run dev

   # Backend
   cd backend
   uvicorn app.main:app --reload
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Using Verilog Make

1. **Create Design Files**: Write your Verilog design in the design editor
2. **Create Testbenches**: Write testbenches for your designs
3. **Add VCD Commands**: Include these commands in your testbench:
   ```verilog
   // 1) Tell the simulator where to write the VCD:
   $dumpfile("waveform.vcd");
   // 2) Dump all signals in this testbench and below:
   $dumpvars(0, your_testbench_module_name);
   ```
4. **Run Simulation**: Select your top module and testbench, then click "Run Simulation"
5. **View Results**: Examine the waveform viewer to analyze your simulation results

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License 
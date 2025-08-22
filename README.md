# Verilog Simulator (Vivado-Make)

A modern, web-based Verilog simulator that empowers students and professionals to write, compile, and simulate Verilog code directly in the browser—no local toolchain required. Ideal for education, prototyping, and collaborative development.

## Project Overview

Verilog Simulator (AKA Vivado-Make) replaces heavyweight, licensed EDA tools with a lightweight, accessible web alternative. Key highlights:

- **Browser-Based**: Write and run Verilog and SystemVerilog testbenches in your browser
- **Zero Setup**: No local installation—just open the URL and start coding
- **Scalable Backend**: Containerized FastAPI service running Icarus Verilog for compilation and simulation
- **Interactive UI**: Real-time syntax checking, waveform viewer, and code validation inspired by VS Code

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS, Monaco Editor |
| Backend | Python 3.11, FastAPI, Icarus Verilog (iverilog, vvp), Docker |
| Deployment | Vercel (frontend), Render (backend) |
| Visualization | Custom waveform viewer based on VCD parsing |

## Project Structure

```
.
├── frontend/           # Next.js frontend application
│   ├── src/           # Source code
│   ├── app/           # Next.js app directory
│   └── public/        # Static assets
├── backend/           # FastAPI backend service
│   ├── app/          # Application code
│   └── test/         # Test suite
├── Dockerfile        # Backend container configuration
└── render.yaml       # Render deployment configuration
```

## Key Features

### Current
- **Real-Time Simulation**: Compile & simulate modules and testbenches on-the-fly
- **Waveform Viewer**: Interactive VCD waveform plot with zoom, pan, and cursor
- **Syntax Highlighting**: Monaco Editor integration for Verilog/SystemVerilog
- **Auto Module Detection**: Discover module and testbench entries automatically
- **Error Reporting**: Inline compiler errors linked to source code lines
- **Responsive Design**: Mobile and tablet support for on-the-go access
- **Serverless Frontend**: Hosted on Vercel for zero-maintenance scalability

### Upcoming
- **Collaborative Coding**: Real-time multi-user editing and shared simulation sessions
- **Advanced Waveform Tools**: Signal markers, measurement cursors, and export options
- **AI-Assisted Testbenches**: Generate testbench scaffolds with GPT-based prompts

## Getting Started

### Online Demo
Access the live demo at: [https://ts-verilog-simulator-frontend.vercel.app](https://ts-verilog-simulator-frontend.vercel.app)

### Local Development

#### Prerequisites
- Node.js v18+
- Python 3.11
- Docker (optional)
- Icarus Verilog (iverilog)

#### Clone & Setup
```bash
git clone https://github.com/yomnahisham/ts-verilog-simulator.git
cd ts-verilog-simulator
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```
URL: http://localhost:3000

#### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```
API: http://localhost:8001

### Docker Deployment
```bash
docker build -t verilog-sim-backend backend/
docker run -p 8001:8001 verilog-sim-backend
```

## Usage Guide

1. **Create Design**: Write your Verilog/SystemVerilog code in the editor
2. **Add Testbench**: Author or generate a testbench module
3. **Select Top Modules**: Choose DUT and testbench in the dropdown
4. **Run Simulation**: Hit Run and watch the console & waveform viewer
5. **Analyze Results**: Inspect signals, debug errors, and iterate

### Example Testbench
```verilog
module example_tb;
  reg clk = 0;
  reg rst_n;
  wire [3:0] q;

  example dut (
    .clk(clk),
    .rst_n(rst_n),
    .count(q)
  );

  // Clock generator
  always #5 clk = ~clk;

  initial begin
    rst_n = 0;
    $dumpfile("waveform.vcd");
    $dumpvars(0, example_tb);
    #20 rst_n = 1;
    #100;
    $finish;
  end
endmodule
```
Note:- It is important that you include the following to be able to actually see the resulting waveform.
```verilog
$dumpfile("output_waveform_name.vcd");
$dumpvars(0, your_testbench_name);
```

## Contributing

Contributions are welcome! Please feel free to submit an Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 

## Acknowledgments

- [Icarus Verilog](http://iverilog.icarus.com/) for the Verilog simulation engine
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the code editor
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [Next.js](https://nextjs.org/) for the frontend framework

### Loved working on this project fr!

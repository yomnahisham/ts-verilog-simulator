# Vivado-Make: A Modern Web-Based Verilog Simulator

Vivado-Make is a modern, web-based alternative to Vivado for Verilog simulation. It provides a user-friendly interface for designing, simulating, and visualizing Verilog code without the need for expensive licenses or complex installations.

## Features

### Current Features

- **Modern Web Interface**: Clean, intuitive UI inspired by VS Code for a familiar development experience
- **Real-time Verilog Simulation**: Run simulations directly in your browser
- **Waveform Visualization**: View simulation results in an interactive waveform viewer
- **Syntax Highlighting**: Advanced Verilog syntax highlighting with Monaco Editor
- **Module Detection**: Automatic detection of modules and testbenches in your code
- **Responsive Design**: Works on desktop and tablet devices
- **Serverless Architecture**: Deployed on Vercel for high availability and scalability
- **Cross-Platform**: Works on any device with a modern web browser
- **No Installation Required**: Access your Verilog projects from anywhere

### Coming Soon

- **Collaborative Coding**: Real-time collaboration features for team-based development
- **Project Management**: Save and organize your Verilog projects
- **Version Control**: Track changes to your Verilog code
- **Advanced Waveform Analysis**: More powerful waveform visualization tools
- **SystemVerilog Support**: Enhanced support for SystemVerilog features
- **Custom Testbench Generation**: AI-assisted testbench creation
- **Performance Optimization**: Improved simulation performance for complex designs
- **Export Options**: Export waveforms and simulation results in various formats

## Getting Started

### Online Demo

Visit our [live demo](https://ts-verilog-simulator-frontend.vercel.app) to try Vivado-Make without any installation.

### Local Development

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, Monaco Editor
- **Backend**: FastAPI, Python, Icarus Verilog
- **Deployment**: Vercel, AWS Lambda
- **Simulation Engine**: Icarus Verilog (iverilog, vvp)
- **Waveform Visualization**: Custom implementation

## Usage Guide

1. **Create Your Design**: Write your Verilog design code in the editor
2. **Create a Testbench**: Write a testbench to simulate your design
3. **Select Modules**: Choose your top module and testbench module
4. **Run Simulation**: Click "Run Simulation" to execute
5. **View Results**: Analyze the waveform and simulation output

### Example Testbench

```verilog
module example_tb;
  reg clk;
  reg rst_n;
  wire [3:0] q;
  
  // Instantiate the design under test
  example dut (
    .clk(clk),
    .rst(rst_n),
    .count(q)
  );
  
  // Clock generation
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end
  
  // Test stimulus
  initial begin
    // Initialize inputs
    rst_n = 0;
    
    // Add VCD dump commands
    $dumpfile("waveform.vcd");
    $dumpvars(0, example_tb);
    
    // Reset sequence
    #20 rst_n = 1;
    
    // Test sequence
    #100;
    
    // End simulation
    #100 $finish;
  end
endmodule
```

## Configuration

### Environment Variables

- `NEXT_PUBLIC_BACKEND_URL`: URL of the backend API (default: `http://localhost:8001`)
- `CORS_ORIGINS`: Allowed origins for CORS (default: `http://localhost:3000,https://ts-verilog-simulator-frontend.vercel.app`)

## Deployment

### Backend (Vercel)

```bash
cd backend
vercel
```

### Frontend (Vercel)

```bash
cd frontend
vercel
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Icarus Verilog](http://iverilog.icarus.com/) for the Verilog simulation engine
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) for the code editor
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [Next.js](https://nextjs.org/) for the frontend framework

## Contact

For questions or feedback, please open an issue on our [GitHub repository](https://github.com/yomnahisham/ts-verilog-simulator). 
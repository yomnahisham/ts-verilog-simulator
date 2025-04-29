# Verilog Make

A modern web-based Verilog simulator with a clean, VS Code-like interface. This project provides a user-friendly environment for digital design students and professionals to write, simulate, and debug Verilog code directly in the browser.

## Features

- **Modern Web IDE**: VS Code-like interface with dark theme and intuitive controls
- **Real-time Verilog Editing**: 
  - Syntax highlighting
  - Multi-file support
  - Tab-based file management
  - Line numbers and cursor position tracking
- **Intelligent Module Detection**: 
  - Automatic detection of modules and testbenches
  - Support for manual module/testbench registration
  - Real-time module scanning as you type
- **Integrated Simulation**: 
  - One-click simulation execution
  - Real-time simulation status updates
  - Comprehensive error reporting
  - Automatic testbench validation
- **Interactive Waveform Viewer**:
  - Real-time waveform display
  - Zoom in/out functionality
  - Pan left/right navigation
  - Fit to view option
  - Signal collapse/expand support
- **Backend Health Monitoring**:
  - Real-time backend connection status
  - Automatic health checks
  - Visual status indicators

## Tech Stack

- **Frontend**:
  - Next.js 14 with TypeScript
  - Monaco Editor for code editing
  - Custom waveform viewer component
  - Tailwind CSS for styling
- **Backend**:
  - Python FastAPI server
  - Icarus Verilog (iverilog) for simulation
  - VCD (Value Change Dump) for waveform data

## Project Structure

```
vivado-make/
├── frontend/           # Next.js frontend application
│   ├── app/           # Next.js app directory
│   │   ├── components/# React components
│   │   └── simulation/# Main simulation page
│   └── public/        # Static assets
└── backend/           # Python FastAPI backend
    ├── app/           # Application code
    │   ├── api/       # API endpoints
    │   └── services/  # Simulation services
    └── test/          # Test files and examples
```

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/yomnahisham/ts-verilog-simulator.git
   cd vivado-make
   ```

2. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Install Icarus Verilog:
   ```bash
   # macOS
   brew install icarus-verilog

   # Ubuntu/Debian
   sudo apt-get install iverilog

   # Windows
   # Download installer from http://bleyer.org/icarus/
   ```

5. Start the development servers:

   In one terminal (frontend):
   ```bash
   cd frontend
   npm run dev
   ```

   In another terminal (backend):
   ```bash
   cd backend
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   PYTHONPATH=$PYTHONPATH:. uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Using Verilog Make

1. **Create Design Files**:
   - Click the "+" button in the editor tab bar
   - Enter a filename (e.g., "counter.v")
   - Write your Verilog module code

2. **Create Testbench**:
   - Create a new file for your testbench
   - Include the necessary VCD commands:
     ```verilog
     initial begin
       $dumpfile("waveform.vcd");
       $dumpvars(0, your_testbench_module_name);
       // ... rest of your testbench code
     end
     ```

3. **Run Simulation**:
   - Select your design module from the "Top Module" dropdown
   - Select your testbench from the "Top Testbench" dropdown
   - Click "Run Simulation"
   - View simulation output and waveforms in the right panel

4. **Analyze Waveforms**:
   - Use zoom controls to examine signals
   - Pan left/right to navigate the timeline
   - Collapse/expand signal groups
   - Click "Fit to View" to see the entire simulation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License 
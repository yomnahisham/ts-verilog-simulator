const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Check if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

// Start the FastAPI backend as a child process
let backendProcess;
if (isProduction) {
  // In production, we need to use the correct Python path
  const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
  const venvPath = path.join(__dirname, 'backend', 'venv');
  const pythonExecutable = path.join(venvPath, 'bin', 'python');
  
  // Check if the virtual environment exists
  if (fs.existsSync(venvPath)) {
    console.log('Using existing virtual environment');
    backendProcess = spawn(pythonExecutable, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8001'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
      shell: true
    });
  } else {
    console.log('Creating virtual environment and installing dependencies');
    // Create virtual environment and install dependencies
    const venvCreate = spawn(pythonPath, ['-m', 'venv', venvPath], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'inherit',
      shell: true
    });
    
    venvCreate.on('close', (code) => {
      if (code === 0) {
        const pipPath = path.join(venvPath, 'bin', 'pip');
        const installDeps = spawn(pipPath, ['install', '-r', 'requirements.txt'], {
          cwd: path.join(__dirname, 'backend'),
          stdio: 'inherit',
          shell: true
        });
        
        installDeps.on('close', (code) => {
          if (code === 0) {
            backendProcess = spawn(pythonExecutable, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8001'], {
              cwd: path.join(__dirname, 'backend'),
              stdio: 'inherit',
              shell: true
            });
          }
        });
      }
    });
  }
} else {
  // In development mode
  backendProcess = spawn('python', ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8001'], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true
  });
}

// Proxy API requests to the backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve static files from the Next.js build
app.use(express.static(path.join(__dirname, 'frontend/out')));

// Handle all other routes by serving the Next.js app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/out/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Backend API available at http://localhost:${PORT}/api`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  if (backendProcess) {
    backendProcess.kill();
  }
  process.exit(0);
}); 
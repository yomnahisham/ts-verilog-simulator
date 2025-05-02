#!/bin/bash

# Make the script executable
chmod +x vercel-build.sh

# Print environment information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"
echo "Python version: $(python --version)"

# Install system dependencies
echo "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y iverilog

# Verify installation
echo "Verifying iverilog installation..."
which iverilog
iverilog --version

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Print installed packages
echo "Installed Python packages:"
pip list

# Create a simple test file to verify the environment
echo "Creating test file..."
echo 'print("Hello from Vercel build script")' > test.py
python test.py

echo "Build script completed successfully." 
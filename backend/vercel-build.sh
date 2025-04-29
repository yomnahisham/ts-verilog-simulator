#!/bin/bash

# Exit on error
set -e

# Print environment information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"
echo "Python version: $(python --version)"

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
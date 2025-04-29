#!/bin/bash

# Exit on error
set -e

# Print environment information
echo "Current directory: $(pwd)"
echo "Directory contents: $(ls -la)"
echo "Python version: $(python3.9 --version)"

# Create and activate virtual environment
echo "Creating virtual environment..."
python3.9 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Print installed packages
echo "Installed Python packages:"
pip list

# Test the application
echo "Testing the application..."
python -c "from app.main import app; print('FastAPI app imported successfully')"

echo "Build script completed successfully." 
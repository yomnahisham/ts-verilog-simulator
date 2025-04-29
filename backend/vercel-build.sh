#!/bin/bash

# Install system dependencies
apt-get update
apt-get install -y iverilog

# Install Python dependencies
pip install -r requirements.txt

# Make the script executable
chmod +x vercel-build.sh 
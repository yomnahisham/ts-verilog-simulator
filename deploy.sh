#!/bin/bash

# Ensure we're in the project root
cd "$(dirname "$0")"

# Create static directory if it doesn't exist
mkdir -p backend/static

# Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install

# Build frontend
npm run build

echo "Deployment preparation complete!"
echo "You can now deploy to Render using the render.yaml configuration." 
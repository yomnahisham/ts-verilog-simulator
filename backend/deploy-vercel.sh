#!/bin/bash

# Exit on error
set -e

# Change to frontend directory
cd ../frontend

# Install dependencies
echo "Installing dependencies..."
npm install

# Set environment variables
echo "Setting environment variables..."
export NODE_ENV=production
export NEXT_PUBLIC_BACKEND_URL=/api

# Build the application
echo "Building the application..."
npm run build

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

echo "Deployment completed successfully!" 
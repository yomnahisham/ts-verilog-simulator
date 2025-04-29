#!/bin/bash

# Exit on error
set -e

# Change to backend directory
cd "$(dirname "$0")"

# Install Vercel CLI if not already installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Set environment variables
echo "Setting environment variables..."
export VERCEL_ORG_ID="your-org-id"  # Replace with your Vercel org ID
export VERCEL_PROJECT_ID="your-project-id"  # Replace with your project ID

# Deploy to Vercel
echo "Deploying backend to Vercel..."
vercel --prod

echo "Backend deployment completed successfully!" 
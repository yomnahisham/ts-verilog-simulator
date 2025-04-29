#!/bin/bash

# Exit on error
set -e

# Check if AWS credentials are configured
if ! aws configure list &> /dev/null; then
    echo "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Change to frontend directory
cd ../frontend

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Building the application..."
npm run build

# Initialize Amplify if not already initialized
if [ ! -d "../amplify" ]; then
    echo "Initializing Amplify..."
    cd ..
    amplify init
    cd frontend
fi

# Push the changes to AWS
echo "Pushing changes to AWS..."
cd ..
amplify push --yes

# Deploy the application
echo "Deploying the application..."
amplify publish --yes

echo "Deployment completed successfully!" 
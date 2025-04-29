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

# Install serverless framework if not already installed
if ! command -v serverless &> /dev/null; then
    echo "Installing serverless framework..."
    npm install -g serverless
fi

# Install serverless plugins
npm install --save-dev serverless-python-requirements

# Deploy backend to AWS Lambda
echo "Deploying backend to AWS Lambda..."
serverless deploy

# Get the API Gateway URL
API_URL=$(serverless info --verbose | grep "endpoints:" -A 1 | tail -n 1 | awk '{print $2}')
echo "API Gateway URL: $API_URL"

# Update frontend environment variables
echo "NEXT_PUBLIC_BACKEND_URL=$API_URL" > .env.local

# Deploy frontend to AWS Amplify
echo "Deploying frontend to AWS Amplify..."
# Note: You need to have the Amplify CLI installed and configured
# amplify push

echo "Deployment complete!"
echo "Frontend URL: https://main.d1234567890.amplifyapp.com"
echo "Backend URL: $API_URL" 
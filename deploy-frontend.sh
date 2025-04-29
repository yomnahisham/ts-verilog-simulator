#!/bin/bash

# Get the API Gateway URL from the SAM deployment
API_URL=$(aws cloudformation describe-stacks --stack-name verilog-simulator-backend --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

if [ -z "$API_URL" ]; then
  echo "Error: Could not find API Gateway URL. Make sure the backend deployment was successful."
  exit 1
fi

echo "API Gateway URL: $API_URL"

# Create .env.production file in the frontend directory
cat > frontend/.env.production << EOF
NEXT_PUBLIC_BACKEND_URL=$API_URL
EOF

echo "Updated frontend/.env.production with API Gateway URL"

# Build the frontend
cd frontend
npm run build

echo "Frontend built successfully. You can now deploy to AWS Amplify."
echo "To deploy to AWS Amplify:"
echo "1. Go to the AWS Amplify console"
echo "2. Connect your GitHub repository"
echo "3. Configure the build settings using the amplify.yml file"
echo "4. Set the environment variable NEXT_PUBLIC_BACKEND_URL to: $API_URL" 
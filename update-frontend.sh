#!/bin/bash

# Get the API Gateway URL from the SAM deployment
API_URL=$(aws cloudformation describe-stacks --stack-name verilog-simulator-backend --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

if [ -z "$API_URL" ]; then
  echo "Error: Could not find API Gateway URL. Make sure the deployment was successful."
  exit 1
fi

echo "API Gateway URL: $API_URL"

# Create .env.local file in the frontend directory
cat > frontend/.env.local << EOF
NEXT_PUBLIC_BACKEND_URL=$API_URL
EOF

echo "Updated frontend/.env.local with API Gateway URL"

# Start the frontend development server
cd frontend
npm run dev 
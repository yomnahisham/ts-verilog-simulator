# Verilog Simulator

A modern web-based alternative to Vivado for Verilog simulation.

## Project Structure

- `frontend/`: Next.js frontend application
- `backend/`: Python FastAPI backend application

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## AWS Deployment

### Backend (AWS Lambda)

1. Install AWS SAM CLI:
   ```bash
   brew install aws-sam-cli  # On macOS
   ```

2. Configure AWS credentials:
   ```bash
   aws configure
   ```

3. Deploy the backend:
   ```bash
   cd backend
   sam build
   sam deploy --guided
   ```
   When prompted, enter:
   - Stack Name: `verilog-simulator-backend`
   - AWS Region: Choose your preferred region
   - Confirm changes before deploy: `y`
   - Allow SAM CLI IAM role creation: `y`
   - Save arguments to samconfig.toml: `y`

4. After deployment, note the API Gateway URL.

### Frontend (AWS Amplify)

1. Update the frontend configuration with the API Gateway URL:
   ```bash
   ./update-frontend.sh  # For local development
   ./deploy-frontend.sh  # For production deployment
   ```

2. Deploy to AWS Amplify:
   - Go to the AWS Amplify console
   - Connect your GitHub repository
   - Configure the build settings using the `amplify.yml` file
   - Set the environment variable `NEXT_PUBLIC_BACKEND_URL` to your API Gateway URL

## Environment Variables

- `NEXT_PUBLIC_BACKEND_URL`: URL of the backend API (default: `http://localhost:8001`)

## License

MIT 
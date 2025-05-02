FROM python:3.11-slim

# Install system dependencies including iverilog
RUN apt-get update && apt-get install -y \
    iverilog \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY backend/ ./backend/

# Set environment variables
ENV PYTHONPATH=/app
ENV PORT=10000

# Expose the port
EXPOSE $PORT

# Verify iverilog installation
RUN which iverilog && iverilog -v

# Run the application
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "10000"] 
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
ENV PYTHONPATH=/app/backend
ENV PORT=10000

# Expose the port
EXPOSE $PORT

# Verify iverilog installation with a test file
RUN echo "module test; initial begin \$display(\"Hello, World!\"); \$finish; end endmodule" > test.v && \
    iverilog -o test test.v && \
    vvp test

# Run the application
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"] 
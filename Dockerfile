FROM python:3.11-slim

# Install system dependencies including iverilog and verilator
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    iverilog \
    verilator \
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

# Verify installations with test files
RUN echo "module test; initial begin \$display(\"Hello, World!\"); \$finish; end endmodule" > test.v && \
    iverilog -o test test.v && \
    vvp test && \
    rm test.v test && \
    echo "module test; endmodule" > test.v && \
    verilator --lint-only test.v && \
    rm test.v

# Run the application
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"] 
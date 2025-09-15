FROM python:3.11-slim

# Install system dependencies including iverilog and FPGA tools
RUN apt-get update && apt-get install -y \
    iverilog \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    python3-dev \
    python3-pip \
    libffi-dev \
    libssl-dev \
    libreadline-dev \
    libsqlite3-dev \
    libbz2-dev \
    libncurses5-dev \
    libgdbm-dev \
    liblzma-dev \
    tk-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    libffi-dev \
    libssl-dev \
    libreadline-dev \
    libsqlite3-dev \
    libbz2-dev \
    libncurses5-dev \
    libgdbm-dev \
    liblzma-dev \
    tk-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    libusb-1.0-0-dev \
    libftdi1-dev \
    libftdi1-2 \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install F4PGA toolchain (optional - continue build even if this fails)
RUN echo "Installing F4PGA toolchain..." && \
    for i in 1 2 3; do \
        if git clone --recursive https://github.com/chipsalliance/f4pga-arch-defs.git /opt/f4pga-arch-defs; then \
            echo "F4PGA clone successful on attempt $i"; \
            break; \
        else \
            echo "F4PGA clone attempt $i failed, retrying in 5 seconds..."; \
            sleep 5; \
            rm -rf /opt/f4pga-arch-defs; \
        fi; \
    done && \
    if [ -d "/opt/f4pga-arch-defs" ]; then \
        cd /opt/f4pga-arch-defs && \
        if make env && make env; then \
            echo "F4PGA toolchain installed successfully"; \
        else \
            echo "F4PGA toolchain build failed, continuing without it"; \
        fi; \
    else \
        echo "F4PGA toolchain installation failed, continuing without it"; \
        mkdir -p /opt/f4pga-arch-defs/build/env/bin; \
    fi

# Install FPGA Open Loader (optional - continue build even if this fails)
RUN echo "Installing openFPGALoader..." && \
    for i in 1 2 3; do \
        if git clone https://github.com/trabucayre/openFPGALoader.git /opt/openFPGALoader; then \
            echo "openFPGALoader clone successful on attempt $i"; \
            break; \
        else \
            echo "openFPGALoader clone attempt $i failed, retrying in 5 seconds..."; \
            sleep 5; \
            rm -rf /opt/openFPGALoader; \
        fi; \
    done && \
    if [ -d "/opt/openFPGALoader" ]; then \
        cd /opt/openFPGALoader && \
        mkdir build && \
        cd build && \
        if cmake .. && make -j$(nproc) && make install; then \
            echo "openFPGALoader installed successfully"; \
        else \
            echo "openFPGALoader build failed, continuing without it"; \
        fi; \
    else \
        echo "openFPGALoader installation failed, continuing without it"; \
    fi

# Add F4PGA tools to PATH (if available)
ENV PATH="/opt/f4pga-arch-defs/build/env/bin:${PATH}"

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
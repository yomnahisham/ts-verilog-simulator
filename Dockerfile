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
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install F4PGA toolchain
RUN git clone --recursive https://github.com/chipsalliance/f4pga-arch-defs.git /opt/f4pga-arch-defs && \
    cd /opt/f4pga-arch-defs && \
    make env && \
    make env

# Install FPGA Open Loader
RUN git clone https://github.com/trabucayre/openFPGALoader.git /opt/openFPGALoader && \
    cd /opt/openFPGALoader && \
    mkdir build && \
    cd build && \
    cmake .. && \
    make -j$(nproc) && \
    make install

# Add F4PGA tools to PATH
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
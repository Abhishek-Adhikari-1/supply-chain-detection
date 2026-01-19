# Supply Chain Guardian - Sandbox Environment
# Isolated container for testing suspicious packages

FROM python:3.10-slim

# Install Node.js for testing npm packages
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    strace \
    tcpdump \
    iptables \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user (non-root for security)
RUN useradd -m -s /bin/bash sandbox && \
    mkdir -p /sandbox/package /sandbox/logs /sandbox/results && \
    chown -R sandbox:sandbox /sandbox

# Install monitoring tools
COPY requirements-sandbox.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements-sandbox.txt

# Copy monitoring scripts
COPY network_monitor.py /sandbox/
COPY file_monitor.py /sandbox/
COPY sandbox_runner.py /sandbox/
COPY behavior_analyzer.py /sandbox/

# Set working directory
WORKDIR /sandbox

# Switch to sandbox user
USER sandbox

# Default command: wait for execution
CMD ["python", "/sandbox/sandbox_runner.py"]

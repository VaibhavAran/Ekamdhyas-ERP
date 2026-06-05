# Base image with Python 3.10 Bookworm
FROM python:3.10-slim-bookworm

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install native dependencies required for compiling dlib, insightface, and running OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    curl \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy Python requirements first
COPY ai/requirements.txt ./ai/requirements.txt

# Step-wise Python package installation:
# 1. Install numpy first (insightface's compilation setup script imports numpy to compile)
RUN pip3 install --no-cache-dir numpy==2.2.0

# 2. Install the rest of the python requirements
RUN pip3 install --no-cache-dir -r ai/requirements.txt

# Pre-download the InsightFace face detection model (buffalo_l) during the build stage.
# This prevents downloading model files on container startup, making it fast and offline-resilient.
RUN python3 -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1)"

# Copy Node.js dependency manifests and install packages
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the project source files
COPY . .

# Set default environment variables
# AI_PYTHON_PATH instructs the server.ts sidecar launcher to use system python3 instead of local .venv
ENV PORT=5000
ENV AI_HOST=127.0.0.1
ENV AI_PORT=8000
ENV AI_PYTHON_PATH=python3

# Expose Node.js (5000) and Python AI service (8000) ports
EXPOSE 5000 8000

# Start Node.js backend by default (it will automatically launch Python AI service if AI_HOST is 127.0.0.1)
CMD ["npm", "start"]

FROM python:3.10-slim

# Install system dependencies for OpenCV and YOLO
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    git \
    wget \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Setup non-root user required by Hugging Face Spaces
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy requirements.txt first to leverage Docker cache
COPY --chown=user:user requirements.txt .

# Install python requirements (excluding MPS-only packages if any)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download YOLOv8 nano model so it's cached in the Docker image
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy the rest of the project files
COPY --chown=user:user . .

# Fix the symlink for model weights inside the Docker container
RUN rm -rf runs/detect/train && \
    if [ -d "runs/detect/runs/detect/train" ]; then \
        cp -r runs/detect/runs/detect/train runs/detect/train; \
    fi

# Expose port 7860 (Hugging Face Spaces default port)
EXPOSE 7860

# Run the application with uvicorn, binding to port 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]

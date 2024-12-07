# Use the official Node.js image as the base image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Install FFmpeg, Python, and required tools
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a Python virtual environment
RUN python3 -m venv /env

# Install ONNX Runtime within the virtual environment
RUN /env/bin/pip install onnxruntime

# Copy package.json and package-lock.json for installing dependencies
COPY package.json package-lock.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port Next.js runs on
EXPOSE 3000

# Set the command to start the Next.js application
CMD ["npm", "start"]

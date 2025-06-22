# Use official Node 18 image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install dependencies before copying app code
RUN npm install && npm install -g nodemon

# Install Python tools (if needed by your app)
RUN apt-get update && apt-get install -y python3 python3-pip

# Copy app code
COPY . .

# Expose user service port
EXPOSE 4004

# Default start command
CMD ["npm", "run", "dev"]

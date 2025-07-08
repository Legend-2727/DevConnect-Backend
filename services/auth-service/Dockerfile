# Use Node base image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Create app user to avoid running as root
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code and set permissions
COPY . .
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port (match your .env or server.js)
EXPOSE 4000

# Start the service
CMD ["npm", "run", "dev"]

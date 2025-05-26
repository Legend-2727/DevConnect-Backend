# Use Node base image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code
COPY . .

# Expose port (match your .env or server.js)
EXPOSE 4000

# Start the service
CMD ["npm", "start"]

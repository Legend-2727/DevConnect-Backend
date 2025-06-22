# ✅ Use full Node image (for native tools/dev compatibility)
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./

# Install deps and dev tools
RUN npm install && npm install -g nodemon

# Install python if needed
RUN apt-get update && apt-get install -y python3 python3-pip

# Copy source code
COPY . .

# Expose service port
EXPOSE 4002

# Start dev server (like nodemon src/server.js)
CMD ["npm", "run", "dev"]

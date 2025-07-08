FROM node:18

WORKDIR /app

# Create app user to avoid running as root
RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY package*.json ./
RUN npm install -g nodemon && npm install

COPY . .
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 4004
CMD ["npm", "run", "dev"]

# Use official Node.js LTS image
FROM node:18-slim

# Set working directory
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json first (better caching)
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the source code
COPY . .

# Expose port (Cloud Run injects PORT env var)
EXPOSE 8080

# Set environment variable for production
ENV NODE_ENV=production

# Start the app
CMD ["node", "server.js"]

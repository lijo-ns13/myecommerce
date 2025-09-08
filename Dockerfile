
# Use a small official Node.js LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json first
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy only the rest of the app
COPY . .

# Expose the port the app will run on
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production

# Run the app
CMD ["node", "server.js"]

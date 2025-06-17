# Use Node.js 18 Alpine image  
FROM node:18-alpine

# Set working directory to match Railway's structure
WORKDIR /app

# Copy everything (Railway copies the entire repo)
COPY . .

# Change to the backend directory and install dependencies
WORKDIR /app/loopin-backend
RUN npm install --only=production

# Expose port
EXPOSE 5000

# Start the application (we're already in /app/loopin-backend)
CMD ["npm", "start"] 
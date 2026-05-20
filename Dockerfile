# Use Node.js 22 alpine as base image
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy client package files
COPY client/package*.json ./client/

# Install client dependencies
RUN cd client && npm ci

# Copy all source code
COPY . .

# Build client
RUN cd client && npm run build

# Final image
FROM node:22-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install root dependencies (including devDeps for tsx)
RUN npm ci

# Copy built client
COPY --from=builder /app/client/dist ./client/dist

# Copy backend source code
COPY src ./src
COPY swagger.yaml ./
COPY drizzle.config.ts ./
COPY drizzle ./drizzle

# Expose the port
EXPOSE 3000

# Run the application
CMD ["npm", "start"]

# Multi-stage build for Cnidaria Admin Curve Tool (Next.js)
# Stage 1: Build the Next.js application
FROM node:20 as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.js ./

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Start the application
CMD ["npm", "start"]

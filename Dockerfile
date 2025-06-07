# Build stage
FROM --platform=$BUILDPLATFORM node:23-alpine as build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM --platform=$TARGETPLATFORM nginx:alpine

# Copy built files from build stage to nginx serve directory
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config if needed
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add runtime environment variable support
# COPY docker-entrypoint.sh /
# RUN chmod +x /docker-entrypoint.sh

# Expose the port the app runs on
EXPOSE 8002

# Command to run the application
CMD ["npm", "start"]
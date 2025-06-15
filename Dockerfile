FROM --platform=$TARGETPLATFORM node:23-alpine

# Create app directory
WORKDIR /usr/src/app

# Set environment variable to indicate Docker environment
ENV DOCKER_IMAGE=true

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Expose the ports the app runs on
EXPOSE 8002

# Command to run the application
CMD ["npm", "start"]
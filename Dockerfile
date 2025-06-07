FROM --platform=$BUILDPLATFORM node:23-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install --production

# Bundle app source
COPY . .

# Install dos2unix to fix line endings for shell scripts
RUN apk add --no-cache dos2unix \
    && find . -type f -name "*.sh" -exec dos2unix {} +

# Expose the port the app runs on
EXPOSE 8002

# Command to run the application
CMD ["npm", "start"]
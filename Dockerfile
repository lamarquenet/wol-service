FROM --platform=$TARGETPLATFORM node:23-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# Expose the ports the app runs on
EXPOSE 8002
# Expose UDP port 9 for Wake-on-LAN magic packets
EXPOSE 9/udp

# Command to run the application
CMD ["npm", "start"]
# Wake-on-LAN Service

A lightweight Wake-on-LAN service for server administration dashboard. This service runs separately from the main server and is responsible for sending Wake-on-LAN packets to wake up the main server.

## Docker Deployment

### Using Docker Compose (Recommended)

1. Create a `.env` file with your configuration:

```
WOL_SERVICE_PORT=8002
SERVER_MAC=XX:XX:XX:XX:XX:XX  # Replace with your server's MAC address
WOL_BROADCAST_ADDR=192.168.1.255  # Optional: Your network's broadcast address
```

2. Run the service:

```bash
docker-compose up -d
```

### Using Docker directly

```bash
docker run -d \
  --name wol-service \
  --restart unless-stopped \
  -p 8002:8002 \
  -e WOL_SERVICE_PORT=8002 \
  -e SERVER_MAC=XX:XX:XX:XX:XX:XX \
  -e WOL_BROADCAST_ADDR=192.168.1.255 \
  ghcr.io/lamarquenet/wol-service:latest
```

Replace `XX:XX:XX:XX:XX:XX` with your server's MAC address.

## API Endpoints

- `GET /health`: Health check endpoint
- `POST /wakeup`: Send Wake-on-LAN packet
  - Request body: `{ "macAddress": "XX:XX:XX:XX:XX:XX" }` (optional if SERVER_MAC is set)

## Setting up as a System Service

### Using systemd (Linux)

1. Create a systemd service file:

```bash
sudo nano /etc/systemd/system/wol-service.service
```

2. Add the following content:

```
[Unit]
Description=Wake-on-LAN Service
After=docker.service
Requires=docker.service

[Service]
Restart=always
ExecStart=/usr/bin/docker-compose -f /path/to/docker-compose.yml up
ExecStop=/usr/bin/docker-compose -f /path/to/docker-compose.yml down
WorkingDirectory=/path/to/wol-service

[Install]
WantedBy=multi-user.target
```

3. Enable and start the service:

```bash
sudo systemctl enable wol-service
sudo systemctl start wol-service
```

## GitHub Actions

This repository includes a GitHub Actions workflow that automatically builds and publishes a Docker image to GitHub Container Registry (GHCR) when you push to the main branch or create a tag.

To use it:

1. Make sure your repository has the necessary permissions to publish packages.
2. Push your changes to the main branch or create a tag.
3. The workflow will build and publish the Docker image to GHCR.
4. You can then pull the image using `docker pull ghcr.io/lamarquenet/wol-service:latest`.

## Multi-Architecture Support

The Docker image is built for multiple architectures:
- linux/amd64 (standard 64-bit x86 systems)
- linux/arm64 (64-bit ARM systems like Raspberry Pi 4 with 64-bit OS)
- linux/arm/v7 (32-bit ARM systems like Raspberry Pi 3 and earlier)

This ensures the service can run on various devices, from standard servers to small single-board computers.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| WOL_SERVICE_PORT | Port for the WoL service to listen on | 8002 |
| SERVER_MAC | MAC address of the server to wake up | - |
| WOL_BROADCAST_ADDR | Broadcast address for the Wake-on-LAN packet | - |
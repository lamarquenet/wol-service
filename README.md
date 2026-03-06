# WOL Service

Lightweight Wake-on-LAN service. Deployed on **piserver (192.168.8.170)** to wake up **aiserver (192.168.8.209)** when it's sleeping.

## Deployment Location

```
┌─────────────────────────────────────────────────────────────────┐
│                    piserver (192.168.8.170)                     │
│                     Raspberry Pi - Always On                    │
│                                                                 │
│  Docker:                                                        │
│  └── wol-service:8002 (host network mode)                      │
│          └── Sends WOL packet to aiserver MAC                  │
└─────────────────────────────────────────────────────────────────┘
         │
         │ WOL Magic Packet (Broadcast: 192.168.8.255)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    aiserver (192.168.8.209)                     │
│                    [Sleeping ───► Wakes up]                     │
└─────────────────────────────────────────────────────────────────┘
```

The dashboard calls this service to wake aiserver so the stats-server can start.

## How It Works

1. Dashboard sends `POST /wakeup` to piserver:8002
2. WOL service creates magic packet with aiserver's MAC
3. Packet broadcast to network (192.168.8.255)
4. aiserver receives packet and wakes up
5. stats-server auto-starts on aiserver

## API Endpoints

### POST /wakeup

Send Wake-on-LAN packet.

**Response:**
```json
{
  "success": true,
  "message": "Wake-on-LAN packet sent to 10:7B:44:93:F0:CD"
}
```

### GET /health

Health check.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WOL_SERVICE_PORT` | 8002 | Service port |
| `SERVER_MAC` | 10:7B:44:93:F0:CD | aiserver MAC address |
| `WOL_BROADCAST_ADDR` | 192.168.8.255 | Network broadcast address |

### Docker Compose (piserver)

```yaml
services:
  wol-service:
    image: ghcr.io/lamarquenet/wol-service:latest
    container_name: wol-service
    platform: linux/arm64
    restart: unless-stopped
    network_mode: "host"  # Required for broadcast
    environment:
      - WOL_SERVICE_PORT=8002
      - SERVER_MAC=10:7B:44:93:F0:CD
      - WOL_BROADCAST_ADDR=192.168.8.255
```

> **Note:** `network_mode: "host"` is required to send broadcast packets.

## aiserver WOL Setup

The aiserver needs Wake-on-LAN enabled:

```bash
# On aiserver
sudo apt install ethtool

# Find network interface
ip link show

# Enable WOL (replace eth0)
sudo ethtool -s eth0 wol g

# Make persistent (add to /etc/network/interfaces)
# post-up /usr/sbin/ethtool -s eth0 wol g
```

## Related Repositories

| Repo | Location | IP | Purpose |
|------|----------|-----|---------|
| server-admin-dashboard | piserver | 192.168.8.170 | React frontend |
| wol-service | **piserver** | 192.168.8.170 | This WOL service |
| stats-server | aiserver | 192.168.8.209 | Backend API |

/**
 * Lightweight Wake-on-LAN Service
 * 
 * This service runs separately from the main server and is responsible
 * for sending Wake-on-LAN packets to wake up the main server.
 * 
 * It should be deployed on a device that's always on and on the same network
 * as the server (e.g., a Raspberry Pi, router with Node.js support, etc.)
 */

const express = require('express');
const cors = require('cors');
const wol = require('wake_on_lan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.WOL_SERVICE_PORT || 8002;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wol-service' });
});

/**
 * Wake-on-LAN endpoint
 */
app.post('/wakeup', (req, res) => {
  const { macAddress } = req.body;
  const mac = macAddress || process.env.SERVER_MAC;
  
  if (!mac) {
    return res.status(400).json({ 
      success: false, 
      message: 'MAC address not provided' 
    });
  }
  
  wol.wake(mac, (error) => {
    if (error) {
      console.error('Error sending Wake-on-LAN packet:', error);
      return res.status(500).json({ 
        success: false, 
        message: `Error sending Wake-on-LAN packet: ${error.message}` 
      });
    }
    
    console.log(`Wake-on-LAN packet sent to ${mac}`);
    res.json({ 
      success: true, 
      message: 'Wake-on-LAN packet sent successfully' 
    });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Wake-on-LAN service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Wake-up endpoint: http://localhost:${PORT}/wakeup (POST)`);
});
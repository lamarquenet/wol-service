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
const dgram = require('dgram');
const os = require('os');

// Load environment variables
dotenv.config();

/**
 * Custom function to send a Wake-on-LAN magic packet
 * This provides an alternative implementation for verification
 */
function sendCustomMagicPacket(mac, options = {}) {
  return new Promise((resolve, reject) => {
    // Default options
    const opts = {
      address: options.address || '255.255.255.255',
      port: options.port || 9,
      interface: options.interface || null
    };
    
    // Create UDP socket
    const socket = dgram.createSocket('udp4');
    
    // Enhanced debugging for Docker environments
    console.log('=== DOCKER NETWORK DEBUG INFO ===');
    console.log('Network interfaces available:');
    const networkInterfaces = os.networkInterfaces();
    console.log(JSON.stringify(networkInterfaces, null, 2));
    console.log(`Running in Docker: ${process.env.DOCKER_IMAGE ? 'Yes' : 'No'}`);
    console.log('================================');
    
    // Set up socket event handlers
    socket.on('error', (err) => {
      console.error(`[Custom Implementation] Socket error: ${err}`);
      reject(err);
      socket.close();
    });
    
    // Bind socket first, then enable broadcast
    const bindOptions = opts.interface ? { address: opts.interface } : undefined;
    
    socket.bind(bindOptions, () => {
      // Enable broadcast after binding
      socket.setBroadcast(true);
      
      // All code moved to the socket.bind() callback
    });
    
    // Format MAC address (remove colons, dashes, etc.)
    const macAddress = mac.replace(/[:-]/g, '');
    if (macAddress.length !== 12 || !/^[0-9A-F]{12}$/i.test(macAddress)) {
      reject(new Error('Invalid MAC address format'));
      socket.close();
      return;
    }
    
    // Create magic packet
    // 6 bytes of 0xFF followed by 16 repetitions of the MAC address
    const magicPacket = Buffer.alloc(102);
    
    // Fill first 6 bytes with 0xFF
    for (let i = 0; i < 6; i++) {
      magicPacket[i] = 0xFF;
    }
    
    // Insert 16 repetitions of the MAC address
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 6; j++) {
        magicPacket[6 + i * 6 + j] = parseInt(macAddress.substring(j * 2, j * 2 + 2), 16);
      }
    }
    
    console.log(`[Custom Implementation] Sending magic packet to ${mac}`);
    console.log(`- Broadcast Address: ${opts.address}`);
    console.log(`- Port: ${opts.port}`);
    console.log(`- Interface: ${opts.interface || 'default'}`);
    console.log(`- Packet Size: ${magicPacket.length} bytes`);
    
    // Send packet
    socket.send(
      magicPacket,
      0,
      magicPacket.length,
      opts.port,
      opts.address,
      (err) => {
        if (err) {
          console.error('[Custom Implementation] Error sending packet:', err);
          reject(err);
        } else {
          console.log('[Custom Implementation] Magic packet sent successfully');
          resolve();
        }
        socket.close();
      }
    );
  });
}

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
app.post('/wakeup', async (req, res) => {
  try {
    const { macAddress, port, interface: networkInterface, method, useAllInterfaces } = req.body;
    const mac = macAddress || process.env.SERVER_MAC;
    
    if (!mac) {
      return res.status(400).json({
        success: false,
        message: 'MAC address not provided'
      });
    }
    
    // Get broadcast address from environment variables
    const broadcastAddr = process.env.WOL_BROADCAST_ADDR || '255.255.255.255';
    
    // Default port is 9, but some implementations use 7 or other ports
    const wolPort = port || 9;
    
    console.log(`Attempting to send Wake-on-LAN packet:`);
    console.log(`- MAC Address: ${mac}`);
    console.log(`- Broadcast Address: ${broadcastAddr}`);
    console.log(`- Port: ${wolPort}`);
    console.log(`- Network Interface: ${networkInterface || 'default'}`);
    console.log(`- Method: ${method || 'both'}`);
    
    // Configure options for wake_on_lan
    const options = {
      address: broadcastAddr,
      port: wolPort
    };
    
    // If a specific network interface is provided
    if (networkInterface) {
      options.interface = networkInterface;
    }
    
    const results = {
      library: null,
      custom: null
    };
    
    // Use the library implementation unless method is 'custom'
    if (!method || method === 'library' || method === 'both') {
      try {
        await new Promise((resolve, reject) => {
          wol.wake(mac, options, (error) => {
            if (error) {
              console.error('[Library] Error sending Wake-on-LAN packet:', error);
              results.library = { success: false, error: error.message };
              reject(error);
            } else {
              console.log(`[Library] Wake-on-LAN packet sent to ${mac} via ${broadcastAddr}:${wolPort}`);
              results.library = { success: true };
              resolve();
            }
          });
        });
      } catch (error) {
        console.error('[Library] Failed:', error);
        results.library = { success: false, error: error.message };
      }
    }
    
    // Use the custom implementation unless method is 'library'
    if (!method || method === 'custom' || method === 'both') {
      try {
        if (useAllInterfaces) {
          // Try sending through all available network interfaces
          const networkInterfaces = os.networkInterfaces();
          const sendPromises = [];
          
          for (const [name, interfaces] of Object.entries(networkInterfaces)) {
            for (const iface of interfaces) {
              // Only use IPv4 interfaces that are not internal
              if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`Trying interface ${name} (${iface.address})`);
                const interfaceOptions = {
                  ...options,
                  interface: iface.address
                };
                
                sendPromises.push(
                  sendCustomMagicPacket(mac, interfaceOptions)
                    .then(() => ({ interface: name, address: iface.address, success: true }))
                    .catch(err => ({ interface: name, address: iface.address, success: false, error: err.message }))
                );
              }
            }
          }
          
          results.custom = await Promise.all(sendPromises);
        } else {
          // Just use the specified options
          await sendCustomMagicPacket(mac, options);
          results.custom = { success: true };
        }
      } catch (error) {
        console.error('[Custom] Failed:', error);
        results.custom = { success: false, error: error.message };
      }
    }
    
    // Check if at least one method succeeded
    const anySuccess =
      (results.library && results.library.success) ||
      (results.custom && (
        Array.isArray(results.custom)
          ? results.custom.some(r => r.success)
          : results.custom.success
      ));
    
    if (anySuccess) {
      res.json({
        success: true,
        message: 'Wake-on-LAN packet sent successfully',
        details: results
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send Wake-on-LAN packet',
        details: results
      });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({
      success: false,
      message: `Unexpected error: ${error.message}`
    });
  }
});

/**
 * Diagnostic endpoint to check Wake-on-LAN configuration
 */
app.get('/diagnostic', (req, res) => {
  const mac = process.env.SERVER_MAC;
  const broadcastAddr = process.env.WOL_BROADCAST_ADDR || '255.255.255.255';
  
  // Get network interfaces
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  
  res.json({
    config: {
      mac,
      broadcastAddr,
      port: PORT
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    networkInterfaces,
    packageVersion: {
      wol: require('wake_on_lan/package.json').version,
      express: require('express/package.json').version
    }
  });
});

/**
 * Advanced testing endpoint for Wake-on-LAN
 * This endpoint provides a UI for testing different WoL configurations
 */
app.get('/test', (req, res) => {
  const mac = process.env.SERVER_MAC || '';
  const broadcastAddr = process.env.WOL_BROADCAST_ADDR || '255.255.255.255';
  
  // Get network interfaces for the dropdown
  const networkInterfaces = os.networkInterfaces();
  const interfaces = [];
  
  for (const [name, ifaceList] of Object.entries(networkInterfaces)) {
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        interfaces.push({
          name: `${name} (${iface.address})`,
          address: iface.address
        });
      }
    }
  }
  
  // HTML for the test page
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Wake-on-LAN Tester</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, select { width: 100%; padding: 8px; box-sizing: border-box; }
      button { background: #4CAF50; color: white; border: none; padding: 10px 15px; cursor: pointer; }
      button:hover { background: #45a049; }
      .result { margin-top: 20px; padding: 15px; background: #f8f8f8; border-radius: 4px; white-space: pre-wrap; }
      .success { color: green; }
      .error { color: red; }
    </style>
  </head>
  <body>
    <h1>Wake-on-LAN Test Tool</h1>
    <p>Use this tool to test different Wake-on-LAN configurations.</p>
    
    <div class="form-group">
      <label for="mac">MAC Address:</label>
      <input type="text" id="mac" value="${mac}" placeholder="e.g., 00:11:22:33:44:55">
    </div>
    
    <div class="form-group">
      <label for="broadcast">Broadcast Address:</label>
      <input type="text" id="broadcast" value="${broadcastAddr}" placeholder="e.g., 192.168.1.255">
    </div>
    
    <div class="form-group">
      <label for="port">Port:</label>
      <input type="number" id="port" value="9" min="1" max="65535">
    </div>
    
    <div class="form-group">
      <label for="interface">Network Interface:</label>
      <select id="interface">
        <option value="">Default (all interfaces)</option>
        ${interfaces.map(iface => `<option value="${iface.address}">${iface.name}</option>`).join('')}
      </select>
    </div>
    
    <div class="form-group">
      <label for="method">Method:</label>
      <select id="method">
        <option value="both">Both (Library + Custom)</option>
        <option value="library">Library Only</option>
        <option value="custom">Custom Implementation Only</option>
      </select>
    </div>
    
    <div class="form-group">
      <label>
        <input type="checkbox" id="useAllInterfaces"> Try all network interfaces
      </label>
    </div>
    
    <button id="sendPacket">Send Wake-on-LAN Packet</button>
    
    <div class="result" id="result" style="display: none;"></div>
    
    <script>
      document.getElementById('sendPacket').addEventListener('click', async () => {
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = 'Sending packet...';
        resultDiv.style.display = 'block';
        resultDiv.className = 'result';
        
        try {
          const response = await fetch('/wakeup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              macAddress: document.getElementById('mac').value,
              port: parseInt(document.getElementById('port').value, 10),
              interface: document.getElementById('interface').value,
              method: document.getElementById('method').value,
              useAllInterfaces: document.getElementById('useAllInterfaces').checked,
              broadcastAddr: document.getElementById('broadcast').value
            })
          });
          
          const data = await response.json();
          
          if (data.success) {
            resultDiv.className = 'result success';
          } else {
            resultDiv.className = 'result error';
          }
          
          resultDiv.innerHTML = '<strong>Result:</strong>\\n' + JSON.stringify(data, null, 2);
        } catch (error) {
          resultDiv.className = 'result error';
          resultDiv.innerHTML = '<strong>Error:</strong>\\n' + error.message;
        }
      });
    </script>
  </body>
  </html>
  `;
  
  res.send(html);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Wake-on-LAN service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Wake-up endpoint: http://localhost:${PORT}/wakeup (POST)`);
  console.log(`Diagnostic endpoint: http://localhost:${PORT}/diagnostic (GET)`);
  console.log(`Test UI: http://localhost:${PORT}/test (GET)`);
  
  // Log environment configuration
  console.log('\nEnvironment Configuration:');
  console.log(`- Server MAC: ${process.env.SERVER_MAC || 'Not set'}`);
  console.log(`- Broadcast Address: ${process.env.WOL_BROADCAST_ADDR || '255.255.255.255 (default)'}`);
  console.log(`- Running in Docker: ${process.env.DOCKER_IMAGE ? 'Yes' : 'No'}`);
  
  // Enhanced Docker network diagnostics
  console.log('\n=== DOCKER NETWORK CONFIGURATION ===');
  console.log('Available Network Interfaces:');
  const networkInterfaces = os.networkInterfaces();
  for (const [name, interfaces] of Object.entries(networkInterfaces)) {
    for (const iface of interfaces) {
      if (iface.family === 'IPv4') {
        console.log(`- ${name}: ${iface.address} (internal: ${iface.internal})`);
      }
    }
  }
  
  // Test UDP socket creation
  try {
    const testSocket = dgram.createSocket('udp4');
    testSocket.on('error', (err) => {
      console.error(`UDP Socket Test Error: ${err.message}`);
    });
    
    testSocket.bind(() => {
      console.log('UDP Socket Test: Successfully created and bound socket');
      try {
        testSocket.setBroadcast(true);
        console.log('UDP Socket Test: Successfully enabled broadcasting');
      } catch (err) {
        console.error(`UDP Socket Test: Failed to enable broadcasting - ${err.message}`);
      }
      testSocket.close();
    });
  } catch (err) {
    console.error(`UDP Socket Test: Failed to create socket - ${err.message}`);
  }
  
  console.log('====================================');
});
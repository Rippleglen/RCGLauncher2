// components/config.js
const fs = require('fs');
const path = require('path');
const appDataPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '.RCGLauncher2', 'launcher');
const configPath = path.join(appDataPath, 'config.json');

// Ensure the config directory exists
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
}

// Load config from config.json
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const rawConfig = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(rawConfig);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return {};  // Return an empty object if config doesn't exist or fails to load
}

// Save config to config.json
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  configPath, // Export for easy reference if needed
};

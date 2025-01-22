const { ipcRenderer } = require('electron');

// Update status without progress percentage
ipcRenderer.on('status', (event, { text }) => {
    document.getElementById('status-text').textContent = text;
  });
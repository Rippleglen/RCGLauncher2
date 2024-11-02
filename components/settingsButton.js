// components/settingsButton.js
const { ipcRenderer } = require('electron');

function setupSettingsButton() {
  const settingsButton = document.getElementById('settings-button');
  settingsButton.addEventListener('click', () => {
    ipcRenderer.send('open-settings');
  });
}

module.exports = setupSettingsButton;

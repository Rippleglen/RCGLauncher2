const { ipcRenderer } = require('electron');

document.getElementById('remove-button').addEventListener('click', () => {
  ipcRenderer.send('remove-old-launcher-folder');
});

document.getElementById('keep-button').addEventListener('click', () => {
  ipcRenderer.send('keep-old-launcher-folder');
});

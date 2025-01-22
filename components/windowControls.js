document.getElementById('minimize').addEventListener('click', () => {
  ipcRenderer.send('window-minimize');
});

document.getElementById('maximize').addEventListener('click', () => {
  ipcRenderer.send('window-maximize');
});

document.getElementById('close').addEventListener('click', () => {
  ipcRenderer.send('window-close');
});

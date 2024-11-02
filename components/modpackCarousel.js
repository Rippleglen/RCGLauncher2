const { Client } = require('minecraft-launcher-core');
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');  // Add fs module for file reading
const { loadAuthData } = require('../auth/microsoftAuth');

const configPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '.RCGLauncher2', 'config.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return {};
}

// Load modpacks and setup the play button


async function loadModpacks() {
  const modpackList = document.getElementById('modpack-list');
  modpackList.innerHTML = ''; // Clear existing modpack list

  try {
    // Request modpack data from main.js
    const modpacks = await ipcRenderer.invoke('fetch-modpacks');

    modpacks.forEach(modpack => {
      const modpackItem = document.createElement('div');
      modpackItem.className = 'modpack-item';
      modpackItem.id = modpack.id;

      const img = document.createElement('img');
      img.src = modpack.image;
      img.alt = modpack.name;

      const title = document.createElement('h3');
      title.textContent = modpack.name;

      const desc = document.createElement('p');
      desc.textContent = modpack.description;

      const playButton = document.createElement('button');
      playButton.textContent = 'Play';
      playButton.addEventListener('click', () => {
        ipcRenderer.send('play-modpack', modpack);
      });

      modpackItem.appendChild(img);
      modpackItem.appendChild(title);
      modpackItem.appendChild(desc);
      modpackItem.appendChild(playButton);

      modpackList.appendChild(modpackItem);
    });
  } catch (error) {
    console.error('Error loading modpacks:', error);
  }
}

module.exports = { loadModpacks };



module.exports = {
  loadModpacks,
};

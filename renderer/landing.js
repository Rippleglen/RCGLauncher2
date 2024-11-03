const { ipcRenderer } = require('electron');
const loadNews = require('../components/news');

async function loadModpacks() {
  try {
    const modpacks = await ipcRenderer.invoke('fetch-modpacks');
    const modpackList = document.getElementById('modpack-list');
    modpackList.innerHTML = ''; // Clear existing content

    modpacks.forEach(modpack => {
      const modpackItem = document.createElement('div');
      modpackItem.classList.add('modpack-item');

      const logoSrc = modpack.image || 'path/to/default-logo.png';
      const logo = document.createElement('img');
      logo.src = logoSrc;
      logo.alt = `${modpack.name} Logo`;
      logo.classList.add('modpack-logo');
      modpackItem.appendChild(logo);

      const separator1 = document.createElement('div');
      separator1.classList.add('separator');
      modpackItem.appendChild(separator1);

      const name = document.createElement('span');
      name.classList.add('modpack-name');
      name.textContent = modpack.name;
      modpackItem.appendChild(name);

      const separator2 = document.createElement('div');
      separator2.classList.add('separator');
      modpackItem.appendChild(separator2);

      const playButton = document.createElement('button');
      playButton.classList.add('play-button');
      playButton.textContent = 'Play';
      playButton.onclick = () => {
        ipcRenderer.send('play-modpack', modpack);
        startMeteorAnimation();
      };
      modpackItem.appendChild(playButton);

      modpackList.appendChild(modpackItem);
    });
  } catch (error) {
    console.error('Error loading modpacks:', error);
  }
}

document.getElementById('settings-button').addEventListener('click', () => {
  ipcRenderer.send('open-settings');
});

function startMeteorAnimation() {
  const meteorContainer = document.body;

  function createMeteor() {
    const meteor = document.createElement('div');
    meteor.classList.add('meteor');

    const randomLeft = Math.random() * window.innerWidth + 'px';
    const randomDuration = Math.random() * 1 + 0.5 + 's';

    meteor.style.left = randomLeft;
    meteor.style.animationDuration = randomDuration;
    meteorContainer.appendChild(meteor);

    meteor.addEventListener('animationend', () => {
      meteorContainer.removeChild(meteor);
    });
  }

  const interval = setInterval(createMeteor, 50);
  setTimeout(() => clearInterval(interval), 120000); // Stop meteors after time
}


function addTerminalMessage(message) {
  const terminal = document.getElementById('launcher-terminal');
  if (terminal) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    terminal.appendChild(messageElement);
    terminal.scrollTop = terminal.scrollHeight;
  } else {
    console.error("Launcher terminal element not found");
  }
}

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.on('log-message', (event, message) => {
    addTerminalMessage(message);
  });
  
  const versionCard = document.getElementById('version-card');

  ipcRenderer.on('app-version', (event, version) => {
    const versionText = document.getElementById('version-text');
    if (versionText) {
      versionText.textContent = `${version}`;
    }
  });

  // Handle update notification
  ipcRenderer.on('update-available', () => {
    console.log('Update available detected');
    versionCard.textContent = 'Update Available';
    versionCard.classList.add('update-available');
    startColorFade(versionCard);

    // Add click handler for applying the update
    versionCard.onclick = () => {
      console.log('Applying update...');
      ipcRenderer.send('apply-update');
    };
  });

  // Listen for update-ready message (optional, for verification)
  ipcRenderer.on('update-ready', () => {
    console.log('Update is downloaded and ready');
  });

  loadNews();
  loadModpacks();
});

function startColorFade(element) {
  let fade = true;
  setInterval(() => {
    element.style.backgroundColor = fade ? '#357ae8' : '#242424';
    fade = !fade;
  }, 1000);
}


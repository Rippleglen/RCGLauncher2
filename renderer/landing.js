const { ipcRenderer } = require('electron');
const { version } = require('../package.json');
const { cachePage, getCachedPage } = require('../renderer/cacheManager');

let currentlySelectedPack = null;
let modpackDirectoryPath = null;

async function loadEJSContent(page, callback) {
  console.log(`Loading page: ${page}`); // Log to ensure the function is called
  try {
      const response = await fetch(`../views/${page}.ejs`);
      const html = await response.text();
      const contentArea = document.getElementById('content-area');
      if (contentArea) {
          contentArea.innerHTML = html;
          console.log(`${page} content loaded`); // Confirm content loading
          if (callback) callback(); // Run the callback after content is inserted
      }
  } catch (error) {
      console.error('Error loading content:', error);
  }

}

function bindPlayButton() {
  const playButton = document.getElementById('play-modpack-button');
  if (playButton) {
      playButton.onclick = () => {
          if (currentlySelectedPack) {
              ipcRenderer.send('play-modpack', currentlySelectedPack);
              console.log(`Playing modpack: ${currentlySelectedPack.name}`);
          } else {
              console.error('No modpack selected to play.');
          }
      };
  }
}

// Function to set the active button
function setActiveButton(button) {
  const buttons = document.querySelectorAll('.button');
  buttons.forEach(btn => btn.classList.remove('button-pressed'));
  button.classList.add('button-pressed');
}

// Function to display version info
function displayVersionInfo() {
  const versionInfo = document.getElementById('version-info');
  if (versionInfo) {
    versionInfo.textContent = `Version: ${version}-Indigo`;
  }
}

// Functions to load content for Home, Settings, etc.
function loadHomeContent() {
  const contentArea = document.getElementById('content-area');
  resetHorizontalNav();
  loadEJSContent('home');
  currentlySelectedPack = null; // Ensure the modpack state is reset
}

function loadSettingsContent() {
  const contentArea = document.getElementById('content-area');
  resetHorizontalNav();
  loadEJSContent('settings');
  currentlySelectedPack = null; // Ensure the modpack state is reset
}

function loadSkinsContent() {
  loadEJSContent('skins', () => {
      window.loadSkinsOnStartup();
      window.loadCurrentUserSkin(); // Ensure it runs after the content is loaded
  });
}

function loadConfigurationContent() {
  loadEJSContent('configuration', () => {
    bindBrowseButton();
    updateConfigHeader();
  });
}

function loadPatchNotesContent() {
  loadEJSContent('patchnotes', () => {
    loadPatchNotes();
  });
}

function loadPlayContent() {
  modpack = currentlySelectedPack
  const contentArea = document.getElementById('content-area');
  displayModpackDetails(modpack);
}

// Function to display modpack details in the main content area
function displayModpackDetails(modpack) {
  currentlySelectedPack = modpack;
  window.currentlySelectedModpackName = modpack.name;
    console.log(`Currently selected modpack: ${window.currentlySelectedModpackName}`);

  const contentArea = document.getElementById('content-area');
  if (!contentArea) {
    console.error("Error: 'content-area' element not found.");
    return; // Exit if not found
  }

  const headerTitle = document.getElementById('header-title');
    if (headerTitle) {
        headerTitle.textContent = modpack.name;
    }

  // Clear the content area and create the modpack details content dynamically if necessary
  contentArea.innerHTML = `
      <div id="modpack-details">
          <div id="herodiv">
              <img id="modpack-hero" src="${modpack.heroImage || '../assets/hero.png'}" alt="Modpack Hero" class="hero-image">
          </div>
          <div class="nav-container">
              <div class="play-button-container">
                <button id="play-modpack-button" class="play-button">
                  <span class="play-text">Play</span>
                  <img id="playbuttonimg" src="../assets/playbutton.png">
                </button>
              </div>
          </div>
          <div class="content-section">
              <h1 id="modpack-title" class="text-xl font-semibold mb-4">${modpack.name}</h1>
              <p id="modpack-description">${modpack.description}</p>
          </div>
      </div>
  `;
  bindPlayButton();

  // Show the horizontal nav bar
  const horizontalNav = document.getElementById('horizontal-nav');
  if (horizontalNav) {
    horizontalNav.style.display = 'block';
    setTimeout(() => {
      horizontalNav.classList.add('show');
    }, 50);
  }

  setActiveNavButton(document.querySelectorAll('.nav-button')[0]); // Default to the "Play" button
  console.log(`Selected modpack: ${modpack.name}`);
}

function loadConfigurationContent() {
  loadEJSContent('configuration', () => {
      // Call a function to update the header after content is loaded
      if (typeof updateConfigHeader === 'function') {
          updateConfigHeader();
      }
  });
}

// Load modpacks and set up click handlers
async function loadModpacks() {
  try {
    const modpacks = await ipcRenderer.invoke('fetch-modpacks');
    const modpackList = document.getElementById('modpack-list');
    if (modpackList) {
      modpackList.innerHTML = '';

      modpacks.forEach(modpack => {
        const modpackItem = document.createElement('a');
        modpackItem.classList.add('button', 'text-white', 'p-4', 'w-full', 'flex', 'items-center');
        modpackItem.href = '#';
        modpackItem.onclick = () => {
          setActiveButton(modpackItem);
          displayModpackDetails(modpack);
        };

        const img = document.createElement('img');
        img.src = modpack.image || 'path/to/default-logo.png';
        img.alt = `${modpack.name} icon`;
        img.classList.add('h-6', 'w-6', 'mr-3');
        img.style.borderRadius = '4px';

        modpackItem.appendChild(img);

        const modpackName = document.createElement('span');
        modpackName.textContent = modpack.name;
        modpackItem.appendChild(modpackName);

        modpackList.appendChild(modpackItem);
      });
    }
  } catch (error) {
    console.error('Error loading modpacks:', error);
  }
}

function setActiveNavButton(button) {
  const navButtons = document.querySelectorAll('.nav-button');
  const selectionBar = document.getElementById('selection-bar');

  navButtons.forEach(btn => btn.classList.remove('nav-button-active'));
  button.classList.add('nav-button-active');

  if (selectionBar && button) {
    const buttonRect = button.getBoundingClientRect();
    const containerRect = document.getElementById('nav-container').getBoundingClientRect();

    const barLeftPosition = buttonRect.left - containerRect.left + (buttonRect.width / 2) - (selectionBar.offsetWidth / 2) + 4;
    selectionBar.style.left = `${barLeftPosition}px`;
  }
}

function resetHorizontalNav() {
  const horizontalNav = document.getElementById('horizontal-nav');
  if (horizontalNav) {
    horizontalNav.classList.remove('show');
    setTimeout(() => {
      horizontalNav.style.display = 'none';
    }, 300); // Matches the animation duration to hide smoothly
  }
}

async function handleLogout() {
  try {
    const appDataPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '.RCGLauncher2');
    const authFilePath = path.join(appDataPath, 'auth.json');

    // Delete auth.json
    if (fs.existsSync(authFilePath)) {
      fs.unlinkSync(authFilePath);
      console.log('Auth file deleted successfully.');
    } else {
      console.warn('Auth file not found, skipping deletion.');
    }

    // Redirect to welcome.ejs
    ipcRenderer.send('navigate-to-welcome');
  } catch (error) {
    console.error('Error during logout:', error);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }

  const homeButton = document.getElementById('home-button');
  if (homeButton) {
    setActiveButton(homeButton); // Set "Home" as the default active button
    loadHomeContent(); // Load the home content by default
  }

  const playButton = document.getElementById('play-modpack-button');
  if (playButton) {
    playButton.addEventListener('click', () => {
      if (currentlySelectedPack) {
        ipcRenderer.send('play-modpack', currentlySelectedPack);
        console.log(`Playing modpack: ${currentlySelectedPack.name}`);
      } else {
        console.error('No modpack selected to play.');
      }
    });
  }

  displayVersionInfo();
  loadModpacks();
});

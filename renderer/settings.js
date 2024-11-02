const { ipcRenderer } = require('electron');
const axios = require('axios');

document.addEventListener('DOMContentLoaded', async () => {
  const javaModeToggle = document.getElementById('java-mode-toggle');
  const javaOptionsDiv = document.getElementById('java-options');
  const javaPathOptions = document.getElementById('java-path-options');
  const browseJavaButton = document.getElementById('browse-java-button');
  const applySkinButton = document.getElementById('apply-skin-button');
  const skinUploadInput = document.getElementById('skin-upload');

  const memoryModeToggle = document.getElementById('memory-mode-toggle');
  const memorySliderContainer = document.getElementById('memory-slider-container');
  const memorySlider = document.getElementById('memory-slider');
  const memoryValueDisplay = document.getElementById('memory-value');
  const memoryInfoText = document.getElementById('memory-info-text'); // Add this line for the new info text

  await loadPlayerSkin();

  

  document.getElementById('back-button').addEventListener('click', () => {
    ipcRenderer.send('back-to-landing');
  });

  applySkinButton.addEventListener('click', async () => {
    const file = skinUploadInput.files[0];
    if (!file || file.type !== 'image/png') {
      alert('Please upload a valid PNG skin file.');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
        params: { key: '468dedcbd050d7fa0abbcfd9fbe9dd95' },
      });

      const skinUrl = uploadResponse.data.data.url;
      console.log('Image uploaded, URL:', skinUrl);

      const maxRetries = 5;
      let retries = 0;
      let urlAccessible = false;
      while (!urlAccessible && retries < maxRetries) {
        try {
          await axios.get(skinUrl);
          urlAccessible = true;
        } catch (error) {
          console.log(`Waiting for URL to become accessible. Retry #${retries + 1}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries++;
        }
      }

      if (!urlAccessible) {
        alert('Skin URL is not accessible. Please try again later.');
        return;
      }

      const response = await ipcRenderer.invoke('apply-skin', skinUrl);
      if (response.success) {
        alert('Skin updated successfully!');
        await loadPlayerSkin();
      } else {
        alert('Failed to update skin: ' + response.error);
      }

    } catch (error) {
      console.error('Error uploading or applying skin:', error);
      alert('Failed to upload and apply skin. Please try again.');
    }
  });

  function updateMemoryAllocationVisibility() {
    memorySliderContainer.classList.toggle('hidden', !memoryModeToggle.checked);
    updateMemoryInfoText(); // Update memory info text whenever the visibility changes
  }

  async function initializeMemorySettings() {
    const savedMode = localStorage.getItem('memoryMode');
    memoryModeToggle.checked = savedMode === 'manual';
    updateMemoryAllocationVisibility();

    const savedMemory = localStorage.getItem('memoryAllocation') || await getHalfSystemRAM();
    memorySlider.value = savedMemory;
    memoryValueDisplay.textContent = `${savedMemory}GB`;
    updateMemoryInfoText();
  }

  async function getHalfSystemRAM() {
    const systemRAM = (await ipcRenderer.invoke('get-system-ram')) / 2;
    return Math.max(4, Math.min(16, Math.floor(systemRAM)));
  }

  memoryModeToggle.addEventListener('change', async () => {
    updateMemoryAllocationVisibility();
    if (!memoryModeToggle.checked) {
      const autoMemory = await getHalfSystemRAM();
      memorySlider.value = autoMemory;
      memoryValueDisplay.textContent = `${autoMemory}GB`;
    }
    saveMemoryConfig();
  });

  

  memorySlider.addEventListener('input', () => {
    const memory = memorySlider.value;
    memoryValueDisplay.textContent = `${memory}GB`;
    saveMemoryConfig();
  });

  async function updateMemoryInfoText() {
    if (!memoryModeToggle.checked) { // Only show text in automatic mode
      const totalRAM = Math.floor(await ipcRenderer.invoke('get-system-ram') / (1024 ** 3));
      const allocatedRAM = Math.floor(totalRAM / 2);
      memoryInfoText.textContent = `Your system has ${totalRAM}GB of RAM. Minecraft will use ${allocatedRAM}GB.`;
      memoryInfoText.classList.remove('hidden');
    } else {
      memoryInfoText.classList.add('hidden');
    }
  }

  async function loadMemoryConfig() {
    const { memoryMode, memoryAllocation } = await ipcRenderer.invoke('load-memory-config');
    memoryModeToggle.checked = memoryMode === 'manual';
    memorySlider.value = memoryAllocation;
    memoryValueDisplay.textContent = `${memoryAllocation}GB`;
    updateMemoryInfoText();
  }

  function saveMemoryConfig() {
    const memoryMode = memoryModeToggle.checked ? 'manual' : 'automatic';
    const memoryAllocation = memorySlider.value;
    ipcRenderer.send('save-memory-config', memoryMode, memoryAllocation);
  }

  function updateMemoryAllocationVisibility() {
    memorySliderContainer.classList.toggle('hidden', !memoryModeToggle.checked);
    updateMemoryInfoText(); // Update memory info text whenever the visibility changes
  }

  async function getHalfSystemRAM() {
    const systemRAM = Math.floor(await ipcRenderer.invoke('get-system-ram') / (1024 ** 3));
    return Math.max(4, Math.min(16, Math.floor(systemRAM / 2)));
  }

  initializeMemorySettings();
  await loadMemoryConfig();
});

async function loadPlayerSkin() {
  try {
    const authData = await ipcRenderer.invoke('get-auth-data');
    if (!authData || !authData.uuid) throw new Error('UUID not found in auth data');
    const uuid = authData.uuid;
    const skinUrl = `https://mc-heads.net/body/${uuid}/right.png`;
    const skinImage = document.getElementById('skin-preview');
    skinImage.src = skinUrl;
  } catch (error) {
    console.error('Failed to load player skin:', error);
  }
}

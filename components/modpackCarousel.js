async function loadModpacks() {
  try {
    const modpacks = await ipcRenderer.invoke('fetch-modpacks');
    const modpackList = document.getElementById('modpack-list');
    modpackList.innerHTML = ''; // Clear existing content

    modpacks.forEach(modpack => {
      const modpackItem = document.createElement('a');
      modpackItem.classList.add('button', 'text-white', 'p-4', 'w-full', 'flex', 'items-center');
      modpackItem.href = '#';
      modpackItem.onclick = () => {
        setActiveButton(modpackItem);
        loadIframe(`${modpack.id}.ejs`, false); // Load the .ejs page for the modpack
        updateHeaderText(modpack.name); // Update the header with the modpack name
      };

      // Add modpack image as an icon
      const img = document.createElement('img');
      img.src = modpack.image;
      img.alt = `${modpack.name} icon`;
      img.classList.add('h-6', 'w-6', 'mr-3'); // Tailwind classes for sizing and margin
      img.style.borderRadius = '4px'; // Rounded corners

      modpackItem.appendChild(img);

      // Add modpack name as text
      const modpackName = document.createElement('span');
      modpackName.textContent = modpack.name;
      modpackItem.appendChild(modpackName);

      modpackList.appendChild(modpackItem);
    });
  } catch (error) {
    console.error('Error loading modpacks:', error);
  }
}

function updateHeaderText(modpackName) {
  const headerElement = document.querySelector('header h2');
  if (headerElement) {
    headerElement.textContent = modpackName;
  }
}

module.exports = { loadModpacks };

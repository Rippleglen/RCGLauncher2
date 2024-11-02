const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const javaModeToggle = document.getElementById('java-mode-toggle');
  const javaOptionsDiv = document.getElementById('java-options');
  const javaPathOptions = document.getElementById('java-path-options');
  const browseJavaButton = document.getElementById('browse-java-button');

  // Load Java paths
  const javaPaths = await ipcRenderer.invoke('get-java-paths');
  javaPaths.forEach((path, index) => {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'javaPath';
    radio.value = path;
    radio.id = `java-path-${index}`;

    const label = document.createElement('label');
    label.setAttribute('for', radio.id);
    label.textContent = path;

    javaPathOptions.appendChild(radio);
    javaPathOptions.appendChild(label);
    javaPathOptions.appendChild(document.createElement('br'));

    // Set checked radio if it matches saved path
    if (path === localStorage.getItem('selectedJavaPath')) {
      radio.checked = true;
    }
  });

  // Toggle Java options visibility
  function updateJavaOptionsVisibility() {
    if (javaModeToggle.checked) {
      javaOptionsDiv.classList.remove('hidden');
    } else {
      javaOptionsDiv.classList.add('hidden');
      localStorage.removeItem('selectedJavaPath'); // Clear manual path if automatic
    }
  }

  // Event listener for toggle switch
  javaModeToggle.addEventListener('change', () => {
    updateJavaOptionsVisibility();
    const mode = javaModeToggle.checked ? 'manual' : 'automatic';
    localStorage.setItem('javaMode', mode); // Save mode
  });

  // Initialize Java options visibility based on saved mode
  const savedMode = localStorage.getItem('javaMode');
  javaModeToggle.checked = savedMode === 'manual';
  updateJavaOptionsVisibility();

  // Event listener for Java path radio buttons
  javaPathOptions.addEventListener('change', (event) => {
    if (event.target.name === 'javaPath') {
      const selectedPath = event.target.value;
      localStorage.setItem('selectedJavaPath', selectedPath);
      ipcRenderer.send('save-java-path', selectedPath);
    }
  });

  document.getElementById('back-button').addEventListener('click', () => {
    ipcRenderer.send('back-to-landing');
  });

  // Browse Java path manually
  browseJavaButton.addEventListener('click', async () => {
    const newJavaPath = await ipcRenderer.invoke('browse-java');
    if (newJavaPath) {
      localStorage.setItem('selectedJavaPath', newJavaPath);
      ipcRenderer.send('save-java-path', newJavaPath);
      // Add new path as radio option and select it
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'javaPath';
      radio.value = newJavaPath;
      radio.id = `java-path-new`;

      const label = document.createElement('label');
      label.setAttribute('for', radio.id);
      label.textContent = newJavaPath;

      javaPathOptions.appendChild(radio);
      javaPathOptions.appendChild(label);
      radio.checked = true;
    }
  });
});

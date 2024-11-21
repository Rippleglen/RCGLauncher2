const { exec } = require('child_process');

const appDataPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '.RCGLauncher2');
console.log(appDataPath); // Debugging line
const modpackName = window.currentlySelectedModpackName;

function updateConfigHeader() {
    const header = document.getElementById('config-header');
    if (header && window.currentlySelectedModpackName) {
        header.textContent = `${window.currentlySelectedModpackName}: Pack Configuration`;
        header.style.fontFamily = 'Segoe UI';
        header.style.fontWeight = 'bolder';
        header.style.setProperty('font-size', '16px', 'important');
        header.style.setProperty('color', '#ffffff', 'important');
        console.log(`Updated header: ${header.textContent}`); // Debugging line
    } else {
        console.error('Header or currently selected modpack name not found.');
    }
    setModpackDirectory();
    setDirectoryInputValue();
    bindBrowseButton();
    bindSaveButton();
    loadJVMArguments();
}

window.setModpackDirectory = function setModpackDirectory() {
    const modpackName = window.currentlySelectedModpackName;
    console.log(`Setting directory for: ${modpackName}`); // Debugging line

    if (modpackName) {
        // Build the full path using the appDataPath and modpack name
        const fullPath = path.join(appDataPath, 'instances', modpackName);
        console.log(`Full path set: ${fullPath}`); // Debugging line

        const directoryInput = document.getElementById('game-directory');
        if (directoryInput) {
            directoryInput.value = fullPath;
        } else {
            console.error('Game directory input element not found.');
        }
    } else {
        console.error('Modpack name not found.');
    }
};

function setDirectoryInputValue() {
    const directoryInput = document.getElementById('game-directory');
    if (directoryInput && window.modpackDirectoryPath) {
        directoryInput.value = window.modpackDirectoryPath;
        console.log(`Directory input set to: ${window.modpackDirectoryPath}`); // Debugging line
    } else {
        console.error('Directory input element not found or modpack directory path is not set.');
    }
}

function bindBrowseButton() {
    const browseButton = document.querySelector('.browse-button');
    console.log('Binding browse button:', browseButton); // Debugging line
    if (browseButton) {
        browseButton.addEventListener('click', async () => {
            const directoryInput = document.getElementById('game-directory');
            if (directoryInput && directoryInput.value) {
                // Use your method to open the directory in File Explorer
                ipcRenderer.invoke('open-directory', directoryInput.value);
            }
        });
    } else {
        console.error('Browse button not found.');
    }
}

function bindSaveButton() {
    const saveButton = document.getElementById('save-jvm-arguments');
    if (saveButton) {
        saveButton.addEventListener('click', saveJVMArguments);
    }

    loadJVMArguments();
}

async function loadJVMArguments() {
    const modpackName = window.currentlySelectedModpackName;
    if (!modpackName) {
        console.error('Modpack name not found.');
        return;
    }

    const appDataPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '.RCGLauncher2', 'launcher');
    const jvmArgsFilePath = path.join(appDataPath, `${modpackName.replace(/\s+/g, '')}jvmargs.json`);

    if (fs.existsSync(jvmArgsFilePath)) {
        // Load existing JVM arguments
        const jvmArgsData = fs.readFileSync(jvmArgsFilePath, 'utf-8');
        document.getElementById('jvm-arguments').value = JSON.parse(jvmArgsData).jvmArgs;
        console.log(`Loaded JVM arguments from ${jvmArgsFilePath}`);
    } else {
        // Load default JVM arguments from modpacks.json
        const modpacks = await ipcRenderer.invoke('fetch-modpacks');
        const modpack = modpacks.find(pack => pack.name === modpackName);

        if (modpack && modpack.jvmArgs) {
            // Create and save the new JSON file with default arguments
            const jvmArgs = { jvmArgs: modpack.jvmArgs };
            fs.writeFileSync(jvmArgsFilePath, JSON.stringify(jvmArgs, null, 2));
            document.getElementById('jvm-arguments').value = modpack.jvmArgs;
            console.log(`Created ${jvmArgsFilePath} with default JVM arguments.`);
        } else {
            console.error('Default JVM arguments not found in modpacks.json');
        }
    }
}

function saveJVMArguments() {
    const modpackName = window.currentlySelectedModpackName;
    if (!modpackName) {
        console.error('Modpack name not found.');
        return;
    }

    const appDataPath = path.join(require('os').homedir(), 'AppData', 'Roaming', '.RCGLauncher2', 'launcher');
    const jvmArgsFilePath = path.join(appDataPath, `${modpackName.replace(/\s+/g, '')}jvmargs.json`);
    const jvmArgs = document.getElementById('jvm-arguments').value;

    fs.writeFileSync(jvmArgsFilePath, JSON.stringify({ jvmArgs: jvmArgs }, null, 2));
    console.log(`Saved JVM arguments to ${jvmArgsFilePath}`);
}

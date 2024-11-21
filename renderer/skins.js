// Remove any imports or requires of skinview3d
const path = require('path');
const fs = require('fs');
const axios = require('axios');


function updateBoxShadow() {
    requestAnimationFrame(() => {
        const librarySection = document.querySelector('.library-section');
        if (librarySection) {
            // Add a transition for a smooth fade-in effect
            librarySection.style.transition = 'box-shadow 0.5s ease-in-out';

            const skinItems = document.querySelectorAll('.skin-item');
            console.log('Number of skin items:', skinItems.length); // Debugging line

            if (skinItems.length > 4) {
                librarySection.style.boxShadow = 'inset rgb(39, 39, 39) 0px -20px 20px -15px';
                console.log('Box shadow applied'); // Debugging line
            } else {
                librarySection.style.boxShadow = 'none';
                console.log('Box shadow removed'); // Debugging line
            }
        } else {
            console.error('Library section not found.');
        }
    });
}



function initializeSkinsPage() {
    window.loadSkinsOnStartup();
    window.loadCurrentUserSkin();

    const librarySection = document.querySelector('.library-section');

    const refreshButton = document.getElementById('refresh-skin-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            console.log('Refreshing current skin...');
            window.loadCurrentUserSkin();
        });
    }

    function updateBoxShadow() {
        requestAnimationFrame(() => {
            const librarySection = document.querySelector('.library-section');
            if (librarySection) {
                // Add a transition for a smooth fade-in effect
                librarySection.style.transition = 'box-shadow 0.5s ease-in-out';
    
                const skinItems = document.querySelectorAll('.skin-item');
                console.log('Number of skin items:', skinItems.length); // Debugging line
    
                if (skinItems.length > 4) {
                    librarySection.style.boxShadow = 'inset rgb(39, 39, 39) 0px -20px 20px -15px';
                    console.log('Box shadow applied'); // Debugging line
                } else {
                    librarySection.style.boxShadow = 'none';
                    console.log('Box shadow removed'); // Debugging line
                }
            } else {
                console.error('Library section not found.');
            }
        });
    }
    
    

    updateBoxShadow();
}


async function getAppDataPath() {
    return await ipcRenderer.invoke('get-app-data-path');
}

window.handleAddSkin = async function handleAddSkin() {
    try {
        const appDataPath = await ipcRenderer.invoke('get-app-data-path');
        const skinsFolderPath = path.join(appDataPath, 'launcher', 'skins');

        if (!fs.existsSync(skinsFolderPath)) {
            fs.mkdirSync(skinsFolderPath, { recursive: true });
            console.log('Skins folder created:', skinsFolderPath);
        }

        const { canceled, filePaths } = await ipcRenderer.invoke('open-file-dialog', {
            title: 'Select a Minecraft Skin',
            filters: [{ name: 'PNG Files', extensions: ['png'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) {
            return; // User canceled the dialog
        }

        let selectedSkinPath = filePaths[0];
        let skinFileName = path.basename(selectedSkinPath);
        let destinationPath = path.join(skinsFolderPath, skinFileName);

        // Check for duplicate filenames and add a suffix if needed
        let counter = 1;
        const fileExtension = path.extname(skinFileName);
        const baseName = path.basename(skinFileName, fileExtension);

        while (fs.existsSync(destinationPath)) {
            skinFileName = `${baseName}${counter}${fileExtension}`;
            destinationPath = path.join(skinsFolderPath, skinFileName);
            counter++;
        }

        // Copy the selected file to the skins folder with the unique name
        fs.copyFileSync(selectedSkinPath, destinationPath);
        console.log('Skin added:', destinationPath);

        // Load existing skins data
        let skinsData = await loadSkinData();
        
        // Add the new skin entry
        skinsData.push({ name: path.parse(skinFileName).name, path: destinationPath, mode: 'classic' });

        // Save the updated skins data
        await saveSkinData(skinsData);

        // Add the new skin to the library with the 3D viewer
        addSkinToLibrary(destinationPath, path.parse(skinFileName).name);

        updateBoxShadow();
    } catch (error) {
        console.error('Error adding skin:', error);
    }
};


async function saveSkinData(skinData) {
    try {
        const appDataPath = await getAppDataPath();
        const skinsFolderPath = path.join(appDataPath, 'launcher', 'skins');
        const skinsDataPath = path.join(skinsFolderPath, 'skins.json');

        // Ensure the skins folder path exists
        if (!fs.existsSync(skinsFolderPath)) {
            fs.mkdirSync(skinsFolderPath, { recursive: true });
            console.log('Skins folder path created:', skinsFolderPath);
        }

        // Check if skins.json exists; if not, create it with initial data
        if (!fs.existsSync(skinsDataPath)) {
            fs.writeFileSync(skinsDataPath, JSON.stringify([], null, 2), 'utf-8');
            console.log('skins.json created at:', skinsDataPath);
        }

        // Write or update the skins.json file
        fs.writeFileSync(skinsDataPath, JSON.stringify(skinData, null, 2), 'utf-8');
        console.log('Skins data saved successfully:', skinsDataPath);
    } catch (error) {
        console.error('Error saving skins data:', error);
    }
}

async function loadSkinData() {
    try {
        const appDataPath = await getAppDataPath();
        const skinsDataPath = path.join(appDataPath, 'launcher', 'skins', 'skins.json');

        // Check if the skins.json file exists and read it
        if (fs.existsSync(skinsDataPath)) {
            const data = fs.readFileSync(skinsDataPath, 'utf-8');
            console.log('Skins data loaded successfully');
            return JSON.parse(data);
        } else {
            console.log('No existing skins.json found, returning empty array');
            return [];
        }
    } catch (error) {
        console.error('Error reading skins data:', error);
        return [];
    }
}

window.loadSkinsOnStartup = async function loadSkinsOnStartup() {
    const skinData = await loadSkinData();
    if (skinData.length > 0) {
        skinData.forEach(skin => {
            addSkinToLibrary(skin.path, skin.name);
        });
    }
};

async function addSkinToLibrary(skinPath, skinName) {
    // Get the app data path asynchronously from the main process
    const appDataPath = await ipcRenderer.invoke('get-app-data-path');
    const skinsFilePath = path.join(appDataPath, 'launcher', 'skins', 'skins.json');
    const libraryContainer = document.getElementById('skin-library');

    if (libraryContainer) {
        const skinElement = document.createElement('div');
        skinElement.classList.add('skin-item');
        skinElement.style.display = 'inline-block';
        skinElement.style.margin = '10px';
        skinElement.style.textAlign = 'center';
        skinElement.style.position = 'relative';

        // Create a canvas element for the 3D model
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 150;
        skinElement.appendChild(canvas);

        // Convert local file path to a Blob URL
        const skinBlob = new Blob([fs.readFileSync(skinPath)], { type: 'image/png' });
        const skinUrl = URL.createObjectURL(skinBlob);

        // Render the 3D model using the skinview3d module
        const skinViewer = new skinview3d.SkinViewer({
            canvas: canvas,
            width: 110,
            height: 210,
            skin: skinUrl
        });

        skinViewer.playerObject.rotateY(0.436332);
        skinViewer.autoRotate = false;
        skinViewer.autoRotateSpeed = 0.5;

        // Create a container for the hover buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.top = '0';
        buttonContainer.style.left = '0';
        buttonContainer.style.width = '100%';
        buttonContainer.style.height = '100%';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.style.opacity = '0';
        buttonContainer.style.transition = 'opacity 0.3s ease';

        // Create the "Use" button
        const useButton = document.createElement('button');
        useButton.textContent = 'Use';
        useButton.style.backgroundColor = '#00a000';
        useButton.style.color = '#fff';
        useButton.style.border = 'none';
        useButton.style.padding = '5px 10px';
        useButton.style.marginBottom = '5px';
        useButton.style.cursor = 'pointer';
        useButton.style.borderRadius = '1px';
        useButton.style.width = '80%';
        useButton.style.opacity = '80%';

        // Create the "Skin Mode" button
        const skinModeButton = document.createElement('button');
        skinModeButton.textContent = 'Classic Selected';
        skinModeButton.style.backgroundColor = '#555';
        skinModeButton.style.color = '#fff';
        skinModeButton.style.border = 'none';
        skinModeButton.style.padding = '5px 10px';
        skinModeButton.style.marginBottom = '5px';
        skinModeButton.style.cursor = 'pointer';
        skinModeButton.style.borderRadius = '1px';
        skinModeButton.style.width = '80%';
        skinModeButton.style.opacity = '80%';

        // Create the "Delete" button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.style.backgroundColor = '#d9534f';
        deleteButton.style.color = '#fff';
        deleteButton.style.border = 'none';
        deleteButton.style.padding = '5px 10px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.borderRadius = '1px';
        deleteButton.style.width = '80%';
        deleteButton.style.opacity = '80%';

        deleteButton.addEventListener('click', async () => {
            try {
                let skinsData = [];
                if (fs.existsSync(skinsFilePath)) {
                    skinsData = JSON.parse(fs.readFileSync(skinsFilePath, 'utf-8'));
                }

                const skinIndex = skinsData.findIndex(entry => entry.name === skinName);
                if (skinIndex !== -1) {
                    updateBoxShadow()
                    // Remove the entry from skins.json
                    skinsData.splice(skinIndex, 1);
                    fs.writeFileSync(skinsFilePath, JSON.stringify(skinsData, null, 2));
                    console.log(`Deleted ${skinName} from skins.json`);

                    // Delete the associated .png file
                    fs.unlinkSync(skinPath);
                    console.log(`Deleted ${skinPath}`);

                    // Remove the skin element from the DOM
                    libraryContainer.removeChild(skinElement);
                    updateBoxShadow()
                } 
                else {
                    console.error('Skin not found in skins.json');
                }
            } catch (error) {
                console.error('Error deleting skin:', error);
            }
        });

        useButton.addEventListener('click', async () => {
            try {
                // Load skins data from skins.json
                const skinsData = await loadSkinData();
                const selectedSkin = skinsData.find(entry => entry.name === skinName);
        
                if (!selectedSkin) {
                    alert('Skin not found in the library.');
                    return;
                }
        
                const { path: skinPath, mode } = selectedSkin;
        
                // Convert local file path to a Blob URL for upload
                const skinBlob = new Blob([fs.readFileSync(skinPath)], { type: 'image/png' });
                const skinFile = new File([skinBlob], skinName + '.png', { type: 'image/png' });
        
                // Upload the skin to an image hosting service (e.g., imgbb)
                const formData = new FormData();
                formData.append('image', skinFile);
                
                try {
                    const uploadResponse = await axios.post('https://api.imgbb.com/1/upload', formData, {
                        params: { key: '468dedcbd050d7fa0abbcfd9fbe9dd95' }, // Replace with your actual API key
                    });
        
                    const skinUrl = uploadResponse.data.data.url;
                    console.log('Image uploaded, URL:', skinUrl);
        
                    // Ensure the URL is accessible with retries
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
        
                    // Invoke the apply-skin IPC event with the URL and mode
                    const response = await ipcRenderer.invoke('apply-skin', skinUrl, mode);
                    if (response.success) {
                        alert('Skin updated successfully!');
                        loadCurrentUserSkin();
                    } else {
                        alert('Failed to update skin: ' + response.error);
                    }
        
                } catch (uploadError) {
                    console.error('Error uploading skin:', uploadError);
                    alert('Failed to upload and apply skin. Please try again.');
                }
            } catch (error) {
                console.error('Error applying skin:', error);
                alert('Failed to apply skin.');
            }
        });

        // Load and update the skin mode
        let skinMode = 'classic'; // Default to "Classic"
        try {
            let skinsData = [];
            if (fs.existsSync(skinsFilePath)) {
                skinsData = JSON.parse(fs.readFileSync(skinsFilePath, 'utf-8'));
            }

            const skinIndex = skinsData.findIndex(entry => entry.name === skinName);
            if (skinIndex !== -1) {
                skinMode = skinsData[skinIndex].mode || 'classic';
                skinModeButton.textContent = skinMode === 'classic' ? 'Classic Selected' : 'Alex Selected';
            }

            skinModeButton.addEventListener('click', () => {
                skinMode = skinMode === 'classic' ? 'slim' : 'classic';
                skinModeButton.textContent = skinMode === 'classic' ? 'Classic Selected' : 'Alex Selected';

                if (skinIndex !== -1) {
                    skinsData[skinIndex].mode = skinMode;
                } else {
                    skinsData.push({ name: skinName, path: skinPath, mode: skinMode });
                }

                fs.writeFileSync(skinsFilePath, JSON.stringify(skinsData, null, 2));
                console.log(`Skin mode updated for ${skinName}: ${skinMode}`);
            });
        } catch (error) {
            console.error('Error updating or reading skins.json:', error);
        }

        // Add buttons and hover logic
        buttonContainer.appendChild(useButton);
        buttonContainer.appendChild(skinModeButton);
        buttonContainer.appendChild(deleteButton);
        skinElement.addEventListener('mouseover', () => {
            buttonContainer.style.opacity = '1';
        });
        skinElement.addEventListener('mouseout', () => {
            buttonContainer.style.opacity = '0';
        });

        skinElement.appendChild(buttonContainer);
        libraryContainer.appendChild(skinElement);

        // Clean up Blob URL after use
        canvas.addEventListener('load', () => {
            URL.revokeObjectURL(skinUrl);
        });
    } else {
        console.error('Library container not found.');
    }
    
}




async function loadCurrentUserSkin() {
    try {
        // Get auth data from the main process
        const authData = await ipcRenderer.invoke('get-auth-data');
        if (!authData || !authData.name) {
            console.error('Auth data is missing or invalid');
            return;
        }

        // Use the username to fetch the user's profile from Mojang's API
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${authData.name}`);
        if (!response.ok) {
            console.error('Failed to fetch user profile:', response.status);
            return;
        }

        const profile = await response.json();
        const uuid = profile.id;

        // Use the UUID to get the profile properties (including the skin URL)
        const profileResponse = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
        if (!profileResponse.ok) {
            console.error('Failed to fetch profile properties:', profileResponse.status);
            return;
        }

        const profileData = await profileResponse.json();
        const properties = profileData.properties.find(prop => prop.name === 'textures');
        if (!properties) {
            console.error('No textures property found');
            return;
        }

        // Decode the base64-encoded texture data
        const textureData = JSON.parse(atob(properties.value));
        const skinUrl = textureData.textures.SKIN.url;

        // Load the skin into the 3D model

        const canvas = document.getElementById('skin_container');
        if (canvas) {
            const skinViewer = new skinview3d.SkinViewer({
                canvas: canvas,
                width: 200,
                height: 400,
                skin: skinUrl
            });

            skinViewer.animation = new skinview3d.WalkingAnimation();
            skinViewer.autoRotate = false;
            skinViewer.autoRotateSpeed = 0.5;
            skinViewer.playerObject.rotateY(0.436332);
        } else {
            console.error('Canvas for skin container not found');
        }
    } catch (error) {
        console.error('Error loading current user skin:', error);
    }
}



// Call the function when the DOM content is loaded


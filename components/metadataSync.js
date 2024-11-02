const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sendToRenderer } = require('../main');

// Fetch function to handle the download
async function fetchWithDynamicImport(url) {
  const fetch = (await import('node-fetch')).default;
  return fetch(url);
}

// Function to calculate SHA-256 hash of a file
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// Function to download a file from a URL to a local destination
async function downloadFile(url, destination) {
  console.log(`Downloading file: ${url} to ${destination}`);
  const response = await fetchWithDynamicImport(url);
  if (!response.ok) {
    throw new Error(`Failed to download file from ${url}`);
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(destination, Buffer.from(buffer));
  console.log(`Downloaded file to ${destination}`);
}

// Function to synchronize all files across dynamic folders in metadata
async function synchronizeFiles(metadata, modpackName, instancePath) {
  const baseUrl = `https://cdn.andreasrp.com/rcg2/instances/${encodeURIComponent(modpackName)}/`;

  for (const [folderName, folderFiles] of Object.entries(metadata)) {
    const localFolderPath = path.join(instancePath, folderName);

    // Ensure folder exists locally
    if (!fs.existsSync(localFolderPath)) {
      fs.mkdirSync(localFolderPath, { recursive: true });
    }

    // Track files locally to detect user-added files
    const localFiles = fs.readdirSync(localFolderPath).filter((file) => fs.statSync(path.join(localFolderPath, file)).isFile());
    const serverFiles = Object.keys(folderFiles);
    
    // Detect and log user-added files
    const userAddedFiles = localFiles.filter((file) => !serverFiles.includes(file));
    if (userAddedFiles.length > 0) {
      console.log(`User-added files in ${folderName}:`, userAddedFiles);
    }

    // Loop through each file in the server's metadata for this folder
    for (const [fileName, expectedHash] of Object.entries(folderFiles)) {
      const localFilePath = path.join(localFolderPath, fileName);
      const remoteFileUrl = `${baseUrl}${folderName}/${fileName}`;

      try {
        // Check if the file exists and matches the expected hash
        if (fs.existsSync(localFilePath) && fs.lstatSync(localFilePath).isFile()) {
          const localFileHash = calculateFileHash(localFilePath);
          if (localFileHash === expectedHash) {
            console.log(`File ${folderName}/${fileName} is up-to-date.`);
            continue;
          } else {
            console.log(`File ${folderName}/${fileName} is outdated. Updating...`);
          }
        } else {
          console.log(`File ${folderName}/${fileName} is missing. Downloading...`);
        }

        // Download the file if it’s missing or outdated
        await downloadFile(remoteFileUrl, localFilePath);
      } catch (error) {
        console.error(`Error processing file ${folderName}/${fileName}:`, error);
      }
    }

    // Remove files from the local folder if they’re not in server metadata (optional)
    localFiles.forEach((file) => {
      if (!serverFiles.includes(file)) {
        const filePathToRemove = path.join(localFolderPath, file);
        fs.unlinkSync(filePathToRemove);
        console.log(`Removed outdated file: ${folderName}/${file}`);
      }
    });
  }

  console.log(`Synchronization complete for modpack: ${modpackName}`);
}

// Function to fetch metadata JSON from the server
async function fetchMetadata(modpackName) {
  const url = `https://cdn.andreasrp.com/rcg2/instances/${encodeURIComponent(modpackName)}/metadata.json`;
  console.log(`Fetching metadata from: ${url}`);

  const response = await fetchWithDynamicImport(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for modpack ${modpackName}`);
  }

  return await response.json();
}

module.exports = {
  fetchMetadata,
  downloadFile,
  synchronizeFiles,
};

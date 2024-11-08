const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Recursive function to process and sync only tracked files in metadata
async function processMetadataRecursively(folderMetadata, localFolderPath, remoteFolderPath) {
  // Ensure the local folder path exists
  if (!fs.existsSync(localFolderPath)) {
    fs.mkdirSync(localFolderPath, { recursive: true });
  }

  // Process each entry in the metadata
  for (const [entryName, entryValue] of Object.entries(folderMetadata)) {
    const localEntryPath = path.join(localFolderPath, entryName);
    const remoteEntryUrl = `${remoteFolderPath}/${entryName}`;

    if (typeof entryValue === 'string') {
      // Entry is a file with its hash
      try {
        // Check if the file exists and matches the expected hash
        if (fs.existsSync(localEntryPath) && fs.lstatSync(localEntryPath).isFile()) {
          const localFileHash = calculateFileHash(localEntryPath);
          if (localFileHash === entryValue) {
            console.log(`File ${entryName} is up-to-date.`);
            continue;
          } else {
            console.log(`File ${entryName} is outdated. Updating...`);
          }
        } else {
          console.log(`File ${entryName} is missing. Downloading...`);
        }

        // Download the file if it’s missing or outdated
        await downloadFile(remoteEntryUrl, localEntryPath);
      } catch (error) {
        console.error(`Error processing file ${entryName}:`, error);
      }
    } else if (typeof entryValue === 'object') {
      // Entry is a directory, so recurse
      await processMetadataRecursively(entryValue, localEntryPath, remoteEntryUrl);
    }
  }
}

// Function to remove outdated files based on the comparison of local and server metadata
function removeOutdatedFiles(localMetadata, serverMetadata, localFolderPath) {
  for (const [entryName, entryValue] of Object.entries(localMetadata)) {
    const localEntryPath = path.join(localFolderPath, entryName);

    if (!serverMetadata.hasOwnProperty(entryName)) {
      if (fs.existsSync(localEntryPath)) {
        if (fs.lstatSync(localEntryPath).isFile()) {
          fs.unlinkSync(localEntryPath);
          console.log(`Removed outdated file: ${localEntryPath}`);
        } else if (fs.lstatSync(localEntryPath).isDirectory()) {
          fs.rmdirSync(localEntryPath, { recursive: true });
          console.log(`Removed outdated directory: ${localEntryPath}`);
        }
      }
    } else if (typeof entryValue === 'object' && fs.existsSync(localEntryPath)) {
      // Recurse into directories to remove outdated files within them
      removeOutdatedFiles(entryValue, serverMetadata[entryName] || {}, localEntryPath);
    }
  }
}

// Main synchronization function that uses the updated metadata format
async function synchronizeFiles(metadata, modpackName, instancePath) {
  const baseUrl = `https://cdn.andreasrp.com/rcg2/instances/${encodeURIComponent(modpackName)}/`;
  const localMetadataPath = path.join(instancePath, 'local_metadata.json');

  // Load local metadata if it exists
  let localMetadata = {};
  if (fs.existsSync(localMetadataPath)) {
    localMetadata = JSON.parse(fs.readFileSync(localMetadataPath, 'utf-8'));
  }

  // Process files according to server metadata and update them as needed
  await processMetadataRecursively(metadata, instancePath, baseUrl);

  // Remove outdated files that are in the local metadata but not in the server metadata
  removeOutdatedFiles(localMetadata, metadata, instancePath);

  // Save the server metadata as the new local metadata for future checks
  fs.writeFileSync(localMetadataPath, JSON.stringify(metadata, null, 2));
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

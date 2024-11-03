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

  // Check for local files that aren't in metadata and skip them
  const localFiles = fs.readdirSync(localFolderPath);
  localFiles.forEach((localFile) => {
    const localFilePath = path.join(localFolderPath, localFile);
    if (!folderMetadata.hasOwnProperty(localFile) && fs.lstatSync(localFilePath).isFile()) {
      // Ignore files not in metadata; do not delete them
      console.log(`Ignoring user-added or Minecraft-generated file: ${localFile}`);
    }
  });
}

// Main synchronization function that uses the updated metadata format
async function synchronizeFiles(metadata, modpackName, instancePath) {
  const baseUrl = `https://cdn.andreasrp.com/rcg2/instances/${encodeURIComponent(modpackName)}/`;
  
  await processMetadataRecursively(metadata, instancePath, baseUrl);
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

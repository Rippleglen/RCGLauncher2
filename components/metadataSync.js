const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const extract = require('extract-zip');
const os = require('os');
const { app } = require('electron');
const events = require('events');
const eventEmitter = new events.EventEmitter();

const API_BASE = 'https://launcherapi.ripple-co.io';

const MANAGED_DIRECTORIES = {
  mods: 'mods',
  config: 'config',
  resourcepacks: 'resourcepacks',
  shaderpacks: 'shaderpacks',
  ffmpeg: 'ffmpeg'
};

async function fetchWithDynamicImport(url) {
  const fetch = (await import('node-fetch')).default;
  return fetch(url);
}

function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function getLocalModsList(instancePath) {
  const modsPath = path.join(instancePath, 'mods');
  const mods = {};
  
  if (fs.existsSync(modsPath)) {
    const files = await fs.promises.readdir(modsPath);
    for (const file of files) {
      const filePath = path.join(modsPath, file);
      if (fs.lstatSync(filePath).isFile()) {
        mods[file] = await calculateFileHash(filePath);
      }
    }
  }
  
  return mods;
}

async function syncModpackFiles(modpack, instancePath) {
  try {
    console.log(`Starting sync for modpack: ${modpack.name}`);

    // Get all current local files
    const currentFiles = await getLocalFilesList(instancePath);
    
    // Check with server
    const checkResponse = await fetch(`${API_BASE}/mods/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modpack: modpack.name,
        clientFiles: currentFiles
      })
    });

    if (!checkResponse.ok) {
      throw new Error(`Failed to check files: ${checkResponse.statusText}`);
    }

    const { needsUpdate, changes } = await checkResponse.json();
    
    if (needsUpdate) {
      console.log('Updates needed, preparing download...');
      
      // Request package preparation
      const prepareResponse = await fetch(`${API_BASE}/mods/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modpack: modpack.name,
          changes: changes
        })
      });

      if (!prepareResponse.ok) {
        throw new Error('Failed to prepare package');
      }

      const { packageId, downloadUrl } = await prepareResponse.json();
      
      // Download and extract package
      await downloadAndExtractPackage(`${API_BASE}${downloadUrl}`, instancePath, packageId);

      console.log('Sync completed successfully');
    } else {
      console.log('Files are up to date');
    }

    return true;
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

async function downloadAndExtractPackage(downloadUrl, instancePath, packageId) {
  const tempPath = path.join(os.tmpdir(), `modpack-${Date.now()}.zip`);
  let fileStream = null;
  
  try {
    const infoResponse = await fetch(`${API_BASE}/download/${packageId}/info`);
    if (!infoResponse.ok) throw new Error('Failed to get package info');
    
    const { totalSize, chunkSize, totalChunks } = await infoResponse.json();
    
    // Create the write stream
    fileStream = fs.createWriteStream(tempPath);
    
    eventEmitter.emit('download-status', {
      progress: 0,
      status: 'Starting download...'
    });

    console.log(`Downloading ${totalChunks} chunks...`);
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const response = await fetch(`${API_BASE}/download/${packageId}/chunk/${chunkIndex}`);
      if (!response.ok) throw new Error(`Failed to download chunk ${chunkIndex}`);
      
      const buffer = await response.arrayBuffer();
      
      // Write chunk to file
      await new Promise((resolve, reject) => {
        fileStream.write(Buffer.from(buffer), error => {
          if (error) reject(error);
          const progress = ((chunkIndex + 1) / totalChunks) * 100;
          eventEmitter.emit('download-status', {
            progress,
            status: `Downloaded chunk ${chunkIndex + 1}/${totalChunks}`
          });
          resolve();
        });
      });
    }

    // Close the file stream
    await new Promise((resolve, reject) => {
      fileStream.end(err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    eventEmitter.emit('download-status', {
      progress: 100,
      status: 'Extracting files...'
    });

    console.log('Download complete, extracting...');
    await extract(tempPath, { dir: instancePath });
    console.log('Extraction complete');

    eventEmitter.emit('download-status', {
      progress: 100,
      status: 'Launch ready!'
    });

    // Notify server for cleanup
    await fetch(`${API_BASE}/mods/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId })
    });

  } catch (error) {
    eventEmitter.emit('download-error', error.message);
    throw error;
  } finally {
    if (fileStream) {
      fileStream.end();
    }
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

async function getLocalFilesList(instancePath) {
  const files = {};
  
  for (const [dirType, dirPath] of Object.entries(MANAGED_DIRECTORIES)) {
    files[dirType] = {};
    const fullPath = path.join(instancePath, dirPath);
    
    if (fs.existsSync(fullPath)) {
      // Get files recursively including subdirectories
      const getFilesRecursively = async (dir, baseDir = dir) => {
        const results = {};
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (entry.isDirectory()) {
            const subResults = await getFilesRecursively(fullPath, baseDir);
            Object.assign(results, subResults);
          } else {
            results[relativePath] = await calculateFileHash(fullPath);
          }
        }
        
        return results;
      };

      files[dirType] = await getFilesRecursively(fullPath);
    }
  }
  
  return files;
}

async function fetchMetadata(modpackName) {
  const url = `${API_BASE}/metadata/${encodeURIComponent(modpackName)}`;
  console.log(`Fetching metadata for ${modpackName}`);

  const response = await fetchWithDynamicImport(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for modpack ${modpackName}`);
  }

  return await response.json();
}

module.exports = {
  fetchMetadata,
  syncModpackFiles,
  getLocalModsList,
  eventEmitter  // Export the event emitter
};
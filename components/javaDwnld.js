const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const unzipper = require('unzipper');
const os = require('os');
const javaBaseDir = path.join(os.homedir(), 'AppData', 'Roaming', '.RCGLauncher2', 'launcher', 'java');
const { getJavaVersionForMinecraft } = require('./javaVersionParser');

// Function to fetch the download URL for the Java version
async function fetchJavaDownloadUrl(majorVersion) {
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${majorVersion}/hotspot`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    const javaAsset = data.find(asset => asset.binary.os === 'windows' && asset.binary.image_type === 'jre');
    if (!javaAsset) {
        throw new Error(`Java version ${majorVersion} not found for Windows.`);
    }
    return javaAsset.binary.package.link;
}

// Main function to download, unzip, and organize Java
async function downloadJava(version) {
    try {
        const finalJavaPath = path.join(javaBaseDir, `java${version}`);

        // Check if the Java version is already downloaded
        if (fs.existsSync(finalJavaPath)) {
            console.log(`Java ${version} is already present at ${finalJavaPath}. Skipping download.`);
            return;
        }

        // Proceed with download if not found
        const downloadUrl = await fetchJavaDownloadUrl(version);
        const zipPath = path.join(javaBaseDir, `java${version}.zip`);
        const tempUnzipPath = path.join(javaBaseDir, `java${version}_temp`);

        // Ensure the base directory exists
        await fsPromises.mkdir(javaBaseDir, { recursive: true });

        // Step 1: Download the ZIP file
        console.log(`Downloading Java ${version} from ${downloadUrl}`);
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`Failed to download Java ${version}`);

        const fileStream = fs.createWriteStream(zipPath);
        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream)
                .on('finish', resolve)
                .on('error', reject);
        });

        // Step 2: Unzip to temporary folder
        console.log(`Unzipping Java ${version}`);
        await unzipJava(zipPath, tempUnzipPath);

        // Step 3: Move and organize files
        console.log(`Organizing Java files for version ${version}`);
        await moveAndOrganizeJavaFiles(tempUnzipPath, finalJavaPath);

        // Step 4: Delete the original ZIP file after successful extraction
        await fsPromises.unlink(zipPath);
        console.log(`Java ${version} downloaded, set up successfully at ${finalJavaPath}, and ZIP file removed.`);
    } catch (error) {
        console.error(`Error downloading Java ${version}:`, error);
    }
}


// Unzip the downloaded Java ZIP file
async function unzipJava(zipFilePath, destinationPath) {
    console.log(`Starting to unzip ${zipFilePath} to ${destinationPath}`);
    await fsPromises.mkdir(destinationPath, { recursive: true });

    return new Promise((resolve, reject) => {
        const zipStream = fs.createReadStream(zipFilePath)
            .pipe(unzipper.Extract({ path: destinationPath }));

        zipStream.on('close', () => {
            console.log(`Successfully unzipped to ${destinationPath}`);
            resolve();
        });

        zipStream.on('error', (error) => {
            console.error(`Error unzipping ${zipFilePath}:`, error);
            reject(error);
        });
    });
}


// Organize unzipped Java files into the final directory
async function moveAndOrganizeJavaFiles(tempDir, finalDir) {
    const [javaFolder] = await fsPromises.readdir(tempDir);
    const javaFolderPath = path.join(tempDir, javaFolder);

    await fsPromises.mkdir(finalDir, { recursive: true });

    const items = await fsPromises.readdir(javaFolderPath);
    for (const item of items) {
        const srcPath = path.join(javaFolderPath, item);
        const destPath = path.join(finalDir, item);
        await fsPromises.rename(srcPath, destPath);
    }

    // Clean up temporary files
    await fsPromises.rm(tempDir, { recursive: true, force: true });
    await fsPromises.unlink(path.join(finalDir, path.basename(finalDir) + '.zip')).catch(() => {}); // Ignore errors if not found
}

async function getJavaPathForMinecraftVersion(minecraftVersion) {
    try {
      // Step 1: Determine required Java version
      const requiredJavaVersion = await getJavaVersionForMinecraft(minecraftVersion);
      if (!requiredJavaVersion) throw new Error(`Java version not found for Minecraft ${minecraftVersion}`);
  
      // Step 2: Set path to Java based on the version found
      const javaPath = path.join(javaBaseDir, `java${requiredJavaVersion}`, 'bin', 'javaw.exe');
  
      // Check if javaw.exe exists
      try {
        await fs.access(javaPath);
        console.log(`Found javaw.exe for Minecraft ${minecraftVersion} at ${javaPath}`);
        return javaPath;
      } catch {
        console.error(`Java ${requiredJavaVersion} is not installed. Initiating download...`);
        // Download the required Java version if not found
        await downloadJava(requiredJavaVersion);
        return path.join(javaBaseDir, `java${requiredJavaVersion}`, 'bin', 'javaw.exe');
      }
    } catch (error) {
      console.error(`Error retrieving Java path for Minecraft ${minecraftVersion}:`, error);
      throw error;
    }
  }

module.exports = {
    fetchJavaDownloadUrl,
    downloadJava,
    getJavaPathForMinecraftVersion,
};

let axios;
const path = require('path');
const os = require('os');

async function initializeDependencies() {
    const axiosModule = await import('axios');
    axios = axiosModule.default;
}

async function getJavaVersionForMinecraft(versionId) {
    try {
      // Ensure axios is initialized
      if (!axios) await initializeDependencies();
  
      // Fetch the main manifest
      const manifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
      const manifestResponse = await axios.get(manifestUrl);
      const versions = manifestResponse.data.versions;
  
      // Find the version info for the specified versionId
      const versionInfo = versions.find(v => v.id === versionId);
      if (!versionInfo) {
        throw new Error(`Version ${versionId} not found in manifest.`);
      }
  
      // Fetch the version-specific JSON
      const versionJsonResponse = await axios.get(versionInfo.url);
      const javaVersion = versionJsonResponse.data.javaVersion;
      
      return javaVersion ? javaVersion.majorVersion : null;
    } catch (error) {
      console.error('Error fetching Java version:', error);
      throw error;
    }
}

async function getJavaPathForMinecraftVersion(versionId) {
    try {
        const javaVersion = await getJavaVersionForMinecraft(versionId);

        if (!javaVersion) {
            throw new Error(`Java version not found for Minecraft version ${versionId}`);
        }

        // Form the path to the Java executable based on the version
        const javaPath = path.join(
            os.homedir(),
            'AppData',
            'Roaming',
            '.RCGLauncher2',
            'launcher',
            'java',
            `java${javaVersion}`,
            'bin',
            'javaw.exe'
        );

        return javaPath;
    } catch (error) {
        console.error('Error finding Java path:', error);
        throw error;
    }
}

module.exports = {
    getJavaVersionForMinecraft,
    getJavaPathForMinecraftVersion,
};
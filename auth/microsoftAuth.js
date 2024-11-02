// auth/microsoftAuth.js
const { ipcMain, BrowserWindow } = require('electron');
const axios = require('axios');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const keytar = require('keytar');

const AZURE_CLIENT_ID = '4da45d88-11be-47e7-8ea7-f3b7023b9302';
const REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
const service = 'RCGLauncher2';
const account = 'EncryptionKey';

async function getEncryptionKey() {
  let encryptionKey = await keytar.getPassword(service, account);
  if (!encryptionKey) {
    encryptionKey = crypto.randomBytes(32).toString('hex');
    await keytar.setPassword(service, account, encryptionKey);
  }
  return Buffer.from(encryptionKey, 'hex');
}

async function encrypt(data, encryptionKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(data, encryptionKey) {
  const [ivHex, encryptedData] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

async function saveAuthData(data, appDataPath) {
  try {
    const encryptionKey = await getEncryptionKey();
    const encryptedData = await encrypt(data, encryptionKey);

    if (!fs.existsSync(appDataPath)) {
      fs.mkdirSync(appDataPath, { recursive: true });
    }

    fs.writeFileSync(path.join(appDataPath, 'auth.json'), encryptedData); // Save encrypted data
    console.log('Authentication data saved and encrypted.');
  } catch (error) {
    console.error('Error saving encrypted authentication data:', error);
  }
}

// auth/microsoftAuth.js
async function loadAuthData(appDataPath) {
  try {
    const encryptionKey = await getEncryptionKey();
    const authFilePath = path.join(appDataPath, 'auth.json'); // Define the path here explicitly

    if (fs.existsSync(authFilePath)) {
      const encryptedData = fs.readFileSync(authFilePath, 'utf-8');
      return decrypt(encryptedData, encryptionKey);
    }
    return null;
  } catch (error) {
    console.error('Error loading encrypted authentication data:', error);
    throw error;
  }
}


function setupMicrosoftAuth(mainWindow, appDataPath) {
  ipcMain.handle('msft-login', async () => {
    const authWindow = new BrowserWindow({
      width: 500,
      height: 650,
      parent: mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const scopes = ['XboxLive.signin'];
    const authUrl =
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' +
      querystring.stringify({
        client_id: AZURE_CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        response_mode: 'query',
        scope: scopes.join(' '),
      });

    let resolvePromise;
    let rejectPromise;
    const authPromise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    authWindow.loadURL(authUrl);

    let handled = false;

    const handleNavigation = async (url) => {
      if (handled) return;
      if (url.startsWith(REDIRECT_URI)) {
        handled = true;
        const urlParams = new URLSearchParams(new URL(url).search);
        const code = urlParams.get('code');

        if (code) {
          authWindow.close();

          try {
            const tokenResponse = await getAccessToken(code);
            const xblResponse = await getXBLToken(tokenResponse.access_token);
            const xstsResponse = await getXSTSToken(xblResponse.Token);
            const mcAccessToken = await getMinecraftToken(
              xblResponse.DisplayClaims.xui[0].uhs,
              xstsResponse.Token
            );
            const mcProfile = await getMinecraftProfile(mcAccessToken.access_token);

            const authData = {
              access_token: mcAccessToken.access_token,
              uuid: mcProfile.id,
              name: mcProfile.name,
              user_properties: '{}',
            };
            try {
              await saveAuthData(authData, appDataPath);
            } catch (error) {
              console.error('Error in main code calling saveAuthData:', error);
            }

            resolvePromise(authData);
          } catch (error) {
            console.error('Authentication error:', error);
            rejectPromise(error);
          }
        } else {
          rejectPromise(new Error('No code found in redirect URI'));
        }
      }
    };

    authWindow.webContents.on('will-navigate', (event, url) => {
      handleNavigation(url);
    });

    authWindow.webContents.on('will-redirect', (event, url) => {
      handleNavigation(url);
    });

    authWindow.on('closed', () => {
      if (!handled) {
        handled = true;
        rejectPromise(new Error('User closed the login window'));
      }
    });

    return authPromise;
  });
}

async function getAccessToken(code) {
  const tokenEndpoint = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';

  const params = {
    client_id: AZURE_CLIENT_ID,
    scope: 'XboxLive.signin',
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  };

  try {
    const response = await axios.post(tokenEndpoint, querystring.stringify(params), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data; // Contains access_token and refresh_token
  } catch (error) {
    console.error('Error obtaining access token:', error.response?.data || error.message);
    throw new Error('Failed to obtain access token');
  }
}

async function getXBLToken(accessToken) {
  try {
    const response = await axios.post('https://user.auth.xboxlive.com/user/authenticate', {
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${accessToken}`, // Add accessToken here
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data; // Contains Xbox Live token and other data
  } catch (error) {
    console.error('Failed to get Xbox Live token:', error.response?.data || error.message);
    throw new Error('Failed to get Xbox Live token');
  }
}

async function getXSTSToken(xblToken) {
  try {
    const response = await axios.post('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: {
        SandboxId: 'RETAIL', // For general use, 'RETAIL' is usually the correct value
        UserTokens: [xblToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data; // Contains XSTS token and other data
  } catch (error) {
    console.error('Failed to get XSTS token:', error.response?.data || error.message);
    throw new Error('Failed to get XSTS token');
  }
}

async function getMinecraftToken(uhs, xstsToken) {
  try {
    const response = await axios.post('https://api.minecraftservices.com/authentication/login_with_xbox', {
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    return response.data; // Contains Minecraft access token and other data
  } catch (error) {
    console.error('Failed to get Minecraft token:', error.response?.data || error.message);
    throw new Error('Failed to get Minecraft token');
  }
}

async function getMinecraftProfile(accessToken) {
  try {
    const response = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data; // Contains the Minecraft profile information, including UUID and name
  } catch (error) {
    console.error('Failed to get Minecraft profile:', error.response?.data || error.message);
    throw new Error('Failed to get Minecraft profile');
  }
}




module.exports = { setupMicrosoftAuth, loadAuthData, saveAuthData };

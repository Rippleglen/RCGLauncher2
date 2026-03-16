import { BrowserWindow } from 'electron'
import axios from 'axios'
import { stringify } from 'querystring'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import keytar from 'keytar'

const AZURE_CLIENT_ID = '4da45d88-11be-47e7-8ea7-f3b7023b9302'
const REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient'
const KEYTAR_SERVICE = 'RCGLauncher2'
const KEYTAR_ACCOUNT = 'EncryptionKey'

// --- Encryption helpers ---

async function getEncryptionKey() {
  let key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
  if (!key) {
    key = randomBytes(32).toString('hex')
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, key)
  }
  return Buffer.from(key, 'hex')
}

async function encrypt(data, key) {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

function decrypt(data, key) {
  const [ivHex, encrypted] = data.split(':')
  const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return JSON.parse(decrypted)
}

// --- Auth data persistence ---

export async function saveAuthData(data, appDataPath) {
  const key = await getEncryptionKey()
  const encrypted = await encrypt(data, key)
  mkdirSync(appDataPath, { recursive: true })
  writeFileSync(join(appDataPath, 'auth.json'), encrypted)
}

async function loadAuthData(appDataPath) {
  const authFile = join(appDataPath, 'auth.json')
  if (!existsSync(authFile)) return null
  const key = await getEncryptionKey()
  return decrypt(readFileSync(authFile, 'utf-8'), key)
}

export async function clearAuthData(appDataPath) {
  const authFile = join(appDataPath, 'auth.json')
  if (existsSync(authFile)) {
    writeFileSync(authFile, '')
  }
}

// --- OAuth / Minecraft token chain ---

async function getAccessToken(code) {
  const res = await axios.post(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    stringify({
      client_id: AZURE_CLIENT_ID,
      scope: 'XboxLive.signin offline_access',
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return res.data
}

async function refreshAccessToken(refreshToken) {
  const res = await axios.post(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    stringify({
      client_id: AZURE_CLIENT_ID,
      scope: 'XboxLive.signin offline_access',
      refresh_token: refreshToken,
      redirect_uri: REDIRECT_URI,
      grant_type: 'refresh_token',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return res.data
}

async function getXBLToken(accessToken) {
  const res = await axios.post('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${accessToken}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  })
  return res.data
}

async function getXSTSToken(xblToken) {
  const res = await axios.post('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT',
  })
  return res.data
}

async function getMinecraftToken(uhs, xstsToken) {
  const res = await axios.post('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
  })
  return res.data
}

async function getMinecraftProfile(accessToken) {
  const res = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res.data
}

async function buildMinecraftAuthFromMsToken(msAccessToken, msRefreshToken) {
  const expiresAt = Date.now() + msAccessToken.expires_in * 1000
  const xbl = await getXBLToken(msAccessToken.access_token)
  const xsts = await getXSTSToken(xbl.Token)
  const mc = await getMinecraftToken(xbl.DisplayClaims.xui[0].uhs, xsts.Token)
  const profile = await getMinecraftProfile(mc.access_token)
  return {
    access_token: mc.access_token,
    refresh_token: msRefreshToken ?? msAccessToken.refresh_token,
    expires_at: expiresAt,
    uuid: profile.id,
    name: profile.name,
    user_properties: '{}',
  }
}

async function ensureValidAccessToken(authData, appDataPath) {
  if (Date.now() < authData.expires_at) return authData

  const refreshed = await refreshAccessToken(authData.refresh_token)
  const updated = await buildMinecraftAuthFromMsToken(refreshed, refreshed.refresh_token)
  updated.name = updated.name ?? authData.name
  updated.uuid = updated.uuid ?? authData.uuid
  await saveAuthData(updated, appDataPath)
  return updated
}

// --- Public API ---

export async function setupMicrosoftAuth(mainWindow, appDataPath) {
  const authWindow = new BrowserWindow({
    width: 500,
    height: 650,
    parent: mainWindow,
    modal: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  const authUrl = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?' +
    stringify({
      client_id: AZURE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      response_mode: 'query',
      scope: 'XboxLive.signin offline_access',
    })

  authWindow.loadURL(authUrl)

  return new Promise((resolve, reject) => {
    let handled = false

    const handle = async (url) => {
      if (handled || !url.startsWith(REDIRECT_URI)) return
      handled = true
      authWindow.close()

      const code = new URLSearchParams(new URL(url).search).get('code')
      if (!code) return reject(new Error('No auth code in redirect'))

      try {
        const tokens = await getAccessToken(code)
        const authData = await buildMinecraftAuthFromMsToken(tokens)
        await saveAuthData(authData, appDataPath)
        resolve(authData)
      } catch (err) {
        reject(err)
      }
    }

    authWindow.webContents.on('will-navigate', (_, url) => handle(url))
    authWindow.webContents.on('will-redirect', (_, url) => handle(url))
    authWindow.on('closed', () => {
      if (!handled) reject(new Error('Login window closed'))
    })
  })
}

export async function getValidAuthData(appDataPath) {
  const authData = await loadAuthData(appDataPath)
  if (!authData) throw new Error('No auth data found')
  return await ensureValidAccessToken(authData, appDataPath)
}

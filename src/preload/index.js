import { contextBridge, ipcRenderer } from 'electron'

// Everything the renderer can call — no raw Node/Electron APIs leak through
contextBridge.exposeInMainWorld('electron', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // Auth
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    getUser: () => ipcRenderer.invoke('auth:getUser'),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },

  // Game
  game: {
    fetchModpacks: () => ipcRenderer.invoke('game:fetchModpacks'),
    launch: (modpack) => ipcRenderer.invoke('game:launch', modpack),
    onProgress: (cb) => ipcRenderer.on('game:progress', (_, data) => cb(data)),
    onStatus: (cb) => ipcRenderer.on('game:status', (_, data) => cb(data)),
    onLog: (cb) => ipcRenderer.on('game:log', (_, data) => cb(data)),
    onClosed: (cb) => ipcRenderer.on('game:closed', (_, data) => cb(data)),
    removeListeners: () => {
      ipcRenderer.removeAllListeners('game:progress')
      ipcRenderer.removeAllListeners('game:status')
      ipcRenderer.removeAllListeners('game:log')
      ipcRenderer.removeAllListeners('game:closed')
    }
  },

  // Config / settings
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (updates) => ipcRenderer.invoke('config:set', updates),
    getSystemRam: () => ipcRenderer.invoke('config:getSystemRam'),
    getVersion: () => ipcRenderer.invoke('config:getVersion'),
    getJvmArgs:         (modpackName) => ipcRenderer.invoke('config:getJvmArgs', modpackName),
    setJvmArgs:         (modpackName, args) => ipcRenderer.invoke('config:setJvmArgs', modpackName, args),
    getDefaultJvmFlags: (mcVersion)   => ipcRenderer.invoke('config:getDefaultJvmFlags', mcVersion),
  },

  // Admin / authoring tool
  admin: {
    validateKey: (key) => ipcRenderer.invoke('admin:validateKey', key),
    saveModpack: (key, meta, isNew) => ipcRenderer.invoke('admin:saveModpack', key, meta, isNew),
    listFiles: (key, modpackName) => ipcRenderer.invoke('admin:listFiles', key, modpackName),
    pickFiles: () => ipcRenderer.invoke('admin:pickFiles'),
    uploadFile: (key, modpackName, category, filePath) => ipcRenderer.invoke('admin:uploadFile', key, modpackName, category, filePath),
    deleteFile: (key, modpackName, category, filename) => ipcRenderer.invoke('admin:deleteFile', key, modpackName, category, filename),
    updateTiers: (key, modpackName, tiers) => ipcRenderer.invoke('admin:updateTiers', key, modpackName, tiers),
    deleteModpack: (key, modpackName) => ipcRenderer.invoke('admin:deleteModpack', key, modpackName),
    regenerateManifest: (key, modpackName) => ipcRenderer.invoke('admin:regenerateManifest', key, modpackName),
  },

  // Skin management
  skins: {
    list:          (uuid)                     => ipcRenderer.invoke('skins:list', uuid),
    getBodyRender: (uuid)                     => ipcRenderer.invoke('skins:getBodyRender', uuid),
    pickFile: ()                              => ipcRenderer.invoke('skins:pickFile'),
    upload:   (uuid, skinType, label, path)   => ipcRenderer.invoke('skins:upload', { uuid, skinType, label, filePath: path }),
    delete:   (uuid, skinId)                  => ipcRenderer.invoke('skins:delete', { uuid, skinId }),
    apply:    (skinUrl, skinType)             => ipcRenderer.invoke('skins:apply', { skinUrl, skinType }),
  },

  // Updater — pull based: call check(), await it, listen for status updates
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    onStatus: (cb) => ipcRenderer.on('updater:status', (_, data) => cb(data)),
  }
})

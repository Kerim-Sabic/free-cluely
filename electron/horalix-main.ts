/**
 * Horalix Halo - Electron Main Process
 *
 * Beautiful, modern Electron app for meeting assistant
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'
const VITE_DEV_SERVER_URL = 'http://localhost:5180'

// ============================================================================
// IPC HANDLERS
// ============================================================================

// LLM generate handler (mock for now)
ipcMain.handle('llm:generate', async (_event, ...args: any[]) => {
  const prompt = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])
  console.log('[IPC] llm:generate called with prompt:', prompt.substring(0, 50) + '...')
  // Return a mock response for now
  return {
    success: true,
    response: 'AI response functionality coming soon. The UI is ready and beautiful!',
  }
})

// Shell open external (for opening links)
ipcMain.handle('shell:openExternal', async (_event, url: string) => {
  const { shell } = require('electron')
  await shell.openExternal(url)
  return { success: true }
})

// ============================================================================
// WINDOW CREATION
// ============================================================================

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'horalix-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // Keep animations smooth
    },
    // Beautiful modern window styling
    frame: true,
    titleBarStyle: 'hiddenInset', // Modern macOS-style title bar
    backgroundColor: '#0f0f23', // Deep purple-black background
    transparent: false, // Set to false for better performance, use CSS for transparency
    vibrancy: 'under-window', // macOS vibrancy effect (dark background)
    visualEffectState: 'active',
  })

  // Load the app
  if (isDev) {
    await mainWindow.loadURL(VITE_DEV_SERVER_URL)
    // Don't auto-open DevTools - user can open with F12 or Ctrl+Shift+I if needed
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  console.log('[Horalix Halo] Window created successfully')
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(async () => {
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

console.log('[Horalix Halo] Electron app started - Modern UI ready! 🚀')

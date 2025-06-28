import { app, shell, BrowserWindow, ipcMain, screen, desktopCapturer, globalShortcut, DesktopCapturerSource } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { exec } from 'child_process'
import { vl } from 'moondream'
import { uIOhook } from 'uiohook-napi'
import { ChatState, sendInitialMessage, sendMessage } from './chat'
import { OpenAIClient } from './openai_client'

// Moondream model initialization
const model = new vl({ apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlfaWQiOiI5ZGRmMTI5Mi1kYTRjLTQxMTktOGMwZC05NjNhOTFiMzgxMGIiLCJvcmdfaWQiOiJub21QVmNWZ08weGE0OEhLWHR3WVh0dVZyZE9rNGhqaSIsImlhdCI6MTc1MTAwMzkxMywidmVyIjoxfQ.QDcCFnf2v7eXNQTt0PFwU5rx-sDa3lhzJruGXy-xw_Y' })
const chat = new ChatState(process.env.GET_RESOURCES_URL || "http://localhost:8000/resources")
const openai = new OpenAIClient()

interface Point {
  x: number
  y: number
}

async function find_coord(image: Buffer, text: string): Promise<Point | null> {
  const result = await model.point({
    image,
    object: `"${text}"`
  })

  if (result.points.length > 0) {
    const [point] = result.points
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const pos = {
      x: point.x * width,
      y: point.y * height
    }
    return pos
  }
  return null
}

function take_screenshot(primaryScreen: DesktopCapturerSource) {
  const image = primaryScreen.thumbnail.toPNG()
  return image
}

async function determine_primary_screen(): Promise<DesktopCapturerSource> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: screen.getPrimaryDisplay().size
  })
  const primaryScreen = sources.find((source) => source.display_id === String(screen.getPrimaryDisplay().id))

  if (!primaryScreen) {
    throw new Error('Primary screen not found')
  }

  return primaryScreen
}

function instruct_user(mainWindow: BrowserWindow, pos: Point, text: string): void {
  mainWindow.webContents.send('show-visual-cue', pos)
  mainWindow.webContents.send('update-assistant-text', text)
}

function waitForClickNear(pos: Point, radius: number): Promise<Point> {
  return new Promise((resolve) => {
    const clickListener = (event: { x: number; y: number }): void => {
      // event.x is relative to the right, not left, so we need to subtract it from the width of the screen
      const clicked_x = (event.x / 2560) * screen.getPrimaryDisplay().workAreaSize.width
      const clicked_y = (event.y / 1600) * screen.getPrimaryDisplay().workAreaSize.height

      // #print screen size
      // console.log(screen.getPrimaryDisplay().workAreaSize)

      const distance = Math.sqrt(Math.pow(clicked_x - pos.x, 2) + Math.pow(clicked_y - pos.y, 2))
      // console.log(
      //   `Click detected at: { x: ${clicked_x}, y: ${clicked_y} }. Target area: { x: ${pos.x}, y: ${pos.y}, radius: ${radius} }. Distance: ${distance.toFixed(2)}px`
      // )
      if (distance <= radius) {
        uIOhook.removeListener('mousedown', clickListener)
        resolve({ x: event.x, y: event.y })
      }
    }
    uIOhook.on('mousedown', clickListener)
  })
}

function createWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    show: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    focusable: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

async function startTutorial(mainWindow: BrowserWindow): Promise<void> {
  mainWindow.webContents.send('update-assistant-text', 'I will now open Google Chrome and navigate to the NYC.gov website for you.')

  // 1. Open Chrome
  if (process.platform === 'win32') {
    exec('start chrome "https://portal.311.nyc.gov/"')
  } else {
    shell.openExternal('https://portal.311.nyc.gov/')
  }

  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for browser to open

  mainWindow.webContents.send('set-accept-message', true)
  mainWindow.webContents.send('update-assistant-text', 'Alright, now that the website is open, how can I help?')
}

async function instructUser(mainWindow: BrowserWindow, url: string, context: string) {
  console.log("Instructing user", "URL: ", url)

  if (process.platform === 'win32') {
    exec(`start chrome "${url}"`)
  } else {
    shell.openExternal(url)
  }
  
  mainWindow.webContents.send('update-assistant-text', 'Now, I am looking for the "Report Problems" button on the page.')

  try {
    const primaryScreen = await determine_primary_screen()
    const image = take_screenshot(primaryScreen)
    
    let pos = await find_coord(image, 'Report Problems')
    let visual_pos = pos
    if (pos) {
      visual_pos = {
        x: pos.x,
        y: pos.y + 25
      }
    }

    if (visual_pos && pos) {
      instruct_user(
        mainWindow,
        visual_pos,
        'Found it! Please click on the "Report Problems" button, which I have highlighted for you.'
      )

      // Build a function that will detect if the user has clicked on pos within a 25px radius
      await waitForClickNear(pos, 25)


      // remove the visual cue
      mainWindow.webContents.send('remove-visual-cue')
      mainWindow.webContents.send(
        'update-assistant-text',
        "Great job! You clicked the button. Now I'll look for the next step."
      )
    }
  } catch (e) {
    console.error('Error in CV loop:', e)
    mainWindow.webContents.send('update-assistant-text', 'I ran into a problem. Trying again.')
  }
}

async function handleSendMessage(mainWindow: BrowserWindow, message: string, chat: ChatState, openai: OpenAIClient) {
  mainWindow.webContents.send('set-accept-message', false)
  
  const changeAssistantText = (text: string) => {
    mainWindow.webContents.send('update-assistant-text', text)
  }

  const sendPrompt = async (prompt: string) => {
    return await openai.sendPrompt(prompt)
  }

  const suggestSolution = (url: string) => {
    mainWindow.webContents.send('suggest-solution-url', url)
  }

  suggestSolution("")

  if (chat.getConversationHistory().length === 0) {
    const initialResponse = await sendInitialMessage(message, chat, sendPrompt)
    if (initialResponse.message) {
      changeAssistantText(initialResponse.message)
    }
  }

  const response = await sendMessage(message, chat, sendPrompt)
  if (response.message) {
    changeAssistantText(response.message)
  }
  if (response.solution_url) {
    suggestSolution(response.solution_url)
  }
  
  mainWindow.webContents.send('set-accept-message', true)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  uIOhook.start()
  const mainWindow = createWindow()

  // Start the tutorial once the window is ready
  mainWindow.webContents.once('dom-ready', () => {
    startTutorial(mainWindow)
  })

  ipcMain.on('mouse-enter-interactive-area', () => {
    mainWindow.setFocusable(true)
    mainWindow.focus()
    mainWindow.setIgnoreMouseEvents(false)
  })

  ipcMain.on('mouse-leave-interactive-area', () => {
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
    mainWindow.setFocusable(false)
  })

  ipcMain.on('accept-solution', (event, url: string) => {
    mainWindow.webContents.send('suggest-solution-url', '')
    instructUser(mainWindow, url, chat.getContext())
  })

  ipcMain.on('send-message', (event, message: string) => {
    handleSendMessage(mainWindow, message, chat, openai)
  })

  globalShortcut.register('CommandOrControl+]', () => {
    mainWindow.setFocusable(true)
    mainWindow.focus()
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.webContents.send('focus-chat-input')
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.disableHardwareAcceleration()
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  // uiohook-napi will stop with the process, no need to call stop()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

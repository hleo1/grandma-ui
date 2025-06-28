import { app, shell, BrowserWindow, ipcMain, screen, desktopCapturer, globalShortcut, DesktopCapturerSource } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { exec } from 'child_process'
import { vl } from 'moondream'
import { uIOhook } from 'uiohook-napi'
import * as fs from "node:fs"
import { GoogleGenAI } from "@google/genai";
// Moondream model initialization
const model = new vl({ apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlfaWQiOiI5ZGRmMTI5Mi1kYTRjLTQxMTktOGMwZC05NjNhOTFiMzgxMGIiLCJvcmdfaWQiOiJub21QVmNWZ08weGE0OEhLWHR3WVh0dVZyZE9rNGhqaSIsImlhdCI6MTc1MTAwMzkxMywidmVyIjoxfQ.QDcCFnf2v7eXNQTt0PFwU5rx-sDa3lhzJruGXy-xw_Y' })

class StorySoFar {
  mainStory: string;

  constructor(initial_story : string) {
    this.mainStory = initial_story
  }
  add_to_story(text: string) {
    this.mainStory += "\n" + text
  }

  get_story() {
    return this.mainStory
  }
  
}


interface Point {
  x: number
  y: number
}

type ContentItem =
  | { inlineData: { mimeType: string; data: string } }
  | { text: string };


class WhatToDoNext {
  contents: ContentItem[]

  constructor() {
    let system_prompt = `
    You are a UI interaction helper bot for the disabled/elderly to fill out a complaint form to NYC's 311 reporting website. You are given a screenshot of what the user is currently seeing and some background on what the user has already done in the past. You will now use your judgment to figure out what the next step of the process will be. Here are your following options:

1. Advise User to Click on a Button. If you choose this option, describe in words where exactly on the screen the user must click.

2. Advise User to Scroll Down

3. Advise User to Start Typing

Revised Tips to Determine the Next Step (in order of priority):

1. Prioritize Functional Icons: When a text field has a special icon (like a magnifying glass for search or a calendar for dates), always advise the user to click the icon first. This is the most important rule.

2. Clicked Text Areas: If a text area is already in focus, then tell the user to start typing. Look for signs including a bolded border around the text area box.
 
3. Handle Dropdowns: If you see an unfilled empty dropdown menu, the user must click it to see the options.

4. Address All Empty Text Areas: If there are any empty text areas, advise the user to click on the next available empty text area to prepare for typing. This includes both required and optional fields to ensure the form is filled out as completely as possible.

5. Check for Scrolling: If a clickable item is near the edge of the screen, it may be best to ask the user to Scroll Down first.

6. Proceed to Next Step: Only after all fields on the current screen have been addressed, advise the user to click on the "Next" or "Submit" button.


Other Tips:
- Completely ignore all call to actions to ask the user to sign in or sign up. That is out of the scope of the project.
- If you haven't seen the back/next/submit buttons usually at the bottom, user has to scroll down.

Response Format: "CLICK" - {Description in words of where exactly to click} , "SCROLL DOWN", "TYPE"
    `
    this.contents = [
      { text: system_prompt },
    ]
  }

  screenshot_and_add_to_content(primaryScreen: DesktopCapturerSource): void {
    const image = primaryScreen.thumbnail.toPNG()
    const image_data = image.toString('base64')
    this.add_image_to_content(image_data)
  }

  add_image_to_content(image_data: string): void {
    this.contents.push({ inlineData: { mimeType: 'image/png', data: image_data } })
  }

  add_user_feedback(feedback: string): void {
    this.contents.push({ text: feedback })
  }

  async what_to_do_next(): Promise<string> {
    try {
      const ai = new GoogleGenAI({
        apiKey: "AIzaSyCKnc_vT7f1mVJs5xE4dIU8jlcqF3sSq9E"
      });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: this.contents,
      });
      if (response.text) {
        return response.text;
      } else {
        return "ERROR: No response from AI"
      }
    } catch (error) {
      return `ERROR: ${error instanceof Error ? error.message : String(error)}`
    }
  }


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
  // save the image to a file
  fs.writeFileSync('screenshot_1.png', image)
  return image
}
function take_screenshot_2(primaryScreen: DesktopCapturerSource) {
  const image = primaryScreen.thumbnail.toPNG()
  // save the image to a file
  fs.writeFileSync('screenshot_2.png', image)
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

function visitWebsite(url: string) {
  if (process.platform === 'win32') {
    exec(`start chrome "${url}"`)
  } else {
    shell.openExternal(url)
  }
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startTutorial(mainWindow: BrowserWindow): Promise<void> {
  mainWindow.webContents.send('update-assistant-text', 'I will now open Google Chrome and navigate to the NYC.gov website for you.')

  let initial_story = "A 75 year old Grandma has determined that noise from her neighbor's apartment has become excessive particularly past 10pm on Wednesdays."

  const storySoFar = new StorySoFar(initial_story)

  const link = "http://portal.311.nyc.gov/sr-step/?id=5e0bd107-3a54-f011-95f3-7c1e52a1da33&stepid=8f39d3a3-cd7f-e811-a83f-000d3a33b3a3"
  visitWebsite(link)

  await wait(2000) // Wait for 2 seconds


  // Figure out what to do next based on story so far and screenshot






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

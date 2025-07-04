import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  mouseEnter: () => ipcRenderer.send('mouse-enter-interactive-area'),
  mouseLeave: () => ipcRenderer.send('mouse-leave-interactive-area'),
  acceptSolution: (url: string) => ipcRenderer.send('accept-solution', url),
  sendMessage: (message: string) => ipcRenderer.send('send-message', message),
  restartChat: () => ipcRenderer.send('restart-chat'),
  onFocusChatInput: (callback: () => void) => {
    ipcRenderer.on('focus-chat-input', callback)
    return () => ipcRenderer.removeListener('focus-chat-input', callback)
  },
  onUpdateAssistantText: (callback: (text: string) => void) => {
    const handler = (_event, text): void => callback(text)
    ipcRenderer.on('update-assistant-text', handler)
    return () => ipcRenderer.removeListener('update-assistant-text', handler)
  },
  onSetAcceptMessage: (callback: (accept: boolean) => void) => {
    const handler = (_event, accept): void => callback(accept)
    ipcRenderer.on('set-accept-message', handler)
    return () => ipcRenderer.removeListener('set-accept-message', handler)
  },
  onSuggestSolutionUrl: (callback: (url: string) => void) => {
    const handler = (_event, url): void => callback(url)
    ipcRenderer.on('suggest-solution-url', handler)
    return () => ipcRenderer.removeListener('suggest-solution-url', handler)
  },
  onShowVisualCue: (callback: (pos: { x: number; y: number }) => void) => {
    const handler = (_event, pos): void => callback(pos)
    ipcRenderer.on('show-visual-cue', handler)
    return () => ipcRenderer.removeListener('show-visual-cue', handler)
  },
  onRemoveVisualCue: (callback: () => void) => {
    ipcRenderer.on('remove-visual-cue', callback)
    return () => ipcRenderer.removeListener('remove-visual-cue', callback)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      mouseEnter: () => void
      mouseLeave: () => void
      onFocusChatInput: (callback: () => void) => () => void
      onUpdateAssistantText: (callback: (text: string) => void) => () => void
      onShowVisualCue: (callback: (pos: { x: number; y: number }) => void) => () => void
    }
  }
}

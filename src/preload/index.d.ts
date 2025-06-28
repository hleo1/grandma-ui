import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      mouseEnter: () => void
      mouseLeave: () => void
      acceptSolution: (url: string) => void
      sendMessage: (message: string) => void
      restartChat: () => void
      onFocusChatInput: (callback: () => void) => () => void
      onUpdateAssistantText: (callback: (text: string) => void) => () => void
      onSetAcceptMessage: (callback: (accept: boolean) => void) => () => void
      onSuggestSolutionUrl: (callback: (url: string) => void) => () => void
      onShowVisualCue: (callback: (pos: { x: number; y: number }) => void) => () => void
      onRemoveVisualCue: (callback: () => void) => () => void
    }
  }
}

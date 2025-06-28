/// <reference types="vite/client" />

declare global {
  interface Window {
    electron: any // This is just an example, you should define it properly
    api: {
      onTutorialStep: (callback: (value: 'next' | 'back') => void) => void
      updateInstruction: (instruction: string) => void
    }
  }
}

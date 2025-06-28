import { useState, useEffect, MouseEvent, useRef } from 'react'

function App(): React.JSX.Element {
  const [visualCue, setVisualCue] = useState<{ x: number; y: number } | null>(null)
  const [assistantText, setAssistantText] = useState("Let's get started!")
  const [boxPosition, setBoxPosition] = useState({ x: window.innerWidth - 420, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const cleanupOnUpdate = window.api.onUpdateAssistantText((text) => {
      setAssistantText(text)
    })
    const cleanupOnShow = window.api.onShowVisualCue((pos) => {
      setVisualCue(pos)
    })
    const cleanupOnFocus = window.api.onFocusChatInput(() => {
      chatInputRef.current?.focus()
    })
    const cleanupOnRemove = window.api.onRemoveVisualCue(() => {
      setVisualCue(null)
    })

    return () => {
      cleanupOnUpdate()
      cleanupOnShow()
      cleanupOnFocus()
      cleanupOnRemove()
    }
  }, [])

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - boxPosition.x,
      y: e.clientY - boxPosition.y
    })
  }

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setBoxPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <>
      {visualCue && (
        <div
          className="visual-cue"
          style={{
            top: `${visualCue.y}px`,
            left: `${visualCue.x}px`,
            transform: 'translate(-50%, -50%)'
          }}
        ></div>
      )}
      <div
        className="dialogue-box-container"
        style={{
          top: `${boxPosition.y}px`,
          left: `${boxPosition.x}px`
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={() => window.api.mouseEnter()}
        onMouseLeave={() => window.api.mouseLeave()}
      >
        <div className="dialogue-box" onMouseDown={handleMouseDown}>
          <p>{assistantText}</p>
        </div>
        <div className="chat-input-container">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="microphone-icon"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
          <textarea
            ref={chatInputRef}
            className="chat-input"
            placeholder="Ask a question..."
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </>
  )
}

export default App

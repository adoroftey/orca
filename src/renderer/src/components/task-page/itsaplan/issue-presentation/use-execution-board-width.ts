import { useCallback, useEffect, useState } from 'react'

export function useExecutionBoardWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const ref = useCallback((node: HTMLDivElement | null) => setElement(node), [])
  useEffect(() => {
    if (!element) {
      return
    }
    setWidth(element.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setWidth(entries[0].contentRect.width)
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return { ref, width }
}

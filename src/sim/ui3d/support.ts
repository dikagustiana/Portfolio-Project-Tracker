// When the 3D view may run (Brief 3 §1): WebGL present and the viewer has not asked for reduced
// motion. Otherwise SimHost keeps the 2D canvas world. No three.js import here, so deciding
// costs nothing and the 3D chunk stays lazy.

import { useEffect, useState } from 'react'

let webgl: boolean | undefined

export function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl
  try {
    const c = document.createElement('canvas')
    webgl = !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    webgl = false
  }
  return webgl
}

/** Reactive `prefers-reduced-motion` (an OS change while the screen is open is honoured). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

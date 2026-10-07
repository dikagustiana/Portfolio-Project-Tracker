// If the 3D view fails at runtime (WebGL context refused or lost, a driver bug), the screen
// falls back to the 2D world instead of going blank (Brief 3 §1: 2D stays the fallback).

import { Component } from 'react'
import type { ReactNode } from 'react'

export class Boundary3D extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    console.warn('Tampilan 3D gagal dimuat; beralih ke 2D.', error)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

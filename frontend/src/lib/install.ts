import { useEffect, useState } from 'react'

/** The browser's "add to home screen" prompt (Chrome / Edge / Android). Not in TS's DOM types yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let saved: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    saved = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    saved = null
    listeners.forEach((l) => l())
  })
}

/**
 * "Install app" button support. canInstall is true only when the browser offers it
 * (not on iPhone Safari, where it's Share → Add to Home Screen, and not once installed).
 */
export function useInstallPrompt() {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  async function install() {
    if (!saved) return
    await saved.prompt()
    await saved.userChoice
    saved = null
    force((n) => n + 1)
  }
  return { canInstall: saved !== null, install }
}

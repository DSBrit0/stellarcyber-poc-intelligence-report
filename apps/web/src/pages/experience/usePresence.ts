import { useEffect } from 'react'

/**
 * Tells the session whether this participant is looking at it: away while the page is hidden (another
 * tab, minimised), the window is out of focus (another application or screen) or the pointer is off the
 * page; back as soon as all three return. Leaving the page reports away at once; after 30 s without a
 * poll the participant also shows as out. Only changes are sent, a quarter second after they settle.
 */
export function usePresence(url: string | null) {
  useEffect(() => {
    if (!url) return
    let pointerOut = false
    let sent: boolean | null = null
    let timer = 0
    const away = () => document.visibilityState === 'hidden' || !document.hasFocus() || pointerOut
    const send = (value: boolean, keepalive = false) => {
      if (value === sent) return
      sent = value
      void fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ away: value }),
        keepalive,
      }).catch(() => (sent = null))
    }
    const update = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => send(away()), 250)
    }
    const out = (e: MouseEvent) => {
      // Leaving the page, not moving between two of its elements.
      if (!e.relatedTarget) {
        pointerOut = true
        update()
      }
    }
    const back = () => {
      if (pointerOut) {
        pointerOut = false
        update()
      }
    }
    const leave = () => send(true, true)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    document.documentElement.addEventListener('mouseleave', out)
    document.addEventListener('mouseout', out)
    document.addEventListener('pointermove', back)
    window.addEventListener('pagehide', leave)
    update()
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      document.documentElement.removeEventListener('mouseleave', out)
      document.removeEventListener('mouseout', out)
      document.removeEventListener('pointermove', back)
      window.removeEventListener('pagehide', leave)
    }
  }, [url])
}

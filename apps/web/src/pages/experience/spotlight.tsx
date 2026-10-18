import { createContext, createElement, useContext, useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

/**
 * The Spotlight: the item the Presenter points at (an Interflow field, a trace step, a Briefing topic,
 * an Answer, a Customer Question) is framed on every participant's screen and scrolled into view.
 * Items are named by a spot id such as `if:field:src_ip`; leaving the Stage, phase or scene clears it.
 */
interface Spotlight {
  spot: string | null
  /** The Presenter while live; the viewer alone in a replay. */
  canPoint: boolean
  point: (id: string | null) => void
}

const SpotlightContext = createContext<Spotlight>({ spot: null, canPoint: false, point: () => {} })
export const SpotlightProvider = SpotlightContext.Provider
export const useSpotlight = () => useContext(SpotlightContext)

/** The frame: Solar Orange, the brand's colour for what needs attention. */
const ON = 'rounded-md bg-sc-solar/[0.08] outline-2 outline-offset-2 outline-sc-solar shadow-[0_0_24px_rgba(255,155,29,0.35)] transition-[outline-color,box-shadow,background-color] duration-300'
const CAN = 'cursor-pointer rounded-md hover:outline-1 hover:outline-offset-2 hover:outline-white/25'

// Clicks on the item's own controls (pick an Answer, reply to a question) do not point at it.
const fromControl = (e: MouseEvent | KeyboardEvent) => (e.target as HTMLElement).closest('button, a, input, textarea, select, label') != null && e.target !== e.currentTarget

/** One item that can be in the Spotlight. `pointable` false: framed, but pointed at by other means. */
export function Spot({ id, as = 'div', className = '', pointable = true, children }: { id: string; as?: 'div' | 'li' | 'span'; className?: string; pointable?: boolean; children: ReactNode }) {
  const { spot, canPoint, point } = useSpotlight()
  const on = spot === id
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [on])
  const clickable = pointable && canPoint
  const toggle = (e: MouseEvent | KeyboardEvent) => {
    if (fromControl(e)) return
    point(on ? null : id)
  }
  return createElement(
    as,
    {
      ref,
      'data-spot': id,
      'data-spotlit': on || undefined,
      className: `${className} ${on ? ON : clickable ? CAN : ''}`,
      ...(clickable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': on,
            onClick: toggle,
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              toggle(e)
            },
          }
        : {}),
    },
    children,
  )
}

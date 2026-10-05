import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Option {
  value: string
  label: ReactNode
  /** Plain text of the label, for type-ahead and the hidden width reserve. */
  text: string
  disabled: boolean
}

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean }

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

/** Reads the <option> children (also inside arrays and fragments) as plain data. */
function readOptions(children: ReactNode): Option[] {
  const out: Option[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const el = child as ReactElement<OptionProps & { children?: ReactNode }>
    if (el.type === 'option') {
      const { value, children: label, disabled } = el.props
      out.push({ value: String(value ?? textOf(label)), label, text: textOf(label), disabled: !!disabled })
    } else {
      out.push(...readOptions(el.props.children))
    }
  })
  return out
}

export interface SelectProps {
  value: string | number
  onChange: (e: { target: { value: string } }) => void
  children: ReactNode
  className?: string
  disabled?: boolean
  required?: boolean
  title?: string
  'aria-label'?: string
}

/**
 * A drop-in for the native <select>: same props and the same <option> children, but the list opens
 * as a styled panel that looks the same on every OS and in dark mode. The trigger keeps the width of
 * the widest option, like a native select, so the layout does not move when the choice changes.
 */
export function Select({ value, onChange, children, className = 'input', disabled, required, title, 'aria-label': ariaLabel }: SelectProps) {
  const options = readOptions(children)
  const current = String(value)
  const selected = options.find((o) => o.value === current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()
  // Layout classes (width, margin, flex sizing) belong to the wrapper; the trigger fills it.
  const classes = className.split(/\s+/).filter(Boolean)
  const isOuter = (c: string) => /^(-?m[trblxy]?-|w-|max-w-|min-w-|shrink-|grow|flex-1|basis-)/.test(c)
  const outer = classes.filter(isOuter)
  const inner = classes.filter((c) => !isOuter(c)).join(' ')
  // An .input is full width unless told otherwise, like the native select it replaces.
  const block = classes.includes('input') && !outer.some((c) => c.startsWith('w-'))

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const up = below < 240 && r.top > below
    const maxHeight = Math.min(320, (up ? r.top : below) - 12)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 160) - 8))
    setPos({ position: 'fixed', left, minWidth: r.width, maxWidth: window.innerWidth - 16, maxHeight, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) })
  }, [])

  const show = () => {
    if (disabled) return
    place()
    setActive(Math.max(0, options.findIndex((o) => o.value === current)))
    setOpen(true)
  }

  const pick = (o: Option | undefined) => {
    if (!o || o.disabled) return
    setOpen(false)
    triggerRef.current?.focus()
    if (o.value !== current) onChange({ target: { value: o.value } })
  }

  useLayoutEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false)
    }
    // Scrolling the page moves the trigger: follow it, unless the scroll is inside the list itself.
    const onScroll = (e: Event) => (listRef.current?.contains(e.target as Node) ? undefined : place())
    document.addEventListener('mousedown', onDown)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, place])

  const move = (from: number, step: number) => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i]!.disabled) return setActive(i)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(active, 1),
      ArrowUp: () => move(active, -1),
      Home: () => move(-1, 1),
      End: () => move(options.length, -1),
      Enter: () => pick(options[active]),
      ' ': () => pick(options[active]),
      Escape: () => setOpen(false),
    }
    if (keys[e.key]) {
      e.preventDefault()
      return keys[e.key]!()
    }
    if (e.key === 'Tab') return setOpen(false)
    if (e.key.length === 1) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const hit = options.findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(typed.current.text))
      if (hit >= 0) setActive(hit)
    }
  }

  return (
    <span className={`relative max-w-full min-w-0 align-middle ${block ? 'grid w-full' : 'inline-grid'} ${outer.join(' ')}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        className={`${inner} select-trigger`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {/* Every label stacked in one cell: the trigger is as wide as the widest of them. */}
        <span className="grid min-w-0 flex-1 text-left">
          {options.map((o) => (
            <span key={o.value} aria-hidden={o.value !== current} className={`col-start-1 row-start-1 truncate ${o === selected ? '' : 'invisible h-0'}`}>
              {o.label}
            </span>
          ))}
          {selected ? null : <span className="col-start-1 row-start-1">&nbsp;</span>}
        </span>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className={`shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Keeps native form validation for required selects (the PoC's Company). */}
      {required ? <input tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0" required value={current} onChange={() => {}} /> : null}
      {open
        ? createPortal(
            <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label={ariaLabel} style={pos} className="select-panel">
              {options.map((o, i) => (
                <li
                  key={o.value}
                  id={`${id}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={o.value === current}
                  aria-disabled={o.disabled || undefined}
                  className={`select-option ${i === active ? 'is-active' : ''} ${o.disabled ? 'opacity-40' : ''}`}
                  onMouseEnter={() => !o.disabled && setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                >
                  <span className="min-w-0 flex-1">{o.label}</span>
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className={`shrink-0 text-brand ${o.value === current ? '' : 'invisible'}`}>
                    <path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </li>
              ))}
            </ul>,
            // Inside a modal <dialog> (top layer), the list must live in the dialog to be visible and clickable.
            triggerRef.current?.closest('dialog') ?? document.body,
          )
        : null}
    </span>
  )
}

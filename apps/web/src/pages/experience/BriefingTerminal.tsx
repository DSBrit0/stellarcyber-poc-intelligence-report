import { BRIEFING_SECTIONS, stageById, type BriefingSection, type StageId } from '@poc-intel/shared'
import { useEffect, useState, type ReactNode } from 'react'
import type { MessageKey } from '@poc-intel/shared/i18n'
import { useI18n } from '../../lib/i18n'
import { BRIEFING_DOCS, BRIEFING_REFS } from './content/briefing-refs'
import { useWords } from './content'
import { CollapseButton } from './CollapseButton'
import { Spot } from './spotlight'

/** The command each topic answers to: shell idiom, so it reads the same in every language. */
const COMMANDS: Record<BriefingSection, string> = {
  how: 'explain --how',
  value: 'explain --soc-value',
  objectives: 'explain --objectives',
  frameworks: 'map --frameworks',
  techniques: 'map --mitre-attack',
}

const TITLES: Record<BriefingSection, MessageKey> = {
  how: 'exp.briefing.how',
  value: 'exp.briefing.value',
  objectives: 'exp.briefing.objectives',
  frameworks: 'exp.briefing.frameworks',
  techniques: 'exp.briefing.techniques',
}

/**
 * A Stage's Briefing as a terminal session. Every topic starts summarized on one line; the
 * Presenter opens it while explaining, and every participant's view follows (`open` comes from the
 * live state). It ends with the official documentation of the Stage.
 */
export function BriefingTerminal({
  stage,
  open,
  canToggle,
  onToggle,
  docsVersion,
  reducedMotion,
  onCollapse,
}: {
  stage: StageId
  open: readonly BriefingSection[]
  canToggle: boolean
  onToggle: (section: BriefingSection) => void
  docsVersion: string | null
  reducedMotion: boolean
  /** Only for whoever leads the view (the Presenter, or the viewer of a replay). */
  onCollapse?: () => void
}) {
  const { t } = useI18n()
  const words = useWords()
  const brief = words.briefings[stage]
  const refs = BRIEFING_REFS[stage]
  const slug = stage.replace(/_/g, '-')
  const docs = BRIEFING_DOCS[stage]

  const body: Record<BriefingSection, { summary: string; lines: ReactNode[] }> = {
    how: { summary: brief.how[0] ?? '', lines: brief.how.map((l) => <Bullet key={l}>{l}</Bullet>) },
    value: { summary: brief.value[0] ?? '', lines: brief.value.map((l) => <Bullet key={l}>{l}</Bullet>) },
    objectives: {
      summary: brief.objectives.join(', '),
      lines: [
        <p key="o" className="flex flex-wrap gap-2 pl-4">
          {brief.objectives.map((o) => (
            <span key={o} className="rounded border border-sc-sky-light/40 px-2 py-0.5 text-sc-sky-light">
              {o}
            </span>
          ))}
        </p>,
      ],
    },
    frameworks: {
      summary: refs.frameworks.map((f) => f.ref).join(', '),
      lines: refs.frameworks.map((f) => (
        <p key={`${f.framework}-${f.ref}`} className="grid grid-cols-[minmax(0,9.5rem)_5.5rem_1fr] gap-x-3 pl-4">
          <span className="truncate text-sc-silver/55">{f.framework}</span>
          <span className="text-sc-solar">{f.ref}</span>
          <span className="text-sc-silver/85">{f.name}</span>
        </p>
      )),
    },
    techniques: {
      summary: refs.techniques.map((tq) => tq.id).join(', '),
      lines: [
        <p key="lead" className="pl-4 text-sc-silver/70">
          {brief.techniquesLead}
        </p>,
        ...refs.techniques.map((tq) => (
          <p key={tq.id} className="grid grid-cols-[5.5rem_1fr] gap-x-3 pl-4">
            <a className="text-sc-burnt underline-offset-2 hover:underline" href={`https://attack.mitre.org/techniques/${tq.id.replace('.', '/')}/`} target="_blank" rel="noreferrer">
              {tq.id}
            </a>
            <span className="text-sc-silver/85">{tq.name}</span>
          </p>
        )),
      ],
    },
  }

  return (
    <section className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#060f17]/90 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="size-2 rounded-full bg-sc-sky-light shadow-[0_0_8px_#41C5F9]" aria-hidden />
        <p className="min-w-0 flex-1 truncate font-mono text-xs text-sc-silver/60">
          stellar@open-xdr:~/{stageById(stage).chapter.replace(/_/g, '-')}/{slug}
        </p>
        {onCollapse ? <CollapseButton onClick={onCollapse} /> : null}
      </header>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 font-mono text-[13px] leading-relaxed sm:px-4">
        {BRIEFING_SECTIONS.map((s) => {
          const isOpen = open.includes(s)
          return (
            <Spot key={s} id={`brief:${s}`} pointable={false} className={`rounded-lg ${isOpen ? 'bg-white/[0.03] pb-2' : ''}`}>
              <button
                type="button"
                disabled={!canToggle}
                aria-expanded={isOpen}
                onClick={() => onToggle(s)}
                className={`group flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left ${canToggle ? 'cursor-pointer hover:bg-white/[0.05]' : 'cursor-default'}`}
              >
                <span className="flex w-full flex-wrap items-baseline gap-x-3">
                  <span className="text-sc-sky-light">
                    <span className="text-sc-silver/40">$ </span>
                    stellar {COMMANDS[s].split(' ')[0]} {slug} {COMMANDS[s].split(' ')[1]}
                  </span>
                  <span className="font-roboto text-sm font-semibold text-sc-silver"># {t(TITLES[s])}</span>
                  {canToggle ? <span className="ml-auto font-roboto text-xs text-sc-silver/50 group-hover:text-sc-sky-light">{isOpen ? '−' : '+'}</span> : null}
                </span>
                {isOpen ? null : <span className="line-clamp-1 w-full pl-4 text-sc-silver/50">{body[s].summary}</span>}
              </button>
              {isOpen ? <Reveal lines={body[s].lines} reducedMotion={reducedMotion} /> : null}
            </Spot>
          )
        })}
        <div className="px-2 pt-2">
          <p>
            <span className="text-sc-silver/40">$ </span>
            <span className="text-sc-sky-light">stellar docs {slug}</span>
            <span className="ml-3 font-roboto text-sm font-semibold text-sc-silver"># {t('exp.briefing.docs')}</span>
          </p>
          {docs.map((d) => (
            <a
              key={d.path}
              className="mt-1 block pl-4 font-roboto text-sm text-sc-silver underline decoration-sc-sky-light/60 underline-offset-4 hover:decoration-sc-sky-light"
              href={`https://docs.stellarcyber.ai/prod-docs/${docsVersion ?? '7.0.xs'}/${d.path}`}
              target="_blank"
              rel="noreferrer"
            >
              {d.title} ↗
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

/** A topic's lines, printed one by one as it opens (all at once with reduced motion). */
function Reveal({ lines, reducedMotion }: { lines: ReactNode[]; reducedMotion: boolean }) {
  const [shown, setShown] = useState(reducedMotion ? lines.length : 0)
  useEffect(() => {
    if (shown >= lines.length) return
    const id = window.setTimeout(() => setShown((n) => n + 1), 90)
    return () => window.clearTimeout(id)
  }, [shown, lines.length])
  return <div className="space-y-1.5 px-2">{lines.slice(0, shown)}</div>
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <p className="grid grid-cols-[1rem_1fr] pl-4 text-sc-silver/85">
      <span className="text-sc-sky-light">›</span>
      <span>{children}</span>
    </p>
  )
}

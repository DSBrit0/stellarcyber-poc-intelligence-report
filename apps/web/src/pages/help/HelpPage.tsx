import type { Locale, Role } from '@poc-intel/shared'
import { translate } from '@poc-intel/shared/i18n'
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMe } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { guideEn } from './guide.en'
import { guideEs } from './guide.es'
import { guidePtBR } from './guide.pt-BR'
import type { HelpBlock, HelpGuide, HelpSection, Ui } from './types'

const GUIDES: Record<Locale, (ui: Ui) => HelpGuide> = { 'pt-BR': guidePtBR, en: guideEn, es: guideEs }

/** Lower case without accents, so "seção" matches "secao". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const blockText = (b: HelpBlock): string =>
  b.kind === 'steps' || b.kind === 'list' ? b.items.join(' ') : b.kind === 'table' ? [...b.head, ...b.rows.flat()].join(' ') : b.text

const forRole = (s: HelpSection, role: Role) => s.roles === 'all' || s.roles.includes(role)

/** **label** is a screen label, `text` is something to type; everything else is plain text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <span key={i} className="rounded bg-slate-100 px-1.5 py-px font-medium whitespace-nowrap text-slate-800 dark:bg-slate-800 dark:text-slate-100">
            {p.slice(2, -2)}
          </span>
        ) : p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded border border-slate-200 bg-white px-1 py-px font-mono text-[0.85em] dark:border-slate-700 dark:bg-slate-900">
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

function Block({ block }: { block: HelpBlock }): ReactNode {
  switch (block.kind) {
    case 'p':
      return (
        <p>
          <Inline text={block.text} />
        </p>
      )
    case 'h3':
      return <h3 className="pt-2 font-semibold text-slate-900 dark:text-slate-100">{block.text.replace(/\*\*/g, '')}</h3>
    case 'steps':
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand dark:bg-brand/25 dark:text-blue-200">
                {i + 1}
              </span>
              <span>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ol>
      )
    case 'list':
      return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-400">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )
    case 'tip':
    case 'warn':
      return (
        <p
          className={
            block.kind === 'tip'
              ? 'rounded-lg border-l-4 border-brand bg-brand/5 px-4 py-3 dark:bg-brand/15'
              : 'rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
          }
        >
          <Inline text={block.text} />
        </p>
      )
    case 'table':
      return (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-left text-sm [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:px-3 [&_th]:py-2">
            <thead>
              <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase dark:border-slate-700">
                {block.head.map((h) => (
                  <th key={h} className="font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  {row.map((cell, j) => (
                    <td key={j} className={j === 0 ? 'min-w-[9rem]' : 'min-w-[12rem]'}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export function HelpPage() {
  const { t, locale } = useI18n()
  const { data: me } = useMe()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')

  const guide = useMemo(() => GUIDES[locale]((key, vars) => `**${translate(locale, key, vars)}**`), [locale])
  const role = me?.role ?? 'customer'
  const mine = guide.sections.filter((s) => forRole(s, role))
  // Admins' topics are the whole guide: the toggle would change nothing.
  const showToggle = mine.length < guide.sections.length

  const q = fold(query.trim())
  const sections = (scope === 'mine' ? mine : guide.sections).filter(
    (s) => !q || fold([s.title, s.summary, ...s.blocks.map(blockText)].join(' ')).includes(q),
  )

  // Deep links (/help#sync) land on their topic, showing every topic when it is not one of the reader's.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    if (!mine.some((s) => s.id === id) && guide.sections.some((s) => s.id === id)) setScope('all')
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
    // Only on arrival.
  }, [])

  const roleNames = (s: HelpSection) => (s.roles === 'all' ? t('guide.everyone') : s.roles.map((r) => t(`role.${r}`)).join(' · '))

  const toc = (
    <ol className="space-y-0.5 text-sm">
      {sections.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="block rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t('guide.title')}</h1>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('guide.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="search" className="input max-w-md" placeholder={t('guide.search')} aria-label={t('guide.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        {showToggle ? (
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 text-sm dark:border-slate-700" role="group">
            {(['mine', 'all'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={scope === v}
                onClick={() => setScope(v)}
                className={`cursor-pointer rounded-md px-3 py-1 ${scope === v ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                {t(v === 'mine' ? 'guide.myTopics' : 'guide.allTopics')}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <details className="card py-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold">{t('guide.contents')}</summary>
        <div className="mt-2">{toc}</div>
      </details>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={t('guide.contents')} className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="mb-2 px-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{t('guide.contents')}</div>
            {toc}
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {sections.length === 0 ? <p className="text-slate-500">{t('guide.noResults')}</p> : null}
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <div className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    <a href={`#${s.id}`} className="hover:underline">
                      {s.title}
                    </a>
                  </h2>
                  <span className="text-xs text-slate-400">{t('guide.for', { roles: roleNames(s) })}</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">{s.summary}</p>
              </div>
              {s.blocks.map((b, i) => (
                <Block key={i} block={b} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

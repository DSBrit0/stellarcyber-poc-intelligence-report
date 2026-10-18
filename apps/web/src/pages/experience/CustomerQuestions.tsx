import type { StageId } from '@poc-intel/shared'
import { useState } from 'react'
import { api } from '../../lib/api'
import { errorKey } from '../../lib/errors'
import { useI18n } from '../../lib/i18n'
import { useWords } from './content'
import { Spot, useMirroredScroll } from './spotlight'

export interface QuestionRow {
  id: string
  stageId: StageId
  userName: string | null
  text: string
  reply: string | null
  answeredLive: boolean
  mine: boolean
}

/**
 * Customer Questions about the Stage on screen: anyone asks while the session is live; the Sales
 * Engineer replies in writing or marks it answered live, then or later.
 */
export function CustomerQuestions({ base, stage, questions, canAsk, canReply, onChanged }: { base: string; stage: StageId; questions: QuestionRow[]; canAsk: boolean; canReply: boolean; onChanged: () => unknown }) {
  const { t } = useI18n()
  const words = useWords()
  const [text, setText] = useState('')
  const mirrored = useMirroredScroll<HTMLUListElement>('questions')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ask = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(`${base}/stages/${stage}/questions`, { method: 'POST', body: { text: text.trim() } })
      setText('')
      await onChanged()
    } catch (err) {
      setError(t(errorKey(err)))
    } finally {
      setBusy(false)
    }
  }
  if (!canAsk && questions.length === 0) return null
  return (
    <section className="pointer-events-auto flex max-h-[45%] shrink-0 flex-col gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-4 backdrop-blur-xl">
      <h3 className="text-sm font-semibold">{t('exp.cq.title')}</h3>
      {questions.length === 0 ? <p className="text-sm text-sc-silver/50">{t('exp.cq.empty')}</p> : null}
      <ul {...mirrored} className="min-h-0 space-y-2 overflow-y-auto">
        {questions.map((q) => (
          <QuestionItem key={q.id} base={base} q={q} canReply={canReply} onChanged={onChanged} />
        ))}
      </ul>
      {canAsk ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) void ask()
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-sc-silver outline-none placeholder:text-sc-silver/40 focus:border-sc-sky-light focus:ring-2 focus:ring-sc-sky-light/30"
            value={text}
            maxLength={1000}
            placeholder={t('exp.cq.placeholder', { stage: words.stages[stage].title })}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="rounded-lg bg-sc-sky px-4 py-2 text-sm font-semibold hover:bg-sc-sky-mid disabled:opacity-40" disabled={busy || !text.trim()}>
            {t('exp.cq.ask')}
          </button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-sc-burnt">{error}</p> : null}
    </section>
  )
}

function QuestionItem({ base, q, canReply, onChanged }: { base: string; q: QuestionRow; canReply: boolean; onChanged: () => unknown }) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(q.reply ?? '')
  const pending = !q.reply && !q.answeredLive
  const patch = async (body: { reply?: string | null; answeredLive?: boolean }) => {
    await api(`${base}/questions/${q.id}`, { method: 'PATCH', body })
    setEditing(false)
    await onChanged()
  }
  return (
    <Spot as="li" id={`cq:${q.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
      <p className="mb-0.5 flex flex-wrap items-center gap-2 text-xs text-sc-silver/55">
        {q.mine ? t('exp.you') : (q.userName ?? '—')}
        {pending ? <span className="rounded bg-sc-solar/15 px-1.5 text-sc-solar">{t('exp.cq.pending')}</span> : null}
        {q.answeredLive && !q.reply ? <span className="rounded bg-sc-sky-light/15 px-1.5 text-sc-sky-light">{t('exp.cq.answeredLive')}</span> : null}
      </p>
      <p className="whitespace-pre-wrap">{q.text}</p>
      {q.reply && !editing ? (
        <p className="mt-2 border-l-2 border-sc-sky-light/60 pl-3 whitespace-pre-wrap text-sc-silver/85">
          <span className="mr-1 text-xs text-sc-silver/55">{t('exp.cq.replyLabel')}:</span>
          {q.reply}
        </p>
      ) : null}
      {canReply && editing ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void patch({ reply: draft.trim() || null })
          }}
        >
          <textarea
            className="min-h-20 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-sc-silver outline-none placeholder:text-sc-silver/40 focus:border-sc-sky-light"
            value={draft}
            maxLength={2000}
            placeholder={t('exp.cq.replyPlaceholder')}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="rounded-lg bg-sc-sky px-3 py-1.5 text-xs font-semibold hover:bg-sc-sky-mid">{t('exp.cq.saveReply')}</button>
        </form>
      ) : null}
      {canReply && !editing ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="rounded px-2 py-0.5 text-xs text-sc-sky-light hover:bg-white/10" onClick={() => setEditing(true)}>
            {t('exp.cq.reply')}
          </button>
          {!q.answeredLive ? (
            <button type="button" className="rounded px-2 py-0.5 text-xs text-sc-silver/70 hover:bg-white/10" onClick={() => void patch({ answeredLive: true })}>
              {t('exp.cq.markLive')}
            </button>
          ) : null}
        </div>
      ) : null}
    </Spot>
  )
}

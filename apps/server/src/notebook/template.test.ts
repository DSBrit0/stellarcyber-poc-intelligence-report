import { describe, expect, it } from 'vitest'
import type { NotebookTemplateItem } from '../db/schema.js'
import { reorder, sectionEnd, templateForNewNotebook } from './template.js'

let n = 0
const row = (section: 'process' | 'schedule', kind: NotebookTemplateItem['kind'], key: string | null = null, hidden = false) =>
  ({ id: `r${++n}`, section, kind, position: n, indent: 0, text: { 'pt-BR': `t${n}`, en: '', es: '' }, hidden, days: 2, tone: 'poc', key, updatedAt: new Date() }) as NotebookTemplateItem

describe('Notebook Template copy', () => {
  it('drops the whole section of a hidden phase, and its milestone', () => {
    n = 0
    const rows = [
      row('process', 'phase', 'planning'),
      row('process', 'item'),
      row('process', 'phase', 'pov_workshop', true),
      row('process', 'item'),
      row('process', 'note'),
      row('process', 'phase', 'kickoff'),
      row('process', 'item', null, true),
      row('process', 'item'),
      row('schedule', 'milestone', 'start'),
      row('schedule', 'milestone', 'planning'),
      row('schedule', 'milestone', 'pov_workshop'),
      row('schedule', 'milestone', 'kickoff'),
      row('schedule', 'milestone', null),
    ]
    const { process, schedule } = templateForNewNotebook(rows)
    expect(process.map((r) => r.id)).toEqual(['r1', 'r2', 'r6', 'r8'])
    expect(schedule.map((r) => r.key)).toEqual(['start', 'planning', 'kickoff', null])
  })
  it('adds a new phase after the whole section, not inside it', () => {
    const rows = [
      { id: 'p1', kind: 'phase' },
      { id: 'i1', kind: 'item' },
      { id: 'i2', kind: 'item' },
      { id: 'p2', kind: 'phase' },
      { id: 'i3', kind: 'item' },
    ] as const
    expect(sectionEnd([...rows], 'p1')).toBe('i2')
    expect(sectionEnd([...rows], 'i1')).toBe('i2')
    expect(sectionEnd([...rows], 'p2')).toBe('i3')
  })
  it('moves a phase with its whole section, and other rows one by one', () => {
    const rows = [
      { id: 'p1', kind: 'phase' },
      { id: 'i1', kind: 'item' },
      { id: 'p2', kind: 'phase' },
      { id: 'i2', kind: 'item' },
      { id: 'i3', kind: 'item' },
    ] as { id: string; kind: 'phase' | 'item' }[]
    expect(reorder(rows, 'p2', 'up')!.map((r) => r.id)).toEqual(['p2', 'i2', 'i3', 'p1', 'i1'])
    expect(reorder(rows, 'p1', 'down')!.map((r) => r.id)).toEqual(['p2', 'i2', 'i3', 'p1', 'i1'])
    expect(reorder(rows, 'p1', 'up')).toBeNull()
    expect(reorder(rows, 'i3', 'up')!.map((r) => r.id)).toEqual(['p1', 'i1', 'p2', 'i3', 'i2'])
  })
})

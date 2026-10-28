import type { Locale } from '@poc-intel/shared'
import type { FrameworkRef, Technique } from './briefing-refs'
import { refNamesEs } from './ref-names.es'
import { refNamesPtBR } from './ref-names.pt-BR'

/**
 * The Briefing references' names in pt-BR and es, keyed by "<framework> <ref>" and by ATT&CK ID.
 * English is briefing-refs.ts itself; a name missing here falls back to it. The IDs stay as they are,
 * so an analyst can still look a control or technique up in the framework's own (English) text.
 */
export interface RefNames {
  frameworks: Record<string, string>
  techniques: Record<string, string>
}

const NAMES: Partial<Record<Locale, RefNames>> = { 'pt-BR': refNamesPtBR, es: refNamesEs }

export const frameworkName = (locale: Locale, f: FrameworkRef) => NAMES[locale]?.frameworks[`${f.framework} ${f.ref}`] ?? f.name
export const techniqueName = (locale: Locale, tq: Technique) => NAMES[locale]?.techniques[tq.id] ?? tq.name

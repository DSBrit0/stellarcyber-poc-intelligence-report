import type { Locale } from '@poc-intel/shared'
import { useI18n } from '../../../lib/i18n'
import { wordsEn } from './en'
import { wordsEs } from './es'
import { wordsPtBR } from './pt-BR'
import type { ExperienceWords } from './types'

const WORDS: Record<Locale, ExperienceWords> = { en: wordsEn, es: wordsEs, 'pt-BR': wordsPtBR }

export function useWords(): ExperienceWords {
  return WORDS[useI18n().locale]
}

/** The label of a choice option, whatever the Stage. */
export function optionLabel(words: ExperienceWords, stageId: string, option: string): string {
  const stage = words.stages[stageId as keyof ExperienceWords['stages']] as { options?: Record<string, string> }
  return stage.options?.[option] ?? option
}

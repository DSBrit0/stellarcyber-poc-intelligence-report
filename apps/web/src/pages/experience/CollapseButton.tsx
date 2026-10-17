import { useI18n } from '../../lib/i18n'

/** Folds the description and the questions away; the tab on the right edge brings them back. */
export function CollapseButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded
      aria-controls="experience-panel"
      className={`rounded-md border border-white/15 px-2 py-0.5 font-roboto text-xs text-sc-silver/70 hover:border-white/40 hover:text-sc-silver ${className}`}
    >
      {t('exp.panel.collapse')} →
    </button>
  )
}

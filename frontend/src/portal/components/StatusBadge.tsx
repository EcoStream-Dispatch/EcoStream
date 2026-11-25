import type { TyreStatus } from '../types'
import { STATUS_STYLE } from '../lib/status'
import { useLanguage } from '../i18n/LanguageProvider'

/** Coloured pill with icon + word, e.g. [⚠ Warning]. Works for trucks and tyres. */
export default function StatusBadge({ status, className = '' }: { status: TyreStatus; className?: string }) {
  const { icon: Icon, badge } = STATUS_STYLE[status]
  const { t } = useLanguage()
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${badge} ${className}`}
    >
      <Icon size={14} aria-hidden />
      {t(`status.${status}`)}
    </span>
  )
}

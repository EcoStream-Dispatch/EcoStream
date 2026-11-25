import type { AlertType } from '../types'
import { useLang, type Key } from './i18n'
import { WHAT_TO_DO } from './alerts'

/**
 * Translated alert words for the owner screens:
 *   const at = useAlertText()
 *   at.title('slow_leak')   -> "Slow leak" / "மெதுவான காற்றுக் கசிவு" / ...
 *   at.unsafe(3.2)          -> "Unsafe in ~3 h"
 *   at.steps('slow_leak')   -> the "what to do now" steps
 */
export function useAlertText() {
  const { t } = useLang()
  return {
    title: (type: AlertType) => t(`alert.${type}`),
    unsafe: (hours: number | null) =>
      hours === null ? null : hours < 1 ? t('unsafe.now') : t('unsafe.in', { h: Math.round(hours) }),
    steps: (type: AlertType) => WHAT_TO_DO[type].map((step, i) => t(`todo.${type}.${i}` as Key) || step),
  }
}

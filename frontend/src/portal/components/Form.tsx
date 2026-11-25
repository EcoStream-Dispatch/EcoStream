import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Info } from 'lucide-react'

/*
 * Small form building blocks so every form on the site looks the same.
 * Inputs use text-base (16 px) so phones don't zoom in when you tap them.
 */

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-300'

function Label({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">
        {label}
        {required ? <span className="text-critical"> *</span> : <span className="font-normal text-navy-700"> (optional)</span>}
      </span>
      {children}
    </label>
  )
}

export function TextField({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label} required={props.required}>
      <input {...props} className={inputClass} />
    </Label>
  )
}

export function TextArea({ label, ...props }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Label label={label} required={props.required}>
      <textarea rows={4} {...props} className={inputClass} />
    </Label>
  )
}

export function SelectField({
  label,
  options,
  ...props
}: { label: string; options: { value: string; label: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Label label={label} required={props.required}>
      <select {...props} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  )
}

/** "Demo" note under a form that isn't connected to a backend yet. */
export function DemoFormNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-warning/40">
      <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
      Demo: this form isn't connected yet, so nothing is sent or saved.
    </p>
  )
}

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-6 py-3 font-semibold text-white transition hover:bg-green-500 disabled:opacity-50'
export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-navy-900/15 bg-white px-6 py-3 font-semibold text-navy-900 transition hover:border-green-300 hover:bg-green-50'

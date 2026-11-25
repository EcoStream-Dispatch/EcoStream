/**
 * The "ECOSTREAM" brand name, styled like the logo:
 * "ECO" in green, "STREAM" in navy, Montserrat bold, uppercase.
 */
type Props = { className?: string }

export default function Wordmark({ className = '' }: Props) {
  return (
    <span className={`font-heading font-extrabold uppercase tracking-wide ${className}`}>
      <span className="text-green-700">Eco</span>
      <span className="text-navy-900">stream</span>
    </span>
  )
}

/** Shared "Loading..." and error boxes, so every page looks the same while waiting. */
export function Loading({ what = 'data' }: { what?: string }) {
  return <p className="py-10 text-center text-navy-700">Loading {what}…</p>
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-red-50 p-4 text-critical ring-1 ring-critical/20">
      <p className="font-semibold">Could not load: {message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  )
}

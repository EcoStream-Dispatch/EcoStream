import { Link } from 'react-router-dom'
import { Building2, ChevronRight, LogOut, Phone, Receipt, Tag, UserRound, type LucideIcon } from 'lucide-react'
import { getOwner, getTrucks } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../auth/AuthProvider'
import LanguageSwitch from '../components/LanguageSwitch'
import PlanBadge from '../components/PlanBadge'
import { ErrorBox, Loading } from '../components/PageState'
import { planOf } from '../lib/plans'
import { useLang } from '../lib/i18n'

/**
 * Owner profile: company, GST number, contact name and phone (table fleet_owners;
 * GST is mock-only for now), the trucks and their plans, language and log out.
 * Read-only: changes go through the EcoStream team in the prototype.
 */
export default function ProfilePage() {
  const ownerQ = useApi(getOwner, [])
  const trucksQ = useApi(getTrucks, [])
  const { session, signOut } = useAuth()
  const { t: tr } = useLang()
  const owner = ownerQ.data

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold md:text-3xl">{tr('nav.profile')}</h1>

      {ownerQ.loading && !owner && <Loading what="profile" />}
      {ownerQ.error && <ErrorBox message={ownerQ.error} onRetry={ownerQ.reload} />}
      {!ownerQ.loading && !ownerQ.error && !owner && (
        <p className="mt-4 rounded-xl bg-white p-5 text-navy-700 ring-1 ring-gray-200">
          No owner profile found for this login. Ask EcoStream to set it up.
        </p>
      )}

      {owner && (
        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy-900 font-heading text-xl font-extrabold text-green-300">
              {owner.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold">{owner.company ?? owner.name}</p>
              <p className="text-sm text-navy-700">Fleet owner since {new Date(owner.created_at).getFullYear()}</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field icon={Building2} label={tr('profile.company')} value={owner.company} />
            <Field icon={Receipt} label={tr('profile.gst')} value={owner.gst_no} />
            <Field icon={UserRound} label={tr('profile.contact')} value={owner.name} />
            <Field icon={Phone} label={tr('profile.phone')} value={owner.phone} />
          </dl>
          {session?.user.email && <p className="mt-3 text-sm text-navy-700">Logged in as {session.user.email}</p>}
          <p className="mt-3 text-xs text-navy-700">To change these details, contact the EcoStream team.</p>
        </section>
      )}

      {/* Trucks and plans */}
      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{tr('profile.trucksPlans')}</h2>
          <Link to="/plans" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-500">
            <Tag size={16} aria-hidden /> {tr('nav.plans')}
          </Link>
        </div>
        {trucksQ.data && (
          <ul className="mt-2 divide-y divide-gray-100">
            {trucksQ.data.map((t) => (
              <li key={t.id}>
                <Link to={`/trucks/${t.id}`} className="flex min-h-[48px] items-center justify-between gap-3 py-2 hover:text-green-700">
                  <span className="min-w-0">
                    <span className="block font-heading font-bold">{t.reg_no}</span>
                    <span className="block truncate text-sm text-navy-700">
                      {t.make} {t.model}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <PlanBadge plan={planOf(t)} />
                    <ChevronRight size={18} aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Settings */}
      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-lg font-bold">{tr('profile.language')}</h2>
        <LanguageSwitch className="mt-3" />
        {session && (
          <button
            type="button"
            onClick={signOut}
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-navy-900/20 font-semibold text-navy-900 hover:bg-red-50 hover:text-critical sm:w-auto sm:px-6"
          >
            <LogOut size={18} aria-hidden /> {tr('nav.logout')}
          </button>
        )}
      </section>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-navy-700">
        <Icon size={14} aria-hidden /> {label}
      </dt>
      <dd className="mt-0.5 break-words font-semibold">{value || <span className="font-normal text-navy-700">Not set</span>}</dd>
    </div>
  )
}

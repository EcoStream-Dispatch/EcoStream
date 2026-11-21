/*
 * The three kinds of login (stage W2). Must match the CHECK in
 * supabase/migrations/20261121000004_profiles_roles.sql.
 */
export type Role = 'owner' | 'driver' | 'shipper'

export const ROLES: Role[] = ['owner', 'driver', 'shipper']

/** Where each role lands after logging in. */
export const PORTAL_HOME: Record<Role, string> = {
  owner: '/owner/dashboard',
  driver: '/driver',
  shipper: '/shipper',
}

export function isRole(v: unknown): v is Role {
  return v === 'owner' || v === 'driver' || v === 'shipper'
}

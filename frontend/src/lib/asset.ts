/**
 * URL of a file in frontend/public, e.g. asset('logo-mark.png').
 *
 * Use this instead of "/logo-mark.png": on GitHub Pages the site lives under
 * /EcoStream/, not at the root, and import.meta.env.BASE_URL knows the right prefix.
 */
export const asset = (file: string) => `${import.meta.env.BASE_URL}${file.replace(/^\//, '')}`

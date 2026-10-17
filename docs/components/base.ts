export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** Prefix a /public asset path with the configured basePath (needed for raw <img> under GitHub Pages). */
export function asset(p: string): string {
    return `${BASE}${p.startsWith('/') ? p : `/${p}`}`;
}

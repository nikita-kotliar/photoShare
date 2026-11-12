const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function withBase(path, base = BASE) {
  if (!base || typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    return path;
  }
  return base + path;
}

export function stripBase(pathname, base = BASE) {
  if (!base) return pathname;
  if (pathname === base) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

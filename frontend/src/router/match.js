export function compilePath(path) {
  if (path === '*') return { regex: /^.*$/, keys: [] };

  const keys = [];
  const pattern = path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return { regex: new RegExp(`^${pattern}/?$`), keys };
}

export function matchRoute(routes, pathname) {
  for (const route of routes) {
    if (route.path === '*') continue;
    const { regex, keys } = compilePath(route.path);
    const match = regex.exec(pathname);
    if (!match) continue;

    const params = {};
    keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return { route, params };
  }

  const fallback = routes.find((route) => route.path === '*');
  return fallback ? { route: fallback, params: {} } : null;
}

export function parseQuery(search) {
  return Object.fromEntries(new URLSearchParams(search));
}

export function resolveAccess(route, user) {
  const access = route.access || 'any';

  if (access === 'guest') {
    return user ? { redirect: '/home' } : { allowed: true };
  }
  if (access === 'any') {
    return { allowed: true };
  }
  if (!user) {
    return { redirect: '/auth' };
  }
  if (route.roles && !route.roles.includes(user.role)) {
    return { redirect: '/home' };
  }
  return { allowed: true };
}

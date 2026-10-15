import { matchRoute, parseQuery, resolveAccess } from './match.js';

export function createRouter({ routes, outlet, store }) {
  let cleanup = null;
  let renderToken = 0;

  function isInternalLink(anchor) {
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
    if (anchor.hasAttribute('data-external')) return false;
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin;
  }

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a[href]');
    if (!isInternalLink(anchor)) return;

    event.preventDefault();
    navigate(anchor.pathname + anchor.search + anchor.hash);
  }

  async function render() {
    const token = ++renderToken;
    const { pathname, search } = window.location;
    const found = matchRoute(routes, pathname);
    if (!found) return;

    const access = resolveAccess(found.route, store.get().user);
    if (access.redirect) {
      navigate(access.redirect, { replace: true });
      return;
    }

    const module = await found.route.load();
    if (token !== renderToken) return;

    if (cleanup) cleanup();
    cleanup = null;
    outlet.replaceChildren();

    const ctx = {
      params: found.params,
      query: parseQuery(search),
      path: pathname,
      navigate,
      store,
    };
    const result = await module.default(ctx);
    if (token !== renderToken) {
      if (result?.destroy) result.destroy();
      return;
    }

    const element = result instanceof Node ? result : result.el;
    cleanup = result instanceof Node ? null : result.destroy || null;
    outlet.append(element);
    document.title = found.route.title ? `${found.route.title} | PhotoShare` : 'PhotoShare';
    window.scrollTo(0, 0);
  }

  function navigate(to, { replace = false } = {}) {
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (to === current) {
      render();
      return;
    }
    window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
    render();
  }

  function start() {
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', render);
    store.subscribe(
      () => render(),
      (s) => s.user?.id ?? null,
    );
    return render();
  }

  return { start, navigate, refresh: render };
}

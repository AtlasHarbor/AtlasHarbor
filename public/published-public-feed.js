(() => {
  const previousFetch = window.fetch.bind(window);
  const isPublicFeedRead = (input, init = {}) => {
    try {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || String(input || ''), location.href);
      const method = String(init.method || request?.method || 'GET').toUpperCase();
      if (method !== 'GET' || url.origin !== location.origin) return false;
      return url.pathname === '/api/published-feed' || /^\/api\/published-feed\/[^/]+$/.test(url.pathname);
    } catch {
      return false;
    }
  };

  window.fetch = function atlasPublishedPublicFeed(input, init = {}) {
    if (!isPublicFeedRead(input, init)) return previousFetch(input, init);

    const request = input instanceof Request ? input : null;
    const headers = new Headers(init.headers || request?.headers || {});
    headers.delete('Authorization');
    headers.delete('authorization');

    if (request) {
      const clean = new Request(request, { ...init, headers, credentials: 'omit', cache: 'no-store' });
      return previousFetch(clean);
    }
    return previousFetch(input, { ...init, headers, credentials: 'omit', cache: 'no-store' });
  };
})();

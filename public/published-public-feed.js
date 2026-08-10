(() => {
  const previousFetch = window.fetch.bind(window);
  const isPublicFeedList = (input, init = {}) => {
    try {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || String(input || ''), location.href);
      const method = String(init.method || request?.method || 'GET').toUpperCase();
      return method === 'GET' && url.origin === location.origin && url.pathname === '/api/published-feed';
    } catch {
      return false;
    }
  };

  window.fetch = function atlasPublishedPublicFeed(input, init = {}) {
    if (!isPublicFeedList(input, init)) return previousFetch(input, init);

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

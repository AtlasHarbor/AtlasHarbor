(() => {
  const previousFetch = window.fetch.bind(window);
  const isPublicFeedRead = (input, init = {}) => {
    try {
      const request = input instanceof Request ? input : null;
      const url = new URL(request?.url || String(input || ''), location.href);
      const method = String(init.method || request?.method || 'GET').toUpperCase();
      return method === 'GET' && url.origin === location.origin && /^\/api\/published-feed(?:\/[^/]+)?$/.test(url.pathname);
    } catch {
      return false;
    }
  };

  window.fetch = function atlasPublishedPublicFirst(input, init = {}) {
    if (!isPublicFeedRead(input, init)) return previousFetch(input, init);

    // Publication existence is public data. Viewer authentication must never change
    // whether a list item or direct publication URL can be read. Owner controls are
    // resolved separately after the public article has rendered.
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

const EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Whether `url` belongs to the app's own renderer: under the renderer
 * directory for a packaged/built app (`file:`), or on the renderer dev server
 * during development.
 */
export function isAppUrl({
  appBaseUrl,
  url,
}: {
  readonly appBaseUrl: string;
  readonly url: string;
}) {
  const target = URL.parse(url);

  if (target === null) {
    return false;
  }

  const base = new URL(appBaseUrl);

  if (base.protocol === "file:") {
    return (
      target.protocol === "file:" && target.pathname.startsWith(base.pathname)
    );
  }

  return target.origin === base.origin;
}

export function isExternalUrl(url: string) {
  const target = URL.parse(url);

  return target !== null && EXTERNAL_URL_PROTOCOLS.has(target.protocol);
}

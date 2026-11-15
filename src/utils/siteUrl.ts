/**
 * A business's site address, built safely (LT-315, security review L2).
 *
 * `subDomain` is the owner's own input, and the API long checked little more
 * than that it was not empty. Pasted into `https://${subDomain}.lightor.app`,
 * a value like "login-lightor.example/x?" made the admin panel's "open site"
 * link point at somebody else's page, shown as that tenant. The address is
 * built with URL, and offered only when the label is a plain DNS label and
 * the host really is a lightor.app subdomain; otherwise there is no link.
 */
const LABEL = /^[a-z0-9-]+$/;

/**
 * The site's own Lightor address, `https://<sub>.lightor.app`. The dashboard's
 * previews (the editor's frame, a post's preview) stay on it whatever domain
 * the owner connected: the edge skips its redirect to the domain only for a
 * framed request on this address, and the domain cannot be framed here.
 */
export const siteUrlOf = (subDomain: string | null | undefined): string | null => {
  if (!subDomain || !LABEL.test(subDomain)) return null;
  try {
    const url = new URL(`https://${subDomain}.lightor.app`);
    if (!url.hostname.endsWith('.lightor.app') || url.hostname !== `${subDomain}.lightor.app`) return null;
    return url.origin;
  } catch {
    return null;
  }
};

// A plain host name: two labels or more of letters, digits and inner hyphens,
// the last one no number (an IP is no domain), 253 characters at most.
const HOST_LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOST = new RegExp(`^(?:${HOST_LABEL}\\.)+${HOST_LABEL}$`);

/**
 * The owner's own domain (LT-661), by the same care as the address above: it
 * is used only when it is a plain host name that URL reads back unchanged -
 * no scheme, port, path, credentials or spaces - and never a Lightor address.
 * Anything else is no domain, and the caller falls back to the Lightor one.
 */
export const customHostOf = (host: string | null | undefined): string | null => {
  if (typeof host !== 'string' || !host || host.length > 253 || !HOST.test(host)) return null;
  if (/^\d+$/.test(host.slice(host.lastIndexOf('.') + 1))) return null;
  if (host === 'lightor.app' || host.endsWith('.lightor.app')) return null;
  try {
    const url = new URL(`https://${host}`);
    return url.hostname === host && url.origin === `https://${host}` ? host : null;
  } catch {
    return null;
  }
};

/** What an address is built from: the site's config, or an admin row. */
export interface SiteAddressSource {
  subDomain?: string | null;
  /** The owner's domain, sent by the API exactly while the site is served on it. */
  customHost?: string | null;
}

/**
 * The site's public address (LT-661): the owner's domain while the site is
 * served on it, else `https://<sub>.lightor.app`. Everything a person opens
 * in a new tab, copies, shares or scans goes through here; the previews do
 * not (see `siteUrlOf`). Null when there is no safe address at all.
 */
export const publicSiteUrlOf = (site: SiteAddressSource | null | undefined): string | null => {
  const host = customHostOf(site?.customHost);
  return host ? `https://${host}` : siteUrlOf(site?.subDomain);
};

/** The same address as people read it, with no scheme: "www.dana-studio.co.il" or "dana.lightor.app". */
export const publicSiteHostOf = (site: SiteAddressSource | null | undefined): string | null => {
  const url = publicSiteUrlOf(site);
  return url ? url.slice('https://'.length) : null;
};

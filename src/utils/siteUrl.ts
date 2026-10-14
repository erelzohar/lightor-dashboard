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

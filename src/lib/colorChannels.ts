/**
 * A hex colour as the bare channels Tailwind builds `primary` from
 * (`rgb(var(--color-primary-rgb) / <alpha-value>)`), so a utility such as
 * bg-primary/10 can put its own alpha in (LT-280): '#8b5cf6' → '139 92 246'.
 *
 * Reads #rgb, #rgba, #rrggbb and #rrggbbaa — palettes are hex wherever they
 * come from (the default, the register, the colour picker). A colour's own
 * alpha is dropped: the utility supplies one. Anything else is null.
 */
export const hexToRgbChannels = (color: string): string | null => {
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(color.trim())?.[1];
  if (!hex) return null;
  const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(' ');
};

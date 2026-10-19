/**
 * LT-426: the styles an owner tries on in the site editor, as the register
 * shows them after the build (LT-323/326/330): the server's vibe presets
 * (lightor-back aiController VIBE_COMPOSITION), each as a picture of one
 * sample café built in it. A tap dresses the owner's site in the style
 * (POST /api/ai/restyle): no AI, the content stays theirs.
 */
export const STYLES = [
  'atelier', 'serene', 'earthy', 'festive', 'crisp',
  'gallery', 'heritage', 'electric', 'industrial', 'underground',
] as const;

/** The café is Hebrew for a Hebrew dashboard and English for every other language (LT-405). */
export const stylePicture = (style: string, language: string): string =>
  language.startsWith('he') ? `/styles/${style}.webp` : `/styles/en/${style}.webp`;

/** A style's look on a site: its design and palette. */
export interface StyleLook {
  design: Record<string, unknown>;
  pallete: Record<string, unknown>;
}

/** The site in a style's look; the blocks lose their own variants, which would fight it. */
export const withLook = <T>(config: T, look: StyleLook): T => {
  const root = config as unknown as Record<string, unknown>;
  return {
    ...root,
    design: look.design,
    pallete: { ...(root.pallete as Record<string, unknown> | undefined), ...look.pallete },
    ...(Array.isArray(root.blocks)
      ? { blocks: (root.blocks as Record<string, unknown>[]).map(({ variant: _drop, ...block }) => { void _drop; return block; }) }
      : {}),
  } as unknown as T;
};

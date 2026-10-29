import type { CSSProperties } from 'react';

/**
 * LT-324: the site editor's phone preview wears the register's iPhone
 * (lightor-register Hero.tsx's device shell): a brushed-aluminium rim, the
 * side buttons and a violet glow. No pinhole camera: drawn over the screen, it
 * hid the site's own top bar (LT-394); no home bar either, it hid what the
 * site has at its bottom (LT-485).
 *
 * The shell is split so the preview's iframe never remounts on a switch
 * (a remount reloads the site and loses the editor's place): the editor keeps
 * ONE box around the iframe and only restyles it (`phoneBox`), drawing the
 * glow and buttons in a sibling of the same size behind it (`PhoneSurround`).
 */
export const PHONE_BORDER = 10;
const SCREEN_W = 375;

/** Where the phone sits in the workspace: centred, as tall as there is room for. */
export const phoneGeometry: CSSProperties = {
  width: SCREEN_W + PHONE_BORDER * 2,
  height: 'min(760px, calc(100% - 32px))',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};

/** The rim itself — the box the iframe lives in. */
export const phoneBox: CSSProperties = {
  ...phoneGeometry,
  borderRadius: 34,
  border: `${PHONE_BORDER}px solid transparent`,
  background:
    'linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(170deg, #5e5e64 0%, #2c2c32 28%, #4c4c52 58%, #1c1c22 100%) border-box',
  boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 48px 96px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.09)',
};

const button = (side: 'left' | 'right', top: string, height: string): CSSProperties => ({
  position: 'absolute',
  [side]: -PHONE_BORDER,
  top,
  width: PHONE_BORDER,
  height,
  background: `linear-gradient(${side === 'left' ? 90 : 270}deg, #222228, #3a3a40)`,
  borderRadius: side === 'left' ? '0 3px 3px 0' : '3px 0 0 3px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.4)',
});

/** Behind the rim: the glow, and the buttons standing out of its sides. */
export const PhoneSurround = ({ style }: { style?: CSSProperties }) => (
  <div className="absolute pointer-events-none" style={{ ...phoneGeometry, ...style }} aria-hidden="true" data-testid="phone-surround">
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse at 50% 42%, rgba(124,58,237,0.32) 0%, transparent 65%)',
        filter: 'blur(40px)',
        transform: 'scale(1.22)',
      }}
    />
    <div style={button('left', '10%', '3.2%')} />
    <div style={button('left', '16.5%', '6.2%')} />
    <div style={button('left', '25%', '6.2%')} />
    <div style={button('right', '19%', '9%')} />
  </div>
);

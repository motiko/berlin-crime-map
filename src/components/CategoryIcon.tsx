import type { ComponentType } from 'react';
import {
  IconBandage,
  IconBomb,
  IconCarCrash,
  IconDotsCircleHorizontal,
  IconFlame,
  IconGrave,
  IconHandGrab,
  IconLockOpen,
  IconPhoneCalling,
  IconPill,
  IconShieldSearch,
  IconSpeakerphone,
  IconUserQuestion,
} from '@tabler/icons-react';
import { CATEGORY_META, type Category } from '../../shared/categories.ts';

type Glyph = ComponentType<{ size?: number; stroke?: number; 'aria-hidden'?: boolean }>;

/** Same grid and stroke as Tabler (24 px, 2 px, round joins); Tabler deliberately has no gun or knife. */
function outline(paths: string[], name: string): Glyph {
  const Glyph: Glyph = ({ size = 24, stroke = 2, ...rest }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
  Glyph.displayName = name;
  return Glyph;
}

const IconPistol = outline(['M3 7h18v4h-10l-2 7h-4l2 -7h-4z', 'M11 11v1a2 2 0 0 0 2 2h1v-3'], 'IconPistol');
const IconKnife = outline(['M10 9h12c-1 4 -5 6 -12 6z', 'M3.5 10.5h4.5v3h-4.5a1.5 1.5 0 0 1 0 -3z'], 'IconKnife');

const GLYPHS: Record<Category, Glyph> = {
  shooting: IconPistol,
  knife: IconKnife,
  homicide: IconGrave,
  explosion: IconBomb,
  robbery: IconHandGrab,
  burglary: IconLockOpen,
  assault: IconBandage,
  political: IconSpeakerphone,
  traffic: IconCarCrash,
  fire: IconFlame,
  missing: IconUserQuestion,
  raid: IconShieldSearch,
  drugs: IconPill,
  fraud: IconPhoneCalling,
  other: IconDotsCircleHorizontal,
};

/** Relative luminance (WCAG) of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or ink, whichever contrasts more with the category colour. */
export function inkOn(hex: string): string {
  const l = luminance(hex);
  return (1.05 / (l + 0.05) >= (l + 0.05) / (0.0092 + 0.05) ? '#ffffff' : '#15181d');
}

interface Props {
  category: Category;
  /** Diameter of the coloured disc in px. */
  size?: number;
}

/** The category's icon on a disc of its colour. Decorative: the label always sits next to it. */
export function CategoryIcon({ category, size = 22 }: Props) {
  const Glyph = GLYPHS[category];
  const color = CATEGORY_META[category].color;
  return (
    <span className="cat-icon" style={{ width: size, height: size, background: color }} aria-hidden>
      <Glyph size={Math.round(size * 0.64)} stroke={2} />
    </span>
  );
}

/** Just the glyph in the current text colour, for use inside a coloured badge. */
export function CategoryGlyph({ category, size = 14 }: Props) {
  const Glyph = GLYPHS[category];
  return <Glyph size={size} stroke={2.25} aria-hidden />;
}

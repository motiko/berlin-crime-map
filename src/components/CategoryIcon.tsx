import {
  Bomb,
  Car,
  Cross,
  Crosshair,
  DotsThreeCircle,
  Fire,
  HandFist,
  HandGrabbing,
  Knife,
  LockSimpleOpen,
  Megaphone,
  PhoneCall,
  Pill,
  Siren,
  UserFocus,
  type Icon,
} from '@phosphor-icons/react';
import { CATEGORY_META, type Category } from '../../shared/categories.ts';

/**
 * One icon family (Phosphor), one weight. Shooting uses a crosshair rather than a gun
 * silhouette, and homicide the cross (†) German news uses for a death.
 */
const GLYPHS: Record<Category, Icon> = {
  shooting: Crosshair,
  knife: Knife,
  homicide: Cross,
  explosion: Bomb,
  robbery: HandGrabbing,
  burglary: LockSimpleOpen,
  assault: HandFist,
  political: Megaphone,
  traffic: Car,
  fire: Fire,
  missing: UserFocus,
  raid: Siren,
  drugs: Pill,
  fraud: PhoneCall,
  other: DotsThreeCircle,
};

interface Props {
  category: Category;
  /** Icon size in px: 18 in lists, 20 in the card. */
  size?: number;
}

/** The category's icon in its family's colour. Decorative: the label always sits next to it. */
export function CategoryIcon({ category, size = 18 }: Props) {
  const Glyph = GLYPHS[category];
  const { family } = CATEGORY_META[category];
  return (
    <span className="cat-icon" style={{ color: `var(--icon-${family})` }} aria-hidden>
      <Glyph size={size} weight="bold" />
    </span>
  );
}

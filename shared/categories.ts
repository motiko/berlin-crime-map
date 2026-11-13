export const CATEGORIES = [
  'shooting',
  'knife',
  'homicide',
  'explosion',
  'robbery',
  'burglary',
  'assault',
  'political',
  'traffic',
  'fire',
  'missing',
  'raid',
  'drugs',
  'fraud',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Colour encodes the family, the icon the category. Fifteen hues can't be told apart on a
 * map, where any two points may touch: only three hues plus a neutral grey pass the
 * colour-vision checks for every pair (dataviz validator, all pairs, light and dark).
 */
export const FAMILIES = ['people', 'property', 'police', 'other'] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_META: Record<Family, { label: string; color: string; colorDark: string }> = {
  people: { label: 'Harm to people', color: '#e34948', colorDark: '#e66767' },
  property: { label: 'Property and money', color: '#2a78d6', colorDark: '#3987e5' },
  police: { label: 'Police work and state security', color: '#199e70', colorDark: '#199e70' },
  other: { label: 'Traffic and other', color: '#898781', colorDark: '#898781' },
};

interface CategoryMeta {
  label: string;
  family: Family;
  description: string;
}

const META: Record<Category, CategoryMeta> = {
  shooting: { label: 'Shooting', family: 'people', description: 'Shots fired from a real or blank-firing gun, or a gunshot injury' },
  knife: { label: 'Knife attack', family: 'people', description: 'Stabbing or an attack with a knife or other blade' },
  homicide: { label: 'Homicide / death', family: 'people', description: 'Killing, attempted killing or a death under investigation' },
  explosion: { label: 'Explosion', family: 'property', description: 'Cash machine or vending machine blasts, explosive devices' },
  robbery: { label: 'Robbery', family: 'people', description: 'Robbery, armed robbery, extortion' },
  burglary: { label: 'Burglary / theft', family: 'property', description: 'Burglary, theft, vehicle theft' },
  assault: { label: 'Assault', family: 'people', description: 'Bodily harm without a knife or gun' },
  political: { label: 'Political / hate', family: 'police', description: 'Politically motivated, antisemitic, racist, homophobic or other hate crime' },
  traffic: { label: 'Traffic', family: 'other', description: 'Traffic accidents, dangerous driving, police chases' },
  fire: { label: 'Fire / arson', family: 'property', description: 'Arson and fires investigated by police' },
  missing: { label: 'Missing person', family: 'other', description: 'Missing person appeals and their outcomes' },
  raid: { label: 'Raid / searches', family: 'police', description: 'Large police operations, searches and arrests' },
  drugs: { label: 'Drugs', family: 'police', description: 'Drug offences and seizures' },
  fraud: { label: 'Fraud', family: 'property', description: 'Fraud, scam calls, forgery' },
  other: { label: 'Other', family: 'other', description: 'Everything else' },
};

/** Category metadata; `color` is the family's colour (light map and panel). */
export const CATEGORY_META = Object.fromEntries(
  CATEGORIES.map((c) => [c, { ...META[c], color: FAMILY_META[META[c].family].color }]),
) as Record<Category, CategoryMeta & { color: string }>;

/** Categories of one family, in CATEGORIES order. */
export const categoriesOf = (family: Family): Category[] => CATEGORIES.filter((c) => META[c].family === family);

export const DISTRICTS = [
  'Charlottenburg-Wilmersdorf',
  'Friedrichshain-Kreuzberg',
  'Lichtenberg',
  'Marzahn-Hellersdorf',
  'Mitte',
  'Neukölln',
  'Pankow',
  'Reinickendorf',
  'Spandau',
  'Steglitz-Zehlendorf',
  'Tempelhof-Schöneberg',
  'Treptow-Köpenick',
] as const;

export type District = (typeof DISTRICTS)[number];

/** Approximate geographic centre of each district (lat, lng). Used when a report names no street. */
export const DISTRICT_CENTROIDS: Record<District, [number, number]> = {
  'Charlottenburg-Wilmersdorf': [52.5002, 13.2826],
  'Friedrichshain-Kreuzberg': [52.5003, 13.4314],
  Lichtenberg: [52.5329, 13.5017],
  'Marzahn-Hellersdorf': [52.5288, 13.5819],
  Mitte: [52.5338, 13.3655],
  Neukölln: [52.4408, 13.4447],
  Pankow: [52.5966, 13.4336],
  Reinickendorf: [52.5935, 13.2934],
  Spandau: [52.5349, 13.1977],
  'Steglitz-Zehlendorf': [52.4354, 13.2414],
  'Tempelhof-Schöneberg': [52.4520, 13.3849],
  'Treptow-Köpenick': [52.4313, 13.5891],
};

export function isDistrict(value: string | null | undefined): value is District {
  return !!value && (DISTRICTS as readonly string[]).includes(value);
}

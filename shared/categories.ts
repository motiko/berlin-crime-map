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

export const CATEGORY_META: Record<Category, { label: string; color: string; description: string }> = {
  shooting: { label: 'Shooting', color: '#d7263d', description: 'Shots fired from a real or blank-firing gun, or a gunshot injury' },
  knife: { label: 'Knife attack', color: '#f46036', description: 'Stabbing or an attack with a knife or other blade' },
  homicide: { label: 'Homicide / death', color: '#6a040f', description: 'Killing, attempted killing or a death under investigation' },
  explosion: { label: 'Explosion', color: '#e8890c', description: 'Cash machine or vending machine blasts, explosive devices' },
  robbery: { label: 'Robbery', color: '#8b4fd8', description: 'Robbery, armed robbery, extortion' },
  burglary: { label: 'Burglary / theft', color: '#5c6bc0', description: 'Burglary, theft, vehicle theft' },
  assault: { label: 'Assault', color: '#c2185b', description: 'Bodily harm without a knife or gun' },
  political: { label: 'Political / hate', color: '#2e7d32', description: 'Politically motivated, antisemitic, racist, homophobic or other hate crime' },
  traffic: { label: 'Traffic', color: '#607d8b', description: 'Traffic accidents, dangerous driving, police chases' },
  fire: { label: 'Fire / arson', color: '#e65100', description: 'Arson and fires investigated by police' },
  missing: { label: 'Missing person', color: '#0288d1', description: 'Missing person appeals and their outcomes' },
  raid: { label: 'Raid / searches', color: '#00897b', description: 'Large police operations, searches and arrests' },
  drugs: { label: 'Drugs', color: '#5d9c2c', description: 'Drug offences and seizures' },
  fraud: { label: 'Fraud', color: '#8d6e63', description: 'Fraud, scam calls, forgery' },
  other: { label: 'Other', color: '#878c92', description: 'Everything else' },
};

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

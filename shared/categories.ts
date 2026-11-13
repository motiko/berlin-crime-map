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
  /** Short text for tooltips on the site. */
  description: string;
  /** What belongs in this category, for the extraction model. The prompt is built from these. */
  definition: string;
}

const META: Record<Category, CategoryMeta> = {
  shooting: { label: 'Shooting', family: 'people', description: 'Shots fired from a real or blank-firing gun, or a gunshot injury',
    definition:
      'Shots fired from a real, blank-firing or gas gun, or a gunshot injury. A gun that is only shown or pointed is not a shooting.' },
  knife: { label: 'Knife attack', family: 'people', description: 'Stabbing or an attack with a knife or other blade',
    definition:
      'Stabbing, cutting or an attack with a knife or other blade (Messerangriff), or a blade drawn against a person.' },
  homicide: { label: 'Homicide / death', family: 'people', description: 'Killing, attempted killing or a death under investigation',
    definition:
      'Only when someone actually died. Someone was killed by another person (Mord, Totschlag, Körperverletzung mit Todesfolge), or a death is investigated by a homicide unit (Mordkommission). Accidental deaths keep their own category: a fatal traffic accident is traffic, a death in a fire is fire. An attempted killing (versuchter Mord, versuchter Totschlag, versuchtes Tötungsdelikt) where nobody died goes under the weapon used (shooting, knife), and otherwise under assault, never other.' },
  explosion: { label: 'Explosion', family: 'property', description: 'Cash machine or vending machine blasts, explosive devices',
    definition:
      'Blasts and explosive devices: cash machines or vending machines blown up, pyrotechnics or bombs used as a weapon.' },
  robbery: { label: 'Robbery', family: 'people', description: 'Property taken or demanded by force or threat',
    definition:
      'Property taken or demanded by force or a threat against a person: Raub, schwerer Raub, räuberische Erpressung (including forcing someone to pay a claimed debt or money demand with threats or a weapon), räuberischer Diebstahl (force used to keep stolen goods right after the theft), and Überfall on people, shops or cash transporters. NOT robbery: a theft without force against the victim (pickpocketing, shoplifting, break-ins, vehicle theft), even if the suspect later resists arrest, flees, or is found carrying a weapon; and a threat with a weapon where nothing is taken or demanded (that is assault).' },
  burglary: { label: 'Burglary / theft', family: 'property', description: 'Theft without force: pickpocketing, shoplifting, break-ins, vehicle theft',
    definition:
      'Theft without force against a person: Diebstahl, Taschendiebstahl (pickpocketing), Ladendiebstahl (shoplifting), Einbruch (break-ins, smash-and-grab), and theft of cars, motorbikes, bikes or number plates. Includes Trickdiebstahl (distraction theft, e.g. by people posing as care workers or tradespeople), where things are taken rather than handed over.' },
  assault: { label: 'Assault', family: 'people', description: 'Bodily harm without a knife or gun',
    definition:
      'Violence, threats or coercion against a person with no blade used and no shot fired: Körperverletzung, Bedrohung (including threats with a gun that was not fired, where nothing is demanded), Nötigung, attacks on police or emergency services, and attempted killings by other means (beating, throwing objects onto a road, pushing in front of a train), even if nobody was hurt.' },
  political: { label: 'Political / hate', family: 'police', description: 'Politically motivated, antisemitic, racist, homophobic or other hate crime',
    definition:
      'Anything the police treat as politically motivated or as hate crime: cases taken over by the Staatsschutz (state security unit), antisemitic, racist, homophobic, misogynist or extremist acts.' },
  traffic: { label: 'Traffic', family: 'other', description: 'Traffic accidents, dangerous driving, police chases',
    definition:
      'Traffic accidents, dangerous or drunk driving, illegal races and police chases where no other category fits better.' },
  fire: { label: 'Fire / arson', family: 'property', description: 'Arson and fires investigated by police',
    definition:
      'Arson and fires that the police investigate.' },
  missing: { label: 'Missing person', family: 'other', description: 'Missing person appeals and their outcomes',
    definition:
      'Missing person appeals and reports that a missing person was found.' },
  raid: { label: 'Raid / searches', family: 'police', description: 'Large police operations, searches and arrests',
    definition:
      'Searches (Durchsuchungen), arrest operations and seizures whose subject is weapons (e.g. a gun found in a check), organised crime or several kinds of offence, and that are not the follow-up of one specific incident. If the operation is about one kind of crime, use that category instead (drug dealing is drugs, document forgery is fraud). Not official notices: an Allgemeinverfügung, road closures, event orders, prevention campaigns and appeals are other.' },
  drugs: { label: 'Drugs', family: 'police', description: 'Drug offences and seizures',
    definition:
      'Drug offences: dealing, possession, seizures, and searches or arrests over drug trafficking.' },
  fraud: { label: 'Fraud', family: 'property', description: 'Fraud, scam calls, forgery',
    definition:
      'Deception for money: Betrug, scam calls (Enkeltrick, falsche Polizeibeamte, Schockanrufe), Trickbetrug (the victim is tricked into handing over money or valuables, e.g. to fake police officers), forgery, investment and online fraud.' },
  other: { label: 'Other', family: 'other', description: 'Everything else',
    definition:
      'Anything that fits none of the categories above, including official notices (Allgemeinverfügung), event and road-closure orders, prevention campaigns and general police announcements.' },
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

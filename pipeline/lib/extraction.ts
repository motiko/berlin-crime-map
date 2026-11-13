import type Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, DISTRICTS } from '../../shared/categories.ts';
import type { Extraction, RawReport } from '../../shared/types.ts';

export const MODEL = 'claude-haiku-5-5';
export const MAX_TOKENS = 600;

export const SYSTEM_PROMPT = `You extract structured data from Berlin police press releases, which are written in German.
Call the record_incident tool exactly once.

Rules:
- category: the single most serious incident in the report. When several apply, prefer this order:
  homicide > shooting > explosion > knife > robbery > political > assault > fire > raid > missing > drugs > fraud > burglary > traffic > other.
  "shooting" includes blank-firing or gas pistols when shots were fired. A gun shown or used for threats without firing is "robbery" if something was stolen or demanded, otherwise "assault".
  "homicide" covers killings, attempted killings, and deaths investigated by a homicide unit (Mordkommission).
  "political" covers anything handled as politically motivated or hate crime (Staatsschutz, antisemitic, racist, homophobic, etc.).
- street: the street where the incident happened, spelled as in the text (e.g. "Meinekestraße"). Never use the address of a police office or where tips can be given (e.g. "Keithstraße 30", "Platz der Luftbrücke 6"). Null if no incident street is named.
- houseNumberOrCrossing: a house number ("52") or the crossing street ("Sonnenallee") if given, else null.
- placeName: a named place if that is the best location (a park, station, square or landmark such as "Görlitzer Park" or "Bahnhof Zoo"), else null.
- district: one of ${DISTRICTS.join(', ')}; or null if the incident is not in one specific Berlin district.
- incidentDate: the date the incident happened (YYYY-MM-DD). Resolve words like "gestern" or "heute früh" relative to the publication date. Null if unknown.
- summaryEn: at most two short, neutral English sentences about what happened. Never include personal names (not even abbreviated ones like "Lisa T."), nationalities, ethnicities or descriptions of appearance. Ages and genders are fine.
- injured / dead: number of people injured or killed as stated, 0 if the text says nobody was hurt, null if not stated.
- weaponType: e.g. "firearm", "blank-firing gun", "knife", "explosive", "vehicle", or null.`;

export const TOOL: Anthropic.Tool = {
  name: 'record_incident',
  description: 'Record the structured data extracted from one police press release.',
  input_schema: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: [...CATEGORIES] },
      incidentDate: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      street: { type: ['string', 'null'] },
      houseNumberOrCrossing: { type: ['string', 'null'] },
      placeName: { type: ['string', 'null'] },
      district: { type: ['string', 'null'], enum: [...DISTRICTS, null] },
      summaryEn: { type: 'string' },
      injured: { type: ['integer', 'null'] },
      dead: { type: ['integer', 'null'] },
      weaponType: { type: ['string', 'null'] },
    },
    required: [
      'category',
      'incidentDate',
      'street',
      'houseNumberOrCrossing',
      'placeName',
      'district',
      'summaryEn',
      'injured',
      'dead',
      'weaponType',
    ],
  },
};

export function buildRequest(report: RawReport): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [
      {
        role: 'user',
        content: [
          `Published: ${report.publishedAt}`,
          `Location given by police (Ereignisort): ${report.location ?? 'none'}`,
          `Title: ${report.title}`,
          '',
          report.body,
        ].join('\n'),
      },
    ],
  };
}

export function readExtraction(message: Anthropic.Message): Extraction {
  const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!block) throw new Error(`No tool call in response (stop_reason: ${message.stop_reason})`);
  const input = block.input as Extraction;
  if (!(CATEGORIES as readonly string[]).includes(input.category)) input.category = 'other';
  return input;
}

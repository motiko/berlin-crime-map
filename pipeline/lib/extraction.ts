import { CATEGORIES, CATEGORY_META, DISTRICTS } from '../../shared/categories.ts';
import type { Extraction, RawReport } from '../../shared/types.ts';

/** Any OpenRouter model with tool support works; override with OPENROUTER_MODEL. */
export const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5';
export const MAX_TOKENS = 600;
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export const SYSTEM_PROMPT = `You extract structured data from Berlin police press releases, which are written in German.
Call the record_incident tool exactly once.

Rules:
- category: the single most serious incident in the report, using the definitions under "Categories" below. When several apply, prefer this order:
  homicide > shooting > explosion > knife > robbery > political > assault > fire > raid > missing > drugs > fraud > burglary > traffic > other.
  Classify by what the suspect did to the victim, not by what happened during the arrest: resisting arrest, fleeing, or a weapon found in a search do not make a theft a robbery.
- street: the street where the incident happened, spelled as in the text (e.g. "Meinekestraße"). Never use the address of a police office or where tips can be given (e.g. "Keithstraße 30", "Platz der Luftbrücke 6"). Null if no incident street is named.
- houseNumberOrCrossing: a house number ("52") or the crossing street ("Sonnenallee") if given, else null.
- placeName: a named place if that is the best location (a park, station, square or landmark such as "Görlitzer Park" or "Bahnhof Zoo"), else null.
- district: one of ${DISTRICTS.join(', ')}; or null if the incident is not in one specific Berlin district.
- incidentDate: the date the incident happened (YYYY-MM-DD). Resolve words like "gestern" or "heute früh" relative to the publication date. Null if unknown.
- summaryEn: at most two short, neutral English sentences about what happened. Never include personal names (not even abbreviated ones like "Lisa T."), nationalities, ethnicities or descriptions of appearance. Ages and genders are fine.
- injured / dead: number of people injured or killed as stated, 0 if the text says nobody was hurt, null if not stated.
- weaponType: e.g. "firearm", "blank-firing gun", "knife", "explosive", "vehicle", or null.

Categories:
${CATEGORIES.map((c) => `- ${c}: ${CATEGORY_META[c].definition}`).join('\n')}`;

const TOOL = {
  type: 'function',
  function: {
    name: 'record_incident',
    description: 'Record the structured data extracted from one police press release.',
    parameters: {
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
  },
} as const;

export function userMessage(report: RawReport): string {
  return [
    `Published: ${report.publishedAt}`,
    `Location given by police (Ereignisort): ${report.location ?? 'none'}`,
    `Title: ${report.title}`,
    '',
    report.body,
  ].join('\n');
}

export interface ExtractResult {
  extraction: Extraction;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** USD, as reported by OpenRouter. */
  cost: number;
}

export interface ChatResponse {
  model: string;
  choices: { message: { tool_calls?: { function: { arguments: string } }[] }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number; cost?: number };
  error?: { message: string };
}

export const HEADERS = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': 'https://github.com/motiko/berlin-crime-map',
  'X-Title': 'Berlin Crime Map',
});

/** Chat-completions body without the model (batches set the model once for all requests). */
export function chatBody(report: RawReport) {
  return {
    max_tokens: MAX_TOKENS,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage(report) },
    ],
    tools: [TOOL],
    tool_choice: { type: 'function', function: { name: TOOL.function.name } },
  };
}

export function parseChatResponse(data: ChatResponse): ExtractResult {
  const call = data.choices?.[0]?.message.tool_calls?.[0];
  if (!call) throw new Error(`No tool call in response (finish_reason: ${data.choices?.[0]?.finish_reason})`);
  const extraction = JSON.parse(call.function.arguments) as Extraction;
  if (!(CATEGORIES as readonly string[]).includes(extraction.category)) extraction.category = 'other';
  return {
    extraction,
    model: data.model,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    cost: data.usage?.cost ?? 0,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One synchronous call. Used for the small daily runs. */
export async function extract(report: RawReport, apiKey: string, maxAttempts = 4): Promise<ExtractResult> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: HEADERS(apiKey),
      body: JSON.stringify({ model: MODEL, ...chatBody(report), usage: { include: true } }),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
      await sleep(3000 * 2 ** (attempt - 1));
      continue;
    }
    const data = (await res.json()) as ChatResponse;
    if (!res.ok || data.error) throw new Error(`OpenRouter ${res.status}: ${data.error?.message ?? 'request failed'}`);
    return parseChatResponse(data);
  }
}

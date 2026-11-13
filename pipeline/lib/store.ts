import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA = join(ROOT, 'data');
export const RAW_DIR = join(DATA, 'raw');
export const EXTRACTED_DIR = join(DATA, 'extracted');
export const BATCH_DIR = join(DATA, 'batches');
export const GEOCODE_CACHE = join(DATA, 'geocode-cache.json');
export const PUBLIC_DATA = join(ROOT, 'public', 'data');

export const rawPath = (year: number, id: string) => join(RAW_DIR, String(year), `${id}.json`);
export const extractedPath = (year: number, id: string) => join(EXTRACTED_DIR, String(year), `${id}.json`);

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

export async function writeJson(path: string, value: unknown, pretty = true): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, pretty ? 2 : undefined) + '\n');
}

/** All JSON files in a per-year folder, parsed. */
export async function readYear<T>(dir: string, year: number): Promise<T[]> {
  const folder = join(dir, String(year));
  if (!existsSync(folder)) return [];
  const files = (await readdir(folder)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map((f) => readJson<T>(join(folder, f))));
}

export function yearsWithData(dir: string): Promise<number[]> {
  if (!existsSync(dir)) return Promise.resolve([]);
  return readdir(dir).then((names) => names.filter((n) => /^\d{4}$/.test(n)).map(Number).sort());
}

export function parseArgs(argv = process.argv.slice(2)): Record<string, string | true> {
  const args: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function yearsFromArgs(args: Record<string, string | true>): number[] {
  const current = new Date().getFullYear();
  if (typeof args.year === 'string') return [Number(args.year)];
  const from = typeof args.from === 'string' ? Number(args.from) : current;
  const to = typeof args.to === 'string' ? Number(args.to) : current;
  const years: number[] = [];
  for (let y = from; y <= to; y++) years.push(y);
  return years;
}

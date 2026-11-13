const USER_AGENT = 'berlin-crime-map/0.1 (+https://github.com/motiko/berlin-crime-map)';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestAt = 0;

/**
 * GET a berlin.de page politely: one request at a time, at least `minGapMs` apart,
 * retrying with backoff on 429 and 5xx. The site rate-limits parallel requests.
 */
export async function politeGet(url: string, minGapMs = 3500, maxAttempts = 5): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const wait = lastRequestAt + minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
    if (res.ok) return res.text();

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0;
      const backoff = Math.max(retryAfter * 1000, 5000 * 2 ** (attempt - 1));
      console.warn(`  ${res.status} on ${url}, retrying in ${Math.round(backoff / 1000)}s`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`GET ${url} failed: ${res.status}`);
  }
  throw new Error(`GET ${url} failed after ${maxAttempts} attempts`);
}

export { sleep, USER_AGENT };

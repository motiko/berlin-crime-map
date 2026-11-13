import type { NewsLink } from '../../shared/types.ts';
import { formatDate } from '../lib/filter.ts';

const OUTLETS: Record<string, string> = {
  'rbb24.de': 'rbb24',
  'tagesspiegel.de': 'Tagesspiegel',
  'berliner-zeitung.de': 'Berliner Zeitung',
  'morgenpost.de': 'Berliner Morgenpost',
  'bz-berlin.de': 'B.Z.',
  'berliner-kurier.de': 'Berliner Kurier',
  'taz.de': 'taz',
  'tag24.de': 'TAG24',
  'bild.de': 'BILD',
  'zeit.de': 'ZEIT ONLINE',
  'n-tv.de': 'n-tv',
  'stern.de': 'stern',
  'welt.de': 'WELT',
  'spiegel.de': 'SPIEGEL',
  'rnd.de': 'RND',
};
const outletName = (domain: string) => OUTLETS[domain] ?? domain;

/** News coverage of an incident: articles about it, then round-ups and live blogs that mention it. */
export function NewsLinks({ links }: { links: NewsLink[] }) {
  const articles = links.filter((l) => l.kind === 'article');
  const mentions = links.filter((l) => l.kind === 'mention');
  if (!links.length) return null;

  return (
    <section className="news" aria-labelledby="news-title">
      <h3 id="news-title">In the news</h3>
      {articles.length > 0 && (
        <ul className="news-list">
          {articles.map((a) => (
            <li key={a.url}>
              <span className="news-source">
                {outletName(a.outlet)}
                {a.date && <time dateTime={a.date}>{formatDate(a.date)}</time>}
              </span>
              <a href={a.url} target="_blank" rel="noreferrer" lang="de">
                {a.title}
              </a>
            </li>
          ))}
        </ul>
      )}
      {mentions.length > 0 && (
        <p className="news-mentions">
          {articles.length ? 'Also mentioned in ' : 'Mentioned in '}
          {mentions.map((m, i) => (
            <span key={m.url}>
              {i > 0 && (i === mentions.length - 1 ? ' and ' : ', ')}
              <a href={m.url} target="_blank" rel="noreferrer">
                {outletName(m.outlet)}
                {m.date ? ` (${formatDate(m.date)})` : ''}
              </a>
            </span>
          ))}
          {mentions.length > 1 ? ', round-ups or live blogs.' : ', a round-up or live blog.'}
        </p>
      )}
      <p className="note">Found automatically and checked by AI. Articles may name the people involved, and some are paywalled.</p>
    </section>
  );
}

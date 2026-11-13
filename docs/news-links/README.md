# News links for incidents

Goal: show, for each incident on the map, links to news articles that report on it ("In the news"), and later to public discussions (Reddit and similar).

Status: **pilot**. Nothing here feeds the site yet. Results of the first run (245 incidents, 92% with at least one article, 53 of 54 hand-checked links correct, $2.05) are in [pilot-2026.md](pilot-2026.md).

## How it works

For each incident, [`pipeline/news-pilot.ts`](../../pipeline/news-pilot.ts) makes two calls through OpenRouter, using the same API key as the extraction:

1. **Search.** A short German query, built from the police title, the street or place, the district and the month (for example `Schüsse auf 30-Jährigen – Zeugenaufruf Hardenbergplatz Charlottenburg-Wilmersdorf Berlin August 2026`), goes to OpenRouter's [web search plugin](https://openrouter.ai/docs/guides/features/plugins/web-search) with the Exa engine, restricted to German news sites. Only the returned results are used (URL, title, an excerpt); the model's reply is ignored.
2. **Check.** A separate model call gets the police report and the candidate articles, and decides for each article whether it covers the same incident (same event, place and date; a later article about the same case, such as an arrest or a verdict, counts too). It answers through a forced tool call with a verdict, a confidence and a one-line reason. Matches with high or medium confidence are kept.

Searching and checking are separate on purpose: the search query stays short and specific, and the check sees the full police text.

```bash
pnpm news-pilot                                   # 2026 shootings and homicides
pnpm news-pilot --categories knife,robbery --limit 50
pnpm news-pilot --ids 1701194,1689852
pnpm news-pilot --report                          # summarise saved results only
```

Results go to `data/news-pilot/<id>.json`. That folder is gitignored, because it holds article excerpts (press text). A run stops at `--budget` dollars (default 5) and skips incidents that already have a result.

## Cost

| Item | Price |
|---|---|
| Exa search via OpenRouter | $0.007 per search (up to 10 results) |
| Search and check together, measured in the pilot | $0.0083 per incident |

## Rules for showing links (proposed)

- Show the outlet, the article date and the headline as a link. No excerpts or teaser text: German press publishers' rights allow only very short extracts, while linking is fine.
- Mark paywalled articles.
- Wrong links are worse than none. Only show matches the check accepts with high or medium confidence, and keep a test set of incidents with known articles to measure errors, like the category eval.
- Linked articles may name suspects and victims and show photos, unlike our summaries. The About text should say so.
- Which outlets to include is an editorial decision (for example tabloids such as BILD and B.Z.). The pilot searches broadly to see which outlets actually cover these incidents.

## Open questions

- Outlet list for the site.
- How far back: only new incidents, 2026, or the full archive from 2020.
- Round-ups and chronicles ("Das Jahr der Schüsse in Berlin") that mention an incident in passing: show them, show them separately, or leave them out.
- Re-checking: articles appear days after the police report, and follow-ups (verdicts) months later. A second search after a few days would catch most.
- Daily runs: instead of a search per incident, read the RSS feeds of the outlets every day and match locally, which costs nothing but the check call.

## Later: Reddit and similar

- Reddit: the Data API needs a registered app and is free only for low, non-commercial use. Relevant threads are mostly in r/berlin and only for big incidents. Comments are unmoderated and often speculative, so link to the thread only, labelled as discussion, and show none of its text.
- Bluesky and Mastodon have free public search APIs, but are unlikely to add much.
- The same two-step approach (search, then check) applies; Exa can be pointed at `reddit.com` with `include_domains`.

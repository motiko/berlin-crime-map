# Pilot: news links for 2026 incidents

Run on 13 November 2026 with [`pipeline/news-pilot.ts`](../../pipeline/news-pilot.ts). Method: see [README.md](README.md).

## Summary

- **Coverage is high.** 225 of 245 incidents (92%) got at least one article: nearly every shooting and homicide, and 75–90% of knife attacks, robberies, traffic and political cases.
- **The links are accurate.** In a hand check of 54 accepted links, 53 were about the right incident. One was wrong: a round-up of pedestrian accidents attached to a different accident.
- **It is cheap.** $0.0083 per incident, search and check together. The whole pilot cost $2.05.
- **Round-ups need their own treatment.** Two chronicles of the year's shootings were matched to 35 and 13 incidents. These are correct mentions, but not articles about the incident.

## Scope

| Set | Incidents | Selection |
|---|---|---|
| Shootings | 115 | all of 2026 |
| Homicides | 20 | all of 2026 |
| Knife attacks | 30 | the 30 most recent |
| Robberies | 30 | the 30 most recent |
| Traffic | 30 | the 30 most recent |
| Political / hate | 20 | the 20 most recent |

Searched outlets: rbb24, Tagesspiegel, Berliner Zeitung, Berliner Morgenpost, B.Z., Berliner Kurier, taz, BILD, TAG24, Spiegel, Zeit, Welt, n-tv, stern, RND. Up to 6 results per search.

## Results

### Coverage

| Category | With at least one article |
|---|---|
| Homicide / death | 20 of 20 |
| Shooting | 114 of 115 |
| Knife attack | 27 of 30 |
| Traffic | 26 of 30 |
| Robbery | 23 of 30 |
| Political / hate | 15 of 20 |
| **All** | **225 of 245 (92%)** |

The search returned 1,470 candidates (6 per incident), and the check accepted 1,004 of them, about 4 per incident.

Shootings were unusually well covered in 2026, because of the series of shootings investigated by the special unit BAO Ferrum. The other categories come from October and November only, so coverage across the whole year and the archive will be lower.

### Accuracy (hand check)

Accepted links, random samples, judged by comparing the police report with the article's title and excerpt:

| Sample | Right incident | Wrong | Notes |
|---|---|---|---|
| 30 shooting and homicide links | 30 | 0 | 4 are round-ups or chronicles that mention the incident among others; for 1 of these the excerpt did not show the entry, so it is plausible rather than proven |
| 24 knife, robbery, traffic and political links | 23 | 1 | The wrong one: a Tagesspiegel round-up of pedestrian accidents matched to a different accident (Heerstraße, Spandau vs. Pankow). 3 links point to live blogs whose page title is about another story |

Rejected candidates, 12 sampled: 11 were rightly rejected (other place, other date, generic round-up). One may be a miss: a petrol station robbery in Köpenick rejected with low confidence although the article could describe the same night.

The check is conservative by design: when an article only mentions the incident in passing, it tends to reject it.

### Outlets

Accepted links per outlet:

| Outlet | Links |
|---|---|
| tagesspiegel.de | 256 |
| bz-berlin.de | 146 |
| tag24.de | 115 |
| morgenpost.de | 108 |
| rbb24.de | 80 |
| n-tv.de | 77 |
| zeit.de | 61 |
| berliner-zeitung.de | 53 |
| welt.de | 52 |
| stern.de | 28 |
| berliner-kurier.de | 10 |
| bild.de | 9 |
| spiegel.de | 7 |
| taz.de | 2 |

zeit.de, n-tv.de, stern.de and welt.de often carry the same dpa wire text. About half of all links (478) are on outlets with a full or partial paywall (Tagesspiegel, Morgenpost, Berliner Zeitung, Welt, BILD).

### Cost

| | |
|---|---|
| Total | $2.05 for 245 incidents |
| Per incident | $0.0083 (search $0.007 plus the tokens for results and the check) |
| All 2026 incidents (1,347) | about $11 |
| Serious categories in 2026 (shooting, homicide, knife, explosion, robbery, political; about 550) | about $4.60 |
| Full archive 2020–2026 (about 14,000) | about $115 |

## Problems found

1. **Chronicles and round-ups.** "Das Jahr der Schüsse in Berlin: Eine Chronik" (Tagesspiegel) was matched to 35 incidents and "Kugel-Hauptstadt!: Die Chronik der Schuss-Gewalt" (B.Z.) to 13. A further 13 links point to tickers or "News aus den Berliner Bezirken" pages. These are mentions, not reports on the incident.
2. **Live blog titles.** On a live blog, the page title belongs to the latest entry, not to the incident ("Partygäste verwüsten Wohnung" for a robbery of a 92-year-old). Showing that title would confuse readers.
3. **Syndicated duplicates.** The same dpa report appears on several sites, so one incident can get five links that say the same thing.
4. **Names in headlines.** Some headlines name victims (for example the killed 13-year-old from Marzahn, with first name and initial), which our own summaries avoid.
5. **Article dates.** The check sometimes takes the incident date as the article date. Dates should come from the page, not from the model.

## Recommendation

Go ahead, with these rules:

- **Show at most 3 articles per incident,** preferring local outlets (rbb24, Tagesspiegel, Berliner Zeitung, Morgenpost, B.Z.) and one article per wire story.
- **List round-ups, chronicles and live blogs separately** as "Also mentioned in", or leave them out. The check can flag them: add an `article_type` field (`report`, `follow-up`, `round-up`, `live blog`).
- **For live blogs and round-ups, show the outlet and date, not the page title.**
- **Mark paywalled outlets.**
- **Start with 2026 for the serious categories** (about $4.60), then run new incidents daily. A second search 3 days after the police report catches articles that appear later; follow-ups like verdicts would need a later re-check.
- **Build a test set** of about 30 incidents with known articles, including round-ups and near misses, and run it whenever the prompt or search changes, like the category eval.
- **Editorial decisions for the site owner:** whether to include tabloids (BILD, B.Z., TAG24, Berliner Kurier) and how far back to go.

## Not done in the pilot

- No changes to the site or the published data.
- Article excerpts stay in the gitignored `data/news-pilot/` folder; only headlines and links appear in this document.
- Reddit and other forums were not searched (see [README.md](README.md#later-reddit-and-similar)).

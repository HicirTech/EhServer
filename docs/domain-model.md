# Domain model

- Status: Proposed
- Facts this rests on: the [research wiki](https://github.com/HicirTech/EhServer/wiki), especially [Parsers-and-Data-Model](https://github.com/HicirTech/EhServer/wiki/Parsers-and-Data-Model), [API](https://github.com/HicirTech/EhServer/wiki/API), [Site-Map](https://github.com/HicirTech/EhServer/wiki/Site-Map) and [Limits-and-Anti-Crawling](https://github.com/HicirTech/EhServer/wiki/Limits-and-Anti-Crawling).

EhServer is an API over one domain. Its model is designed for that domain; it is not copied from E-Hentai's pages or from any client.

## 1. Principles

1. **Canonical, not upstream-shaped.** Entities describe the domain. `eh-core` maps upstream HTML and JSON onto them, and the API serves only them. Upstream URLs, query syntax and bitmasks stay inside `eh-core`.
2. **Unknown is not a value.** A field is present only when it is known. `null` means the upstream positively says there is none. No sentinel such as `-1`, `0` or `""` stands for "unknown". Where a state can be unknown, its type has an explicit `unknown` member.
3. **Global and account-scoped facts are separate.** What is true for everyone (gallery metadata) never shares a record, a cache entry or a response object with what depends on the account (favourites, own rating, votes, quota, search results under the account's filters).
4. **Identity comes from the domain.** Entities are identified by upstream ids (gid, page number, sha1), never by URLs.
5. **Provenance.** Every fetched aggregate carries `observedAt` and `source`, the upstream operation that produced it.
6. **Units and time.** Sizes in bytes and counts are integers. Instants are UTC, in RFC 3339. Ratings are numbers with a stated range.
7. **Closed and open sets.** Sets that E-Hentai fixes are closed enums: a value that maps to none of them makes the response `unrecognized` ([outcomes.md](outcomes.md)). Sets that E-Hentai extends, such as tag namespaces, are open strings with a documented list of known values.
8. **Vocabulary.** Names follow the official `gdata` vocabulary where it exists, in camelCase: `titleJpn`, `fileCount`, `fileSize`, `torrentCount`.

## 2. Identities

| Identity | Form | Notes |
|---|---|---|
| Gallery | `gid`: integer > 0 | The token is an access key, not part of the identity |
| Gallery access key | `token`: 10 lowercase hex digits | Needed for upstream requests; the latest known token is kept |
| Page | `gid` and `number`, number ≥ 1 | Upstream page numbers start at 1 |
| Page key | `pageToken`: 10 lowercase hex digits | Community sources: the first 10 hex digits of the original file's SHA-1 |
| Image file | `sha1`: 40 lowercase hex digits | Of the bytes actually served |
| Comment | `gid` and `commentId` | `commentId` 0 is the uploader's comment |
| Favourite folder | `slot`: 0–9 | Per account |
| User, account, egress, job, token, sample | server-assigned opaque strings | |

## 3. Gallery (global)

| Field | Type | From | Notes |
|---|---|---|---|
| `gid`, `token` | identity | every source | |
| `title` | string | `gdata`, detail page | |
| `titleJpn` | string, or `null` | `gdata`, detail page | `null`: no Japanese title |
| `category` | Category | `gdata`, detail page | closed enum, section 7 |
| `uploader` | string, or `null` | `gdata`, detail page | |
| `posted` | instant | `gdata` (epoch seconds) | authoritative; page text is a fallback, read as UTC |
| `fileCount` | integer ≥ 0 | `gdata`, detail page | |
| `fileSize` | integer, bytes | `gdata` | |
| `expunged` | boolean | `gdata` | |
| `rating` | `average` (0–5) and `count` (integer ≥ 0) | `gdata` (average), detail page (count) | |
| `torrentCount` | integer ≥ 0 | `gdata` | |
| `torrents` | list of Torrent | `gdata` | `hash`, `addedAt`, `name`, `torrentSize`, `fileSize`; personal tracker keys never appear |
| `tags` | list of Tag | `gdata` with `namespace: 1`, detail page | |
| `language` | `name`, `translated`, `rewrite`; or `null` | derived from `language:` tags | |
| `lineage` | optional `parent`, `first`, `current` gallery refs | `gdata` | |
| `newerVersions` | list of gallery ref, title, added | detail page | present only after a detail read |
| `favoritedCount`, `visible` | integer, boolean | detail page | present only after a detail read |
| `observedAt`, `source` | provenance | | |

A gallery summary in lists is the same aggregate with fewer fields present; it never uses different names.

## 4. Account-scoped state

| Entity | Fields |
|---|---|
| `GalleryUserState` | `favorite` (`slot`, `note`; or `null`), `myRating` (0.5–5, or `null`), `canRate`, `canComment`, `observedAt` |
| `CommentUserState` | `myVote` (−1, 0 or 1), `canVote`, `canEdit` |
| `FavoriteFolder` | `slot`, `name`, `count` |
| `FavoriteEntry` | gallery ref, `slot`, `note`, `favoritedAt` |
| `WatchedTag` | `id`, `tag`, `watched`, `hidden`, `color`, `weight` |
| `QuotaState` | `mode` (`account`, `ip`, `temporary`, `unknown`); `used` and `limit`, only when the site shows them; `restrictedToLowResolution` (`yes`, `no`, `unknown`); `resetCost` in GP, when shown; `temporaryUntil` |
| `AccountState` | `session` (`valid`, `expired`, `unknown`); `siteAccess` with `eh` and `ex`, each `yes`, `no` or `unknown`; `quota`; `gp` and `credits`, when known; `observedAt` |

## 5. Pages and files

| Entity | Fields |
|---|---|
| `Page` | `gid`, `number`, `pageToken`, `thumbnail` (a server link), `file` once resolved |
| `ImageFile` | `sha1`, `size`, `width`, `height`, `format`, `variant` (`original`, or `resample` with its width), `degraded` (served smaller than requested), `originalSha1` when known |

## 6. Comments and discovery

| Entity | Fields |
|---|---|
| `Comment` | `commentId`, `author`, `isUploader`, `postedAt`, `editedAt` (or `null`), `score` (or `null` for the uploader's comment), `body` as sanitized HTML and as plain text |
| `SearchQuery` | `text`; `categories` (the included set); `advanced` (named switches: `searchName`, `searchTags`, `searchDescription`, `searchTorrentNames`, `onlyWithTorrents`, `searchLowPowerTags`, `searchDownvotedTags`, `showExpunged`); `minRating` (2–5); `pages` (`from`, `to`) |
| `SearchPage` | `items` (gallery summaries); `next` and `prev` (opaque cursors); `total` (`value`, `approximate`), when the site states it; `filteredOut`, the galleries the account's filters removed, when stated |
| `Toplist` | `type` (`galleries`, `uploaders`, `tagging`, `hentaiAtHome`, `ehTracker`, `cleanup`, `ratingAndReviewing`), `period` (`allTime`, `pastYear`, `pastMonth`, `yesterday`), ranked entries |

## 7. Value sets

| Set | Kind | Values |
|---|---|---|
| Category | closed | `doujinshi`, `manga`, `artistCg`, `gameCg`, `western`, `nonH`, `imageSet`, `cosplay`, `asianPorn`, `misc` |
| Tag namespace | open | known: `language`, `parody`, `character`, `group`, `artist`, `cosplayer`, `male`, `female`, `mixed`, `other`, `reclass`, `location`, `temp` |
| Site | closed | `eh`, `ex` |
| Tri-state | closed | `yes`, `no`, `unknown` |

The upstream category bitmask (`f_cats` excludes, not includes) and the label strings exist only inside `eh-core`.

## 8. Server-side entities

| Entity | Fields |
|---|---|
| `User` | `id`, `name` |
| `ApiToken` | `id`, `scopes`, `createdAt`, `lastUsedAt`, `revokedAt`; the secret is shown once |
| `Account` | `id`, `userId`, `egressId`, `state` (AccountState); credentials are never returned |
| `Egress` | `id`, `kind` (`mock`, `probe`, `direct`, `proxy`), `state` (`ok`, `warned`, `cooldown`, `banned`, `degraded`, `unavailable`), `cooldownUntil`, `reason` (outcome code), `accountCount`, `sharedWarning` |
| `Job` | `id`, `kind` (`download`, `archiveDownload`, `refresh`), `userId`, `accountId`, `target` (gallery ref), `options` (variant, GP budget), `state`, `progress` (`pages` done and total, `bytes`), `outcome` (final), `idempotencyKey`, `createdAt`, `updatedAt`, `steps` (each with its outcome and timing) |
| `Event` | `id` (monotonic), `type`, `at`, subject ids, `outcome` |
| `LibraryItem` | gallery snapshot taken at download time, `formatVersion`, `files` (ImageFile plus page number and file name), `completeness` (`complete`, or `partial` with the missing page numbers), `integrity` (`verified` or `mismatch`), `storedAt` |
| `Outcome` | `kind` (`success`, `empty`, `degraded`, `failure`, `unrecognized`, `unconfirmed`), `code`, `clientAction`, `retryAfter`, `requestId`, `sampleId` ([outcomes.md](outcomes.md)) |

## 9. Lifecycles

- **Job:** `queued → running ⇄ paused → succeeded | failed | cancelled`. A `paused` job always carries the outcome that paused it. A job waiting for an egress or account cooldown is `paused` with that cooldown's outcome.
- **Egress:** `ok → warned → cooldown → ok`; `ok` or `warned` → `banned` until the ban expires → `ok`; any state → `unavailable` while the egress cannot be reached.
- **Account session:** `unknown → valid` or `expired`; `valid → expired` when a `signed_out` outcome is seen.

## 10. Invariants

| ID | Invariant |
|---|---|
| I1 | A cached or returned global gallery never contains account-scoped fields. |
| I2 | A library file becomes visible only after its size and sha1 match. |
| I3 | A `succeeded` download job has every page present and verified. |
| I4 | An account is bound to one egress; by default an egress serves one account. |
| I5 | No identity is a URL, and no upstream URL leaves `eh-core`. |
| I6 | Every instant is UTC. |
| I7 | Every enum value in a response was mapped from a recognized upstream value. |

## 11. Freshness

| Data | Kept for | Refreshed by |
|---|---|---|
| Gallery metadata | 24 h | `gdata`, in batches of 25 |
| Page tokens | until a token error | detail pages |
| Account state | 5 min | home page, favourites page |
| Search pages | per account, 5 min | the search itself |

These values are initial and live in configuration.

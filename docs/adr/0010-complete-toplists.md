# ADR-0010: Toplists are served whole, from snapshots

- Status: Accepted in part (maintainer, 2026-10-11): `getToplist` returns the whole toplist. The maintainer left the method to the implementer; the method below is Proposed.

## Context

A galleries toplist runs to 200 pages of 50 galleries (pages captured in 2023 and 2024-04). The governor loads one page at a time, 3 to 6 s apart ([ADR-0005](0005-egress-governor.md)), so reading a whole toplist takes about 15 minutes. No request can wait that long: the whole list must exist before a client asks for it.

The site recomputes its toplists at times we do not know. A read that spans a recomputation joins pages of two different lists.

## Decision

- `getToplist` returns every entry of the latest complete snapshot of the toplist: rank, score and gallery. It never returns part of a list, and toplists have no paging in the API.
- A snapshot is made by a walk: every page from `p=0` to the last page the pager names, then the first and the last page again.
- The walk becomes the snapshot only when:
  - every page names the toplist requested and the same page count;
  - the ranks run from 1 to the last entry without a gap;
  - no gallery appears twice;
  - the first and the last page, read again, equal their first reading.
- A walk that fails these checks is discarded: the list moved while it was read. The next walk starts 10 minutes later, or an hour later after three discarded walks in a row. A walk that meets a failure outcome follows that outcome's action ([outcomes.md](../outcomes.md)).
- A snapshot is a global fact: one per toplist, shared by every user ([domain-model.md](../domain-model.md) I1). It is fresh for 24 hours.
- Walks start only on demand, when a request finds no snapshot or a stale one. One walk runs at a time per toplist. Walks have background priority: a client's page load goes before a walk's next page.
- With a snapshot, fresh or stale, `getToplist` answers 200 at once with the snapshot's `observedAt`; a stale snapshot also queues a walk. Without a snapshot it answers 202 with the walk's progress and a `Retry-After`.
- Only the galleries toplists are served for now. The six other types answer 501 until their pages have been captured and parsed.

## Consequences

- A whole toplist costs its page count plus two page loads: at most 202, at most once a day per toplist, and only for toplists that clients ask for ([nfr.md](../nfr.md) PERF-4).
- The first request for a toplist waits for a walk of about 15 minutes.
- A recomputation that changes neither the first nor the last page and repeats no gallery passes unseen. Such a snapshot can miss a gallery that moved between pages while they were read. This risk is accepted: a toplist is a ranking for browsing, and the next walk replaces it within a day.
- A response holds up to 10,000 entries, about 0.7 MB of JSON before compression.

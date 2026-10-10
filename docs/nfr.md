# Non-functional requirements

- Status: Proposed. The quality bar in section 1 is the maintainer's (2026-10-10).

## 1. Quality bar

EhServer is a high-reliability service:

- every error is handled correctly;
- both the success path and the failure path are visible;
- the code is easy to debug and to maintain;
- its performance is known, not guessed.

## 2. Requirements

### Reliability

| ID | Requirement |
|---|---|
| REL-1 | Every upstream response is classified by the [outcome catalog](outcomes.md) before use. No code path treats an unclassified response as success. |
| REL-2 | Every write is confirmed by a read-back (outcomes.md R4). |
| REL-3 | Cooldowns, budgets, job state and idempotency keys survive a restart. |
| REL-4 | Egress fails closed: an unreachable egress fails its requests and never falls back to another. |
| REL-5 | Downloads are durable and resumable. Steps are idempotent. Files are written under a temporary name, verified by size and sha1, then renamed. |
| REL-6 | Queues are bounded. Overload returns 429 with `Retry-After`. |
| REL-7 | Identical concurrent upstream requests are merged into one. Work that nobody waits for any more is cancelled. |

### Observability

| ID | Requirement |
|---|---|
| OBS-1 | A request id (`X-Request-Id`) ties together the API request, its logs, its upstream calls, events and errors. |
| OBS-2 | Every response carries `Server-Timing`, split into queue, upstream, parse and store. |
| OBS-3 | Logs are structured JSON and pass through one redactor. |
| OBS-4 | Each job keeps a timeline of its steps, outcomes and timings, readable through the API. |
| OBS-5 | A success response says how success was established: the signature that matched, a read-back, or the cache. |
| OBS-6 | Unrecognized and rare responses are kept as sanitized samples (outcomes.md, section 6). |
| OBS-7 | Health, readiness, egress state and account state are exposed. An admin debug bundle exports logs, timelines and samples, redacted. |

### Security

| ID | Requirement |
|---|---|
| SEC-1 | E-Hentai credentials are encrypted at rest and never logged. The redactor has a test for every kind of secret. |
| SEC-2 | API tokens are stored hashed, scoped and revocable. |
| SEC-3 | The listen address is configurable and defaults to loopback. |
| SEC-4 | CI scans for secrets. The repository holds no account values and no real gallery content. |

### Site safety

| ID | Requirement |
|---|---|
| SITE-1 | Upstream limits have built-in maximums. Configuration can only lower them; clients cannot change them. |
| SITE-2 | No feature evades the site's limits, for example by rotating egress addresses. |
| SITE-3 | The GP budget is 0 unless a job sets one, and every spend is checked against it before the request is sent. |
| SITE-4 | By default an egress serves one account ([ADR-0005](adr/0005-egress-governor.md)). |

### Maintainability

| ID | Requirement |
|---|---|
| MAINT-1 | All E-Hentai knowledge is in `eh-core`, pure and fixture-tested. |
| MAINT-2 | Tests check responses against the OpenAPI contract. |
| MAINT-3 | Significant decisions are recorded as ADRs. |
| MAINT-4 | Comments are short and explain why; the code explains itself. |
| MAINT-5 | TypeScript runs in strict mode, and warnings fail the build. |

### Performance

| ID | Requirement |
|---|---|
| PERF-1 | Server overhead, excluding upstream waits, is at most 50 ms at p95 for cached reads with 10 concurrent clients. (Initial target.) |
| PERF-2 | Steady-state memory is at most 256 MB. (Initial target.) |
| PERF-3 | One call serves one screen; lists and metadata are batched. |
| PERF-4 | The number of upstream requests per operation is documented and tested. Example: a page image whose page token is known costs at most one `showpage` call and one image transfer. |

### Operability

| ID | Requirement |
|---|---|
| OPS-1 | One container image, one configuration file and one data directory, with automatic migrations. A backup is the data directory. |

### Testing

| ID | Requirement |
|---|---|
| TEST-1 | Every outcome code has a mock fault-injection test that checks its action. |
| TEST-2 | Every parser has success, empty and failure fixtures. |
| TEST-3 | A 24-hour soak test against the mock runs before each release. |

## 3. Hazards and controls

| ID | Hazard | Controls | Requirements |
|---|---|---|---|
| H1 | An E-Hentai account is banned | one account per user; by default one account per egress; governor maximums; no account sharing | SITE-1, SITE-4 |
| H2 | The egress IP is banned or downscaled | one governor; persisted cooldowns; an `nl` budget; fail closed | REL-3, REL-4, SITE-1 |
| H3 | Credentials leak | encryption at rest; one redactor; secret scanning | SEC-1, SEC-4, OBS-3 |
| H4 | Library data is lost or corrupted | temp-then-rename writes; sha1 checks; delete only on explicit command; a single writer | REL-5 |
| H5 | A wrong result is returned silently | positive identification; `upstream_unrecognized`; read-back; global and account data kept apart | REL-1, REL-2, OBS-6 |
| H6 | GP is spent unintentionally | GP budget 0 by default; every spend checked before sending | SITE-3 |
| H7 | The wrong egress or account is used | explicit egress profiles; `direct` refused in development; a start-up self-check | REL-4 |

## 4. Process

- Every change is reviewed.
- Tests name the requirement or hazard they verify.
- Every defect gets an issue.
- Third-party dependencies are listed with their version and the reason they are needed.
- Releases are versioned, and migrations are tested on a copy of real data.

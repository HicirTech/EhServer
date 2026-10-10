# ADR-0007: The library format

- Status: Proposed

## Context

The server must not write client-specific layouts ([ADR-0001](0001-generic-scope.md)), and it must never lose or corrupt stored galleries (hazard H4 in [nfr.md](../nfr.md)).

## Decision

- The library is a directory tree under the library root. `galleries/<gid>/` holds `manifest.json` and the page files.
- `manifest.json` carries a `formatVersion`, the gallery snapshot taken at download time, and one entry per page: number, file name, size, width, height, sha1 and variant ([domain-model.md](../domain-model.md)).
- Every file is written under a temporary name in the same directory, verified by size and sha1, then renamed. The manifest is written last, the same way.
- Nothing is deleted except by an explicit API call.
- The server is the only writer. The library root is a plain directory; network storage is mounted by the operator.

## Consequences

- Clients read the library through the API, or directly following this documented format.
- An interrupted download leaves only temporary files. A restart resumes from the manifest and the job state.

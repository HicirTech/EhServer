# Dependencies

Every third-party package, its pinned version and why it is here ([ADR-0002](adr/0002-bun-typescript-no-framework.md), [nfr.md](nfr.md) section 4). `bun.lock` pins everything they pull in.

Runtime: Bun 1.4.2 (`engines` in `package.json`; CI pins the same version).

| Package | Version | Use | Why | Licence |
|---|---|---|---|---|
| typescript | 7.0.2 | development | Type checking; Bun only strips types | Apache-2.0 |
| @biomejs/biome | 2.5.14 | development | Formatter and linter | MIT or Apache-2.0 |
| @types/bun | 1.4.2 | development | Bun's type definitions, matching the runtime | MIT |
| htmlparser2 | 12.0.0 | runtime | `eh-core` parses HTML with it ([ADR-0009](adr/0009-html-parsing.md)) | MIT |
| css-select | 7.0.0 | runtime | CSS selectors over the htmlparser2 tree | BSD-2-Clause |
| domhandler | 6.0.1 | runtime | The node types htmlparser2 builds | BSD-2-Clause |
| domutils | 4.0.2 | runtime | Text and attribute helpers for those nodes | BSD-2-Clause |

htmlparser2 brings `entities` 8.1.0 (BSD-2-Clause), which decodes HTML entities; `bun.lock` pins it with the rest.

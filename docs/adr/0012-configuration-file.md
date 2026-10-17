# ADR-0012: One configuration file

- Status: Accepted (maintainer, 2026-10-17)

## Context

[nfr.md](../nfr.md) OPS-1 asks for one configuration file and one data directory. Until now the server took its settings on the command line, the proxy's password included, where every local user can read it in the process list ([ADR-0011](0011-proxy-egress.md)). [ADR-0002](0002-bun-typescript-no-framework.md) prefers what Bun brings, and Bun parses TOML itself.

## Decision

- The server takes one option, `--config <file>`, and the file is TOML:

  ```toml
  data_dir = "data"          # read from the file's own folder when relative
  listen = "127.0.0.1"       # the default
  port = 8080                # the default; 0 picks a free port

  [egress]
  profile = "proxy:vps"      # or "mock"
  url = "http://ehserver@203.0.113.7:8888"
  password_env = "PROXY_PASSWORD"
  ```

- The file is closed: an unknown key, a missing key or a value of the wrong kind stops the server, and every such problem is named at once.
- No secret is written in the file. A proxy's password is read from the environment variable that `password_env` names. A URL that holds a password is refused, and no refusal repeats the URL.
- `profile` takes ADR-0005's names; only `mock` and `proxy:<name>` are accepted ([ADR-0011](0011-proxy-egress.md)).
- A configuration that cannot be used ends the server with exit code 78, as a refused proxy does.
- The file's structure is checked with the contract's own schema checker ([ADR-0008](0008-api-style.md)), so there is no second validator.

## Consequences

- The operator keeps the password in the environment of the server's process, for example in a service unit's environment file.
- Later settings, such as accounts, tokens and budgets, join the same file, and their secrets follow the same rule.
- The vertical slice's command line (`--data`, `--mock`, `--proxy`, `--listen`, `--port`) is gone.

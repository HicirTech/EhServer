# EhServer

A generic, self-hosted HTTP API over the E-Hentai site. One server reads the site on behalf of its clients, paces every request it sends, and answers through a documented contract ([`api/openapi.yaml`](api/openapi.yaml)).

Status: early. EhServer serves whole galleries toplists (`GET /api/v1/toplists/galleries?period=`), read through a proxy or through a local mock of the site, to callers with an API token. E-Hentai accounts and the other endpoints are still being built.

## Run the checks

```sh
bun install --frozen-lockfile
bun run format:check
bun run lint
bun run typecheck
bun test
```

The tests use the mock only; none of them sends a request to the site.

## Run it against the mock

The mock is a local stand-in for the site with synthetic pages ([`mock/README.md`](mock/README.md)):

```sh
bun mock/main.ts --port 7878
```

Write `ehserver.toml` ([ADR-0012](docs/adr/0012-configuration-file.md)):

```toml
data_dir = "data"

[egress]
profile = "mock"
url = "http://127.0.0.1:7878"
```

Make the first admin token ([ADR-0006](docs/adr/0006-users-accounts-tokens.md)). The command prints its secret once and keeps only a hash of it:

```sh
bun src/main.ts --config ehserver.toml create-admin-token admin
```

Start the server, then ask for a toplist with the token:

```sh
bun src/main.ts --config ehserver.toml
```

```sh
curl -H "Authorization: Bearer <secret>" "http://127.0.0.1:8080/api/v1/toplists/galleries?period=yesterday"
```

The first answer is `202` with a `Retry-After`; ask again until the whole toplist comes back.

With the admin token, `/api/v1/admin/users` and `/api/v1/admin/tokens` make users and give each device its own token.

## Run it against the site

EhServer reaches the site only through a proxy ([ADR-0011](docs/adr/0011-proxy-egress.md)). [`deploy/proxy-egress`](deploy/proxy-egress/) sets one up on a VPS.

## Design

[`docs/README.md`](docs/README.md) lists the design documents: the architecture decisions, the domain model, the outcome catalog, the non-functional requirements and the API contract.

## License

[MIT](LICENSE)

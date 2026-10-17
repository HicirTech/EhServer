# ADR-0011: Requests to the site leave only through a proxy

- Status: Accepted in part (maintainer, 2026-10-15): until EhServer runs in production, the only egress that reaches the site is a proxy on a VPS; the exit must never be the operator's own connection; requests show the site the browser the clients show it; the start-up check sends nothing to the site or to anyone else. The mechanics below are Proposed.

## Context

[ADR-0005](0005-egress-governor.md) names the egress profiles `mock`, `probe`, `direct` and `proxy:<name>`, and [nfr.md](../nfr.md) H7 asks for explicit profiles, `direct` refused in development, and a start-up check. Development and research must not use the operator's own connection or accounts; a VPS is the experiment egress.

Bun's `fetch` (1.4.2), checked against a fake proxy on the same machine with targets under `.invalid`:

- it reaches an HTTPS page through an HTTP or HTTPS proxy with `CONNECT`, and sends the proxy URL's credentials as `Proxy-Authorization`; it has no SOCKS proxies;
- a proxy it cannot reach is an error (`ConnectionRefused`, or `ENOTFOUND` for the proxy's host), and the request does not go around it;
- a proxy's own answer to `CONNECT` (403, 407, 502) comes back as if the page had answered;
- `NO_PROXY` or `no_proxy` naming the page's host, a suffix of it or `*` makes `fetch` skip the explicit proxy and connect directly; Bun reads them when the process starts, so removing them later changes nothing;
- `HTTP_PROXY` and `HTTPS_PROXY` do not override an explicit proxy.

tinyproxy 1.11 on a VPS answers a request without credentials with 407, and one with a wrong password with 401.

## Decision

- The egress that reaches the site is `proxy:<name>`, started with `--proxy <name>=<url>`. Every request names the proxy, so none leaves without it. `direct` and `probe` are not built.
- The server starts only when the proxy passes these checks, in this order, none of which sends anything to the site or to another service:
  1. the proxy is `http://` or `https://`;
  2. `NO_PROXY` and `no_proxy` are unset;
  3. every address of the proxy's host is public: not this machine, its network, a carrier-grade NAT, a link-local, multicast, NAT64 or mapped private address;
  4. the proxy accepts a TCP connection within 5 s.
- A proxy that cannot be reached, or refuses the credentials with 407 or 401, fails the request as `egress_unavailable` ([outcomes.md](../outcomes.md)); it is retried only through the same proxy.
- Every request carries the User-Agent most clients send: a fixed Chrome on Windows.
- Page loads through a proxy keep ADR-0005's site pacing; while the page rate is halved, a waiting client's `Retry-After` counts the longer gap.
- [`deploy/proxy-egress`](../../deploy/proxy-egress/) sets up such a proxy on a fresh VPS.

## Consequences

- A proxy reached through an SSH or WireGuard tunnel has a local address and is refused. Such a tunnel needs a check of its own before it can be allowed.
- A proxy's own 403 or 502 is classified as if the site had sent it: a 502 rests the egress like `upstream_unavailable`, and a 403 stops a read as `upstream_unrecognized`.
- The other way round, a 401 from the site, should it ever send one, is taken for the proxy refusing the credentials.
- The proxy URL, credentials included, is on the command line until the configuration file of nfr.md OPS-1 exists. Logs and problems name the proxy, never its URL.
- A machine whose environment sets `NO_PROXY` cannot start a proxy egress until it is removed.

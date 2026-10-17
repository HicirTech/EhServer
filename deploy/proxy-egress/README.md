# A proxy egress on a VPS

EhServer reaches the site only through a proxy ([ADR-0011](../../docs/adr/0011-proxy-egress.md)). [`proxy-setup.sh`](proxy-setup.sh) turns a fresh Ubuntu 24.04 VPS into that proxy at its first boot:

- tinyproxy on port 8888, open only to the machine that runs EhServer, and only with a password;
- tunnels only to port 443 of the site's hosts (`e-hentai.org`, `exhentai.org`, `ehgt.org`, `hath.network` and their subdomains);
- a firewall that drops everything else from any other address, SSH included; rules the image brought are reset first;
- logs at warning level only.

The VPS keeps no state for EhServer. Use one proxy for one EhServer: several proxies at once must not multiply the site's limits ([nfr.md](../../docs/nfr.md) SITE-2).

## Before you create the VPS

1. Find the public IPv4 address of the machine that runs EhServer.
2. Make a password of 16 or more letters, digits, `-`, `.`, `_` or `~`, for example a UUID.
3. In a copy of `proxy-setup.sh` outside this repository, set `EHSERVER_IP` and `PROXY_PASSWORD`. Never commit the filled copy. A copy left unfilled stops before it changes anything.

## Create the VPS

Choose a region from which the site can be reached: on 2026-10-17 it answered HTTP 451 to a VPS in Australia. Choose Ubuntu 24.04 LTS x64 and give the filled copy, with its Unix line endings, as the first-boot script: as cloud-init user data, or saved once as the provider's startup script and picked for every new VPS (on Vultr, a Startup Script of type Boot). The proxy is up a few minutes after the first boot; the script's output is in `/var/log/cloud-init-output.log`.

## Start EhServer through it

Put the password into the environment of EhServer's process, for example as `PROXY_PASSWORD`, and name that variable in the configuration file ([ADR-0012](../../docs/adr/0012-configuration-file.md)), which holds no secret itself:

```toml
data_dir = "data"

[egress]
profile = "proxy:vps"
url = "http://ehserver@<VPS address>:8888"
password_env = "PROXY_PASSWORD"
```

```sh
bun src/main.ts --config ehserver.toml
```

EhServer does not start while `NO_PROXY` or `no_proxy` is set, when the proxy's address is not public, or when the proxy does not accept connections.

## Check the proxy once

From the EhServer machine, a host outside the filter must be refused without a connection to it:

```sh
curl -s -o /dev/null -w "%{http_connect}\n" -x http://ehserver:<password>@<VPS address>:8888 https://example.com/
```

prints `403`. From any other address, port 8888 must not answer at all.

## When you are done

Delete the VPS. The next one can run the same filled copy.

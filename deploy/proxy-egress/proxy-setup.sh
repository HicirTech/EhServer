#!/bin/bash
# The proxy egress of ADR-0011 on a fresh Ubuntu 24.04 VPS. Runs once, as root, at first boot: as a
# provider's startup script or as cloud-init user data. Fill in the two values below in a copy outside
# the repository; README.md says how.
set -euo pipefail

EHSERVER_IP="FILL_IN_EHSERVER_IP"
PROXY_PASSWORD="FILL_IN_PASSWORD"

readonly PROXY_PORT=8888

# A copy that was not filled in opens nothing.
if ! [[ "$EHSERVER_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "proxy-setup: EHSERVER_IP is not an IPv4 address" >&2
  exit 1
fi
if ! [[ "$PROXY_PASSWORD" =~ ^[A-Za-z0-9._~-]{16,}$ ]]; then
  echo "proxy-setup: PROXY_PASSWORD must be 16 or more letters, digits, -, ., _ or ~" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
# The image's own first-boot updates may still hold the apt lock.
apt-get -o DPkg::Lock::Timeout=600 update
apt-get -o DPkg::Lock::Timeout=600 install -y tinyproxy ufw

# Keep the shipped pid file: the service unit may wait for it.
shipped_pid_file=$(grep -m 1 '^PidFile' /etc/tinyproxy/tinyproxy.conf || true)

cat > /etc/tinyproxy/filter <<'EOF'
^e-hentai\.org$
\.e-hentai\.org$
^exhentai\.org$
\.exhentai\.org$
^ehgt\.org$
\.ehgt\.org$
\.hath\.network$
EOF

cat > /etc/tinyproxy/tinyproxy.conf <<EOF
User tinyproxy
Group tinyproxy
Port ${PROXY_PORT}
${shipped_pid_file}
Timeout 60
MaxClients 16
LogLevel Warning
Syslog On
DisableViaHeader Yes
# Only the machine that runs EhServer, and only with the password.
Allow ${EHSERVER_IP}
BasicAuth ehserver ${PROXY_PASSWORD}
# Tunnels only to HTTPS, and only to the site's hosts.
ConnectPort 443
Filter "/etc/tinyproxy/filter"
FilterDefaultDeny Yes
EOF
chown root:tinyproxy /etc/tinyproxy/tinyproxy.conf /etc/tinyproxy/filter
chmod 0640 /etc/tinyproxy/tinyproxy.conf /etc/tinyproxy/filter

# The image may ship its own rules, SSH from anywhere among them.
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$EHSERVER_IP" to any port 22 proto tcp
ufw allow from "$EHSERVER_IP" to any port "$PROXY_PORT" proto tcp
ufw --force enable

systemctl enable tinyproxy
systemctl restart tinyproxy
echo "proxy-setup: tinyproxy listens on port ${PROXY_PORT} for ${EHSERVER_IP}"

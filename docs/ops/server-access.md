# Server access

How to reach the production server for support and development. No secrets live here: keys stay in each operator's password manager, and the `.env` stays on the server.

## Server

| | |
|---|---|
| Hostname | `srv-poc-tool` (Ubuntu 24.04) |
| SSH | `10.30.2.1:22` (ens160, DHCP) |
| App address | `10.30.11.150` (ens192, static, Caddy binds here) |
| User | `stellarcyber` (passwordless sudo, in the `docker` group) |
| App checkout | `/opt/poc-intel/app` |
| Data | `/opt/poc-intel/data/{postgres,files,caddy}` |
| Backups | `/opt/poc-intel/backups` |
| Timezone | America/Sao_Paulo (containers run in UTC) |

Reachable only from `10.30.0.0/16`: ufw allows 22, 80 and 443 from that range, and fail2ban guards sshd.

Host key: `ssh-ed25519 SHA256:58HYiPNwlCmhjJMXjWfqkTp9i/wex/NDjVBT7TW2+TI`. If ssh reports a different one, stop and ask.

## Getting access (once per operator)

Access is by SSH key only. Ask an existing operator to add your public key to `~stellarcyber/.ssh/authorized_keys`.

With the key in the Bitwarden SSH agent (Mac App Store build):

```bash
# ~/.zshrc
export SSH_AUTH_SOCK="$HOME/Library/Containers/com.bitwarden.desktop/Data/.bitwarden-ssh-agent.sock"
```

```
# ~/.ssh/config: IdentityFile points at the public key; the agent signs
Host poc-intel
  HostName 10.30.2.1
  User stellarcyber
  IdentityFile ~/.ssh/id_pocintel_bw.pub
  IdentitiesOnly yes
```

Check: `ssh -o BatchMode=yes poc-intel hostname` prints `srv-poc-tool`. Bitwarden Desktop must be open and unlocked.

### Claude Code

The Bash sandbox cannot read `~/.ssh`, so ssh needs the key from an agent. Set these in `~/.claude/settings.json`:

- `sandbox.excludedCommands`: `ssh *`, `scp *`, `rtk ssh *`, `rtk scp *`
- `sandbox.network.allowUnixSockets`: the Bitwarden socket path above
- `permissions.allow`: `Bash(ssh *)`, `Bash(rtk ssh *)`

Use the plain form `ssh -o BatchMode=yes stellarcyber@10.30.2.1 '<cmd>'`. The `poc-intel` alias does not work there, because it lives in `~/.ssh/config`. Do not use `$(...)` inside the remote command, or chain anything after it. To send a long script, base64-encode it locally and pipe it through `base64 -d` on the server.

## Common tasks

```bash
cd /opt/poc-intel/app
docker compose ps                                   # health
docker compose logs --since 1h api worker           # logs
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"  # DB (values in .env)
infra/scripts/deploy.sh                             # deploy
infra/scripts/backup.sh                             # backup
```

Read-only checks come first. Anything that changes data (a DELETE or UPDATE, a restore, a migration by hand) needs a backup first and an entry in the access log.

## Access log

Each operator keeps a local log of what they did on the server in `.local/server-access.secure.md` (git-ignored). The server keeps its own record in `/var/log/auth.log`.

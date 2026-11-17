# Git branches

Public fork of [jon-makinen/cursor-local-remote](https://github.com/jon-makinen/cursor-local-remote). Canonical remote: **https://github.com/rawshn97/cursor-local-remote**.

| Branch | Purpose | Who should use it |
|--------|---------|-------------------|
| **`main`** | Default OSS line: features, generic LAN setup, optional Cloudflare scripts (not required) | Anyone cloning the repo |
| **`rawshn/local`** | Maintainer Mac: launchd runbook, example plists, internet deploy checklist | Rawshn's machines only |

## Rules

- **`main` must not** embed personal auth tokens, API keys, or fixed hostnames in application code.
- **Secrets live on the Mac** only: `~/Library/LaunchAgents/*.plist`, `~/.cursor-local-remote/auth-token.json`, Cloudflare credentials.
- Generic tunnel/Access install scripts stay on **`main`** under `deploy/` and `scripts/deploy/`. Personal ordering and env values are documented on **`rawshn/local`**.

## Agents

1. Product and bugfix work: branch from **`main`**, merge back to **`main`**.
2. Personal deploy or launchd notes for Rawshn's Mac: read or update **`rawshn/local`** (`docs/DEPLOY_MAC_RAWSHN.md`).
3. Do not copy maintainer tokens from `rawshn/local` into shared code on `main`.

On **`rawshn/local` only:** `docs/DEPLOY_MAC_RAWSHN.md`, `deploy/local/com.cursor-local-remote.server.plist.example`.

## Sync workflow (maintainer)

```bash
git checkout main
git pull rawshn main
npm run build && ~/bin/clr-service-install.sh restart   # after code changes

git checkout rawshn/local
git merge main    # keep personal docs on top of latest product code
```
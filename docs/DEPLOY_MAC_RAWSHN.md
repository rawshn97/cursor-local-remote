# Mac deploy (Rawshn local)

This file exists only on branch **`rawshn/local`**. Public `main` does not ship personal tokens or hostnames.

## Live setup (this Mac)

| Item | Value |
|------|--------|
| Repo | `~/Projects/cursor-local-remote` (`CLR_REPO` in launchd) |
| Service | `com.cursor-local-remote.server` → `~/bin/clr-start.sh --no-open` |
| Server binary | `~/Applications/CLR.app/Contents/MacOS/clr-server` (`CLR_NODE`) |
| Auth token | Fixed in plist + `~/.cursor-local-remote/auth-token.json` (not in git) |
| Default model | `auto` via `CURSOR_DEFAULT_MODEL` |
| Default workspace | **No folder** (`~/.cursor-local-remote/no-folder`) |
| LAN | `http://<mac-lan-ip>:3100` |

**Token note:** Maintainer uses a fixed local token (`rawshn-is-cool`) via `AUTH_TOKEN` in the LaunchAgent. Never commit that string into `main`.

## After product changes on `main`

```bash
cd ~/Projects/cursor-local-remote
git checkout main && git pull rawshn main
npm run build
~/bin/clr-service-install.sh restart
```

`clr-service-install.sh` preserves env vars you already set in the plist when reinstalling (if you export them before `install`).

## Optional internet access (not required for LAN)

Generic scripts live on **`main`**:

- `scripts/deploy/install-cloudflare-tunnel.sh`
- `scripts/deploy/install-cloudflare-access.sh`
- `scripts/deploy/install-token-rotation.sh`
- `deploy/README.md`, `deploy/API.md`

On this Mac, tunnel launchd (`com.cursor-local-remote.cloudflared`) and `PUBLIC_URL` were **not** installed at last audit; `/api/info` returned `publicUrl: null`. To enable again:

1. Set `CLR_PUBLIC_HOSTNAME` and run tunnel install.
2. Reinstall CLR service with `PUBLIC_URL` and optional `CF_ACCESS_*` env vars (see `deploy/API.md`).
3. Bookmark phone URL with `?token=` from `auth-token.json`.

## Files outside git

- `~/Library/LaunchAgents/com.cursor-local-remote.server.plist` (contains `AUTH_TOKEN`, `CURSOR_API_KEY`, `CLR_REPO`)
- `~/.cursor-local-remote/auth-token.json`
- `~/.cursor-local-remote/logs/clr.*.log`

See `deploy/local/com.cursor-local-remote.server.plist.example` for a redacted template.

## Merge workflow

```bash
git checkout rawshn/local
git merge main
```

Resolve conflicts by keeping personal docs on this branch and generic code from `main`.
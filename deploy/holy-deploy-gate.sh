#!/bin/bash
# Forced command for website2's CI deploy key on holy (CT 205, 172.16.5.79), installed by hand as
# /usr/local/sbin/website2-deploy-gate (root-owned 0755). CI never updates it.
#
# The key sits in root's authorized_keys (root 600, which the app user cannot edit), pinned to this script:
#
#   restrict,command="/usr/local/sbin/website2-deploy-gate" ssh-ed25519 AAAA... holy-website2-ci@github-actions
#
# The gate drops to the app user `holy` before reading any input, so git, npm, the build and pm2 all run
# as holy, the same as the manual deploy. The only command it accepts is `deploy <40-hex sha>`:
#
# 1. Refuse if /home/holy/website2 has edits to tracked files, or a HEAD that the new commit does not
#    descend from (commits made on holy and not pushed).
# 2. Fetch the commit into the stage checkout /home/holy/website2-stage, copy in the three files that
#    exist only on holy (config/config.js, src/lib/middleware.ts, public/assets/blacklist.txt), then
#    npm ci and npm run build there. The live app keeps serving the whole time.
# 3. Swap by rename (one filesystem, no copy, and holy has no rsync): the live dist, sdk/dist and
#    node_modules move to /home/holy/website2-dist-backups/<old sha>, the stage's move into the live
#    checkout, and git reset --keep moves the live checkout to the commit. --keep leaves untracked and
#    ignored files (config.js, middleware.ts, blacklist.txt, the config.js.bak* copies) alone.
# 4. pm2 restart holy, then health-check :8080 and https://holyunb.locker/. On failure, move the old
#    dirs back, reset to the old commit, restart, and exit 1.
#
# Backups live outside the checkout on purpose: a dist.* dir inside it once made astro check run out of
# heap. Only this gate's backups (named by a full sha) are pruned; the dist.bak-* and dist.prev-* folders
# from hand deploys are left alone. The gate never prints config/config.js; it copies it with cp -p.
set -euo pipefail
umask 022

APP_USER=holy
if [[ $(id -un) != "$APP_USER" ]]; then
	exec runuser -u "$APP_USER" -- "$0" "$@"
fi

export HOME=/home/holy
LIVE=/home/holy/website2
STAGE=/home/holy/website2-stage
BACKUPS=/home/holy/website2-dist-backups
UPSTREAM=https://github.com/holy-unblocker/website2.git
PM2_APP=holy
PORT=8080
PUBLIC_URL=https://holyunb.locker/
STATE=/home/holy/.local/state/website2-deploy
LOG=$STATE/deploy.log
# Each backup holds node_modules (about 650M): keep two, on a 24G disk.
KEEP_BACKUPS=2
# Files the build and the server need that are not in git. They stay in the live checkout across every
# deploy and are copied into the stage before each build.
LOCAL_FILES=(config/config.js src/lib/middleware.ts public/assets/blacklist.txt)
# Build output and dependencies the server reads at runtime, swapped as whole dirs.
SYNC_DIRS=(dist sdk/dist node_modules)

# pm2 and node come from holy's login environment (a non-interactive ssh shell has a bare PATH).
for d in /home/holy/.local/bin /home/holy/.npm-global/bin /usr/local/bin /usr/bin /bin; do
	[[ -d $d ]] && PATH=$PATH:$d
done
if [[ -s $HOME/.nvm/nvm.sh ]]; then
	# shellcheck disable=SC1091
	. "$HOME/.nvm/nvm.sh" >/dev/null
fi
export PATH

mkdir -p "$STATE" "$BACKUPS"
read -r -a cmd <<<"${SSH_ORIGINAL_COMMAND:-}"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" >&2; }

exec 9>"$STATE/deploy.lock"
flock -w 900 9

healthcheck() {
	local ok=0
	for _ in $(seq 1 45); do
		if curl -fsS -o /dev/null -m 5 "http://127.0.0.1:$PORT/"; then
			ok=1
			break
		fi
		sleep 1
	done
	if (( !ok )); then
		log "health check failed: http://127.0.0.1:$PORT/ did not answer 2xx in 45 s"
		return 1
	fi
	# The public URL goes through the edge; the query string keeps a cache from answering for the app.
	for _ in $(seq 1 10); do
		if curl -fsS -o /dev/null -m 10 "$PUBLIC_URL?deploy=$(date +%s)"; then
			return 0
		fi
		sleep 3
	done
	log "health check failed: $PUBLIC_URL did not answer 2xx"
	return 1
}

restart_app() {
	pm2 restart "$PM2_APP" --update-env >/dev/null
	if ! healthcheck; then
		pm2 logs "$PM2_APP" --nostream --lines 40 2>&1 | grep -v -i -E 'password|secret|token' >&2 || true
		return 1
	fi
}

# Move each of SYNC_DIRS from $1 to $2 (both on /home). A dir missing in $1 is left out of $2.
move_dirs() {
	local from=$1 to=$2 d
	for d in "${SYNC_DIRS[@]}"; do
		rm -rf "${to:?}/$d"
		if [[ -d $from/$d ]]; then
			mkdir -p "$(dirname "$to/$d")"
			mv "$from/$d" "$to/$d"
		fi
	done
}

prune_backups() {
	# Only this gate's backups (named by a full sha); the old dist.bak-* folders elsewhere are not ours.
	find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9a-f]{40}' \
		-printf '%T@ %p\n' | sort -rn | tail -n +$((KEEP_BACKUPS + 1)) | cut -d' ' -f2- |
		while read -r old; do rm -rf "$old"; done
}

build_stage() {
	local sha=$1 f
	[[ -d $STAGE/.git ]] || git clone -q "$UPSTREAM" "$STAGE"
	git -C "$STAGE" fetch -q "$UPSTREAM" "$sha"
	git -C "$STAGE" checkout -q --force --detach "$sha"
	git -C "$STAGE" clean -qfdx -e node_modules
	for f in "${LOCAL_FILES[@]}"; do
		if [[ -e $LIVE/$f ]]; then
			mkdir -p "$STAGE/$(dirname "$f")"
			cp -p "$LIVE/$f" "$STAGE/$f"
		fi
	done
	(
		cd "$STAGE"
		nice -n 10 npm ci --no-audit --no-fund --loglevel=error
		nice -n 10 npm run build
	) >&2
	[[ -f $STAGE/dist/server/entry.mjs ]] || { log "build of $sha left no dist/server/entry.mjs"; return 1; }
}

deploy() {
	local sha=${1:-}
	[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo "usage: deploy <40-hex sha>" >&2; exit 64; }
	local live
	live=$(git -C "$LIVE" rev-parse HEAD)
	if [[ $live == "$sha" && -f $LIVE/dist/server/entry.mjs ]]; then
		log "already at $sha"
		return
	fi
	# Edits are sometimes made directly on holy: never overwrite unpushed or uncommitted work.
	if [[ -n $(git -C "$LIVE" status --porcelain --untracked-files=no) ]]; then
		log "refusing $sha: $LIVE has uncommitted changes to tracked files"
		exit 1
	fi
	git -C "$LIVE" fetch -q "$UPSTREAM" "$sha"
	if ! git -C "$LIVE" merge-base --is-ancestor "$live" "$sha"; then
		log "refusing $sha: live HEAD $live has commits that are not in $sha; push them first"
		exit 1
	fi
	log "deploying $sha (live $live)"
	if ! build_stage "$sha"; then
		log "build of $sha failed; live $live untouched"
		exit 1
	fi

	local backup=$BACKUPS/$live
	rm -rf "$backup"
	mkdir -p "$backup"
	git -C "$LIVE" reset -q --keep "$sha"
	move_dirs "$LIVE" "$backup"
	move_dirs "$STAGE" "$LIVE"
	if ! restart_app; then
		log "rolling back to $live"
		move_dirs "$LIVE" "$STAGE"
		move_dirs "$backup" "$LIVE"
		git -C "$LIVE" reset -q --keep "$live"
		restart_app || log "rollback to $live is unhealthy too"
		exit 1
	fi
	# Keep origin/master in the live checkout current so `git status` there reads right.
	git -C "$LIVE" fetch -q origin || true
	prune_backups
	log "deployed $sha"
}

case "${cmd[0]:-}" in
deploy) deploy "${cmd[1]:-}" ;;
*)
	echo "denied: '${SSH_ORIGINAL_COMMAND:-}'" >&2
	exit 126
	;;
esac

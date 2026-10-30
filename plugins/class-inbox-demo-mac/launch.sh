#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
case "$(uname -m)" in arm64) ARCH=arm64;; x86_64) ARCH=x64;; *) echo 'Unsupported Mac architecture' >&2; exit 1;; esac
CACHE="${HOME}/Library/Caches/ClassInboxDemo/node-v24.22.2-${ARCH}"
NODE="$CACHE/node"
if [ ! -x "$NODE" ]; then
 mkdir -p "$CACHE"
 TEMP=$(mktemp -d "$CACHE/unpack.XXXXXX")
 trap 'rm -rf "$TEMP"' EXIT HUP INT TERM
 tar -xzf "$ROOT/runtime/node-darwin-${ARCH}.tar.gz" -C "$TEMP" "node-v24.22.2-darwin-${ARCH}/bin/node"
 mv "$TEMP/node-v24.22.2-darwin-${ARCH}/bin/node" "$NODE"
 chmod 755 "$NODE"
 rm -rf "$TEMP"
 trap - EXIT HUP INT TERM
fi
exec "$NODE" "$ROOT/server.bundle.mjs"

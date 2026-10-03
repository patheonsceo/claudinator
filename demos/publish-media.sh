#!/usr/bin/env bash
# Publishes demos/out/*.gif to the media branch as <version>/ and latest/.
#   demos/publish-media.sh 0.1.0
set -euo pipefail

version="${1:?usage: demos/publish-media.sh <version>}"
dir="$(mktemp -d)"
trap 'git worktree remove --force "$dir" >/dev/null 2>&1 || true' EXIT

if git ls-remote --exit-code --heads origin media >/dev/null 2>&1; then
  git fetch -q origin media
  git worktree add -q "$dir" origin/media
  git -C "$dir" checkout -q -B media
else
  git worktree add -q --detach "$dir"
  git -C "$dir" checkout -q --orphan media
  git -C "$dir" rm -rfq .
fi

mkdir -p "$dir/$version" "$dir/latest"
cp demos/out/*.gif "$dir/$version/"
cp demos/out/*.gif "$dir/latest/"
git -C "$dir" add -A
git -C "$dir" commit -qm "media: GIFs for $version"
git -C "$dir" push -q origin media
echo "Published to https://github.com/patheonsceo/claudinator/tree/media/$version"

#!/usr/bin/env bash
# Renders demo tapes to demos/out/. Run from the repository root:
#   demos/record.sh                 # every tape
#   demos/record.sh demos/tapes/hero.tape
# Each recording runs a real Claude Code session (Haiku) against demos/fixture.
set -euo pipefail

command -v vhs >/dev/null || { echo "vhs is not installed: https://github.com/charmbracelet/vhs" >&2; exit 1; }
command -v claude >/dev/null || { echo "claude is not installed" >&2; exit 1; }

# Start each recording clean, even when this script runs from inside a Claude Code session.
for name in $(compgen -e | grep -E '^CLAUDE'); do unset "$name"; done
# VHS draws in a full-color browser terminal; tell Claude Code so the theme's exact colors show.
export COLORTERM=truecolor

mkdir -p demos/out
# Load a fresh copy of the plugin: Claude Code asks before any edit inside a loaded plugin's own
# folder, and demos/fixture sits inside this repository.
rm -rf demos/.plugin-under-test
mkdir -p demos/.plugin-under-test
cp -r .claude-plugin hooks src themes types demos/.plugin-under-test/
if [ "$#" -eq 0 ]; then
  set -- demos/tapes/[!_]*.tape
fi

for tape in "$@"; do
  echo "▶ $tape"
  vhs "$tape"
  git checkout -q -- demos/fixture
  git clean -fdq -- demos/fixture
done

du -h demos/out/*.gif

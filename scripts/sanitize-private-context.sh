#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cache="$(mktemp -d)"
trap 'rm -rf "$cache"' EXIT

# Encoded so this public checker does not embed the blocked context verbatim.
patterns=(
  QmVyZXNoaXQ= QmFtYXE= TU1CUQ== Z3VpbGhlcm1lLm1pcmFuZGE=
  d29ya3NwYWNlL2Rldi9sb2NhbA== LmxvY2FsL2JlcmVzaGl0
  Zm9ybWFsaXphdGlvbg== Y3JlZGl0LXNpbXVsYXRpb24=
  Y3JlZGl0LWZvcm1hbGl6YXRpb24= U2FsZXNmb3JjZQ== Q0FG
)

mapfile -t files < <(cd "$root" && npm --cache "$cache" pack --dry-run --json | node -e '
let text=""; process.stdin.on("data", c => text += c); process.stdin.on("end", () => {
  for (const pack of JSON.parse(text)) for (const file of pack.files || []) console.log(file.path);
});')

for encoded in "${patterns[@]}"; do
  pattern="$(printf '%s' "$encoded" | base64 --decode)"
  for file in "${files[@]}"; do
    target="$root/$file"
    [[ -f "$target" ]] || continue
    if grep -F -q -- "$pattern" "$target"; then
      echo "FAIL private context in $file" >&2
      exit 1
    fi
  done
done

echo "PASS no blocked private context in publishable files"

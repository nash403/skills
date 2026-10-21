#!/usr/bin/env bash
# Records that the current branch's PR or MR description was checked against its changes, which lets
# check.sh allow the next push. --description-file also updates the description on the platform.
# Usage: validate.sh [-C <repo>] (--description-file <path> | --unchanged)
set -euo pipefail

dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib.sh
source "$dir/lib.sh"

usage="usage: $(basename "$0") [-C <repo>] (--description-file <path> | --unchanged)"
fail() { echo "$(basename "$0"): $1" >&2; exit 2; }

repo=$PWD file="" unchanged=false
while (($#)); do
  case "$1" in
    -C) [[ $# -ge 2 ]] || fail "$usage"; repo=$2; shift 2 ;;
    --description-file) [[ $# -ge 2 ]] || fail "$usage"; file=$2; shift 2 ;;
    --unchanged) unchanged=true; shift ;;
    *) fail "$usage" ;;
  esac
done
[[ -n "$file" && "$unchanged" == false || -z "$file" && "$unchanged" == true ]] || fail "$usage"

branch=$(git -C "$repo" symbolic-ref --quiet --short HEAD) || fail "detached HEAD in $repo"
pr=$(pr_for_branch "$repo" "$branch") || fail "could not look up the PR or MR of $branch"
[[ -n "$pr" ]] || fail "no open PR or MR for $branch"
id=$(jq -r .id <<<"$pr")
label=$(jq -r .label <<<"$pr")
fingerprint=$(pr_fingerprint "$repo" "$(jq -r .target <<<"$pr")") || fail "could not diff $branch against its target"

if [[ -n "$file" ]]; then
  [[ -s "$file" ]] || fail "$file is missing or empty"
  pr_update_description "$repo" "$id" "$file"
  echo "Updated the description of $label."
fi

record=$(pr_fingerprint_file "$repo" "$id")
mkdir -p "$(dirname "$record")"
echo "$fingerprint" >"$record"
echo "$label description validated for the current changes; the push can be retried."

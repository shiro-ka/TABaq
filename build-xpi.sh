#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
rm -f TABaq.xpi
zip -r -FS TABaq.xpi manifest.json background.js newtab.html newtab.css newtab.js js icons -x '*.DS_Store' >/dev/null
echo "built: $PWD/TABaq.xpi"

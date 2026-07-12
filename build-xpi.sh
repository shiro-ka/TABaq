#!/usr/bin/env bash
# TABaq を about:debugging で読み込む用の .xpi に固める。
# flatpak Firefox のファイル選択ポータル問題(単一ファイルしか読めない)を回避するため、
# ディレクトリ読み込みではなく1ファイルの xpi にまとめる。
set -euo pipefail
cd "$(dirname "$0")"
rm -f TABaq.xpi
zip -r -FS TABaq.xpi \
  manifest.json background.js newtab.html newtab.css newtab.js \
  css js icons \
  -x '*.DS_Store' >/dev/null
echo "built: $PWD/TABaq.xpi"

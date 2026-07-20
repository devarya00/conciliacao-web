#!/usr/bin/env bash
# Bump de versão + tag de release. Roda da raiz do projeto (dashboard-rz-main/)
# ou de qualquer lugar (o script se localiza sozinho).
#
# Uso: scripts/release.sh <patch|minor|major|X.Y.Z>
#
# Fonte única de verdade: desktop/package.json — é a versão que vira número
# do instalador Electron, feed do electron-updater e window.desktopApp.version
# (exposto pro Angular via preload). O script sincroniza frontend/ e backend/
# pro mesmo número antes de commitar — nunca edite a versão em só um dos três
# à mão, ou frontend/backend saem defasados do que tá empacotado no desktop.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: $0 <patch|minor|major|X.Y.Z>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -n "$(git status --porcelain)" ]; then
  echo "Árvore de trabalho suja — commit ou stash antes de cortar release." >&2
  exit 1
fi

BUMP="$1"

# desktop/package.json manda na versão — bump acontece só aqui, os outros dois
# só espelham o resultado
NOVA_VERSAO=$(npm --prefix desktop version "$BUMP" --no-git-tag-version | sed 's/^v//')
echo "Nova versão: $NOVA_VERSAO"

npm --prefix frontend version "$NOVA_VERSAO" --no-git-tag-version --allow-same-version >/dev/null
npm --prefix backend version "$NOVA_VERSAO" --no-git-tag-version --allow-same-version >/dev/null

# refresca o carimbo de versão no lockfile (não mexe em node_modules)
npm --prefix desktop install --package-lock-only >/dev/null
npm --prefix frontend install --package-lock-only >/dev/null
npm --prefix backend install --package-lock-only >/dev/null

git add \
  desktop/package.json desktop/package-lock.json \
  frontend/package.json frontend/package-lock.json \
  backend/package.json backend/package-lock.json

git commit -m "chore: release v${NOVA_VERSAO}"
git tag "v${NOVA_VERSAO}"

cat <<EOF

Tag v${NOVA_VERSAO} criada localmente (commit + tag, nada foi pro remoto).
Pra disparar o release no GitHub Actions:

  git push && git push origin "v${NOVA_VERSAO}"

Isso roda .github/workflows/release.yml (windows-latest): builda o Angular,
empacota o instalador (.exe) e publica na release do GitHub.
EOF

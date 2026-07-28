#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:?Uso: ./scripts/import-public-faq.sh /caminho/para/raw_md.rar}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINATION="$PROJECT_ROOT/knowledge/public-faq"
STAGING_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/zasso-public-faq.XXXXXX")"

cleanup() {
  rm -rf "$STAGING_DIRECTORY"
}
trap cleanup EXIT

if ! command -v bsdtar >/dev/null 2>&1; then
  echo "Erro: bsdtar é necessário para ler o arquivo RAR." >&2
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Erro: arquivo não encontrado: $ARCHIVE_PATH" >&2
  exit 1
fi

mkdir -p "$DESTINATION"
if ! bsdtar -xf "$ARCHIVE_PATH" -C "$STAGING_DIRECTORY" raw_md/Sales/FAQ; then
  # Em alguns ambientes macOS, o bsdtar retorna erro de locale mesmo após
  # extrair corretamente os arquivos solicitados.
  if [[ ! -d "$STAGING_DIRECTORY/raw_md/Sales/FAQ" ]]; then
    echo "Erro: não foi possível extrair as FAQs públicas do arquivo." >&2
    exit 1
  fi
fi

imported=0
skipped=0
while IFS= read -r -d '' source_file; do
  if ! grep -qx 'status: Done' "$source_file" || ! grep -qx 'audience: Customer-facing' "$source_file"; then
    skipped=$((skipped + 1))
    continue
  fi

  destination_file="$DESTINATION/$(basename "$source_file")"
  awk '
    /^## Internal Notes[[:space:]]*$/ { exit }
    { print }
  ' "$source_file" > "$destination_file"
  imported=$((imported + 1))
done < <(find "$STAGING_DIRECTORY/raw_md/Sales/FAQ" -type f -name '*.md' -print0)

echo "Importação concluída: $imported FAQs públicas em $DESTINATION ($skipped arquivos ignorados)"

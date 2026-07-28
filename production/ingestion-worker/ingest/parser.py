"""
Parser dos arquivos FAQ-*.md.

Cada arquivo tem um frontmatter YAML (os "KVs") seguido de um corpo em Markdown
dividido em seções fixas (## Short Answer, ## Caveats, ...). Este módulo separa
as duas partes e devolve uma estrutura que o resto do pipeline consegue usar.
"""
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.DOTALL)
_SECTION_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)


@dataclass(frozen=True)
class FaqDocument:
    source_file: str          # caminho relativo (ex: FAQ-018-....md)
    faq_id: str | None
    question: str | None
    status: str | None
    audience: str | None
    evidence_level: str | None
    file_hash: str
    sections: dict[str, str]  # título da seção -> texto (sem o "## título")


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _split_sections(body: str) -> dict[str, str]:
    """Quebra o corpo em {titulo_da_secao: conteudo}, usando os headers '## ' como corte."""
    matches = list(_SECTION_RE.finditer(body))
    sections: dict[str, str] = {}
    for i, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        sections[title] = body[start:end].strip()
    return sections


def parse_faq_file(path: Path, faq_dir: Path) -> FaqDocument:
    raw = path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(raw)
    if not match:
        raise ValueError(f"{path}: sem frontmatter YAML (esperava '---' no topo).")

    frontmatter_raw, body = match.group(1), match.group(2)
    meta = yaml.safe_load(frontmatter_raw) or {}

    return FaqDocument(
        source_file=str(path.relative_to(faq_dir.parent)).replace("\\", "/"),
        faq_id=meta.get("faq_id"),
        question=meta.get("question"),
        status=meta.get("status"),
        audience=meta.get("audience"),
        evidence_level=meta.get("evidence_level"),
        file_hash=_sha256(raw),
        sections=_split_sections(body),
    )


def find_faq_files(faq_dir: Path) -> list[Path]:
    """Lista os FAQ-NNN-*.md (ignora índices e curadorias como _FAQIndex.md)."""
    return sorted(p for p in faq_dir.glob("FAQ-*.md") if p.is_file())

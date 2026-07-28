"""
Ponto de entrada da ingestão. Roda em lote, uma vez por execução:

  1. Lê todos os FAQ-*.md do diretório configurado.
  2. Para cada um: parseia frontmatter + seções, quebra em chunks.
  3. Gera embedding de cada chunk (reaproveitando o que já existe no banco se o
     texto do chunk não mudou, para não gastar chamada de API à toa).
  4. Grava tudo no Postgres.

Por padrão, o programa PERGUNTA quantos documentos processar antes de mexer em
qualquer coisa (pensado pra testar em lotes pequenos primeiro). Use --limit
para pular a pergunta (ex: automação futura).

Uso:
    python -m ingest.main                # pergunta quantos documentos processar
    python -m ingest.main --force         # idem, mas ignora o hash (reprocessa mesmo sem mudança)
    python -m ingest.main --limit 28      # não pergunta; processa só os N primeiros
    python -m ingest.main --limit 274     # não pergunta; processa todos
"""
import argparse
import logging
from pathlib import Path

from ingest import db
from ingest.chunker import build_chunks
from ingest.config import load_settings
from ingest.embeddings import embed
from ingest.parser import find_faq_files, parse_faq_file

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _ask_limit(total: int) -> int:
    """Pergunta quantos documentos processar nesta execução. Enter = todos."""
    while True:
        raw = input(f"Encontrados {total} arquivos FAQ. Quantos processar agora? (1-{total}, Enter = todos): ").strip()
        if raw == "":
            return total
        if raw.isdigit() and 1 <= int(raw) <= total:
            return int(raw)
        print(f"Valor inválido — digite um número entre 1 e {total}, ou Enter para todos.")


def run(force: bool = False, limit: int | None = None) -> None:
    settings = load_settings()
    faq_dir = Path(settings.faq_dir)
    all_files = find_faq_files(faq_dir)
    logger.info("Encontrados %d arquivos FAQ em %s.", len(all_files), faq_dir)

    if limit is None:
        limit = _ask_limit(len(all_files))
    files = all_files[:limit]
    logger.info("Vai processar %d de %d arquivos encontrados.", len(files), len(all_files))

    logger.info("Conectando ao Postgres (%s)...", settings.database_url.split("@")[-1])
    conn = db.connect(settings)
    logger.info("Conectado. Servidor de embeddings: %s (modelo=%s).", settings.ollama_base_url, settings.embedding_model)
    skipped = ingested = failed = 0

    for i, path in enumerate(files, start=1):
        logger.info("[%d/%d] Lendo %s", i, len(files), path.name)
        try:
            doc = parse_faq_file(path, faq_dir)
        except Exception as exc:
            logger.error("[%d/%d] %s: falha ao parsear (%s).", i, len(files), path.name, exc)
            failed += 1
            continue

        logger.info(
            "[%d/%d] %s: faq_id=%s status=%s evidence_level=%s",
            i, len(files), path.name, doc.faq_id, doc.status, doc.evidence_level,
        )

        if not force and db.is_document_up_to_date(conn, doc.source_file, doc.file_hash):
            logger.info("[%d/%d] %s: sem mudança e já tem chunks, pulando.", i, len(files), doc.faq_id)
            skipped += 1
            continue

        chunks = build_chunks(doc)
        logger.info(
            "[%d/%d] %s: %d chunks — seções: %s",
            i, len(files), doc.faq_id, len(chunks), ", ".join(c.section for c in chunks),
        )

        document_id = db.upsert_document(conn, doc)
        logger.info("[%d/%d] %s: documento gravado (id=%s).", i, len(files), doc.faq_id, document_id)
        existing_embeddings = db.get_existing_chunk_embeddings(conn, document_id)

        chunks_with_embeddings = []
        for chunk in chunks:
            reused = existing_embeddings.get(chunk.content_hash)
            if reused is not None:
                logger.info("[%d/%d]   [%s] reaproveitando embedding já salvo (sem mudança).", i, len(files), chunk.section)
                vector = reused
            else:
                logger.info("[%d/%d]   [%s] chamando o modelo de embedding (%s)...", i, len(files), chunk.section, settings.embedding_model)
                vector = embed(chunk.embedding_text, settings)
                logger.info("[%d/%d]   [%s] embedding recebido (%d dimensões).", i, len(files), chunk.section, len(vector))
            chunks_with_embeddings.append((chunk, vector))

        db.replace_chunks(conn, document_id, chunks_with_embeddings)
        conn.commit()
        ingested += 1
        logger.info("[%d/%d] %s: %d chunks gravados e commitados no banco.", i, len(files), doc.faq_id or path.name, len(chunks))

    conn.close()
    logger.info(
        "Concluído: %d ingerido(s), %d sem mudança (pulado), %d com erro.",
        ingested, skipped, failed,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="reprocessa mesmo sem mudança no arquivo")
    parser.add_argument("--limit", type=int, default=None, help="processa só os N primeiros arquivos, sem perguntar")
    args = parser.parse_args()
    run(force=args.force, limit=args.limit)

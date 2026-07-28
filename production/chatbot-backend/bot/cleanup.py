"""Retenção automática de conversas inativas."""

import argparse
import logging
import os
import threading

from bot import db
from bot.config import Settings, load_settings

logger = logging.getLogger(__name__)

_DEFAULT_INACTIVE_DAYS = 7
_DEFAULT_INTERVAL_HOURS = 24


def _inactive_days() -> int:
    return max(1, int(os.environ.get("CLEANUP_INACTIVE_DAYS", _DEFAULT_INACTIVE_DAYS)))


def _interval_hours() -> int:
    return max(1, int(os.environ.get("CLEANUP_INTERVAL_HOURS", _DEFAULT_INTERVAL_HOURS)))


def run_cleanup(
    dry_run: bool = False,
    settings: Settings | None = None,
) -> tuple[int, int]:
    """Arquiva e remove conversas inativas sem handoff pendente."""
    settings = settings or load_settings()
    days = _inactive_days()
    cutoff_filter = (
        "last_activity_at < now() - make_interval(days => %s) "
        "AND handoff_priority = 0"
    )

    with db.connection(settings) as conn:
        convos = conn.execute(
            f"SELECT count(*) FROM conversations WHERE {cutoff_filter}",
            (days,),
        ).fetchone()[0]
        msgs = conn.execute(
            "SELECT count(*) FROM conversation_messages WHERE chat_id IN "
            f"(SELECT chat_id FROM conversations WHERE {cutoff_filter})",
            (days,),
        ).fetchone()[0]

        if dry_run:
            logger.info(
                "[dry-run] %d conversas / %d mensagens inativas há >%dd sairiam.",
                convos,
                msgs,
                days,
            )
            return convos, msgs

        with conn.transaction():
            conn.execute(
                f"""
                INSERT INTO conversation_message_chunks_archive
                    (message_id, chunk_id, content_hash, rank, distance)
                SELECT refs.message_id, refs.chunk_id, refs.content_hash,
                       refs.rank, refs.distance
                FROM conversation_message_chunks refs
                JOIN conversation_messages m ON m.id = refs.message_id
                WHERE m.chat_id IN (
                    SELECT chat_id FROM conversations WHERE {cutoff_filter}
                )
                ON CONFLICT (message_id, rank) DO NOTHING
                """,
                (days,),
            )
            conn.execute(
                f"""
                INSERT INTO conversation_messages_archive
                    (id, chat_id, session_id, role, content, chunks_used,
                     response_meta, created_at)
                SELECT m.id, m.chat_id, m.session_id, m.role, m.content,
                       m.chunks_used, m.response_meta, m.created_at
                FROM conversation_messages m
                WHERE m.chat_id IN (
                    SELECT chat_id FROM conversations WHERE {cutoff_filter}
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (days,),
            )
            conn.execute(
                f"DELETE FROM conversations WHERE {cutoff_filter}",
                (days,),
            )

    logger.info(
        "Limpeza: %d conversas / %d mensagens arquivadas e removidas "
        "(inativas >%dd; handoffs preservados).",
        convos,
        msgs,
        days,
    )
    return convos, msgs


def scheduler_loop(stop: threading.Event, settings: Settings) -> None:
    """Executa uma limpeza após a inicialização e depois uma vez por intervalo."""
    # Pequena espera evita competir com a inicialização e aquisição de locks.
    if stop.wait(60):
        return
    interval_seconds = _interval_hours() * 60 * 60
    while not stop.is_set():
        try:
            run_cleanup(settings=settings)
        except Exception:
            logger.exception("Falha no job automático de limpeza.")
        if stop.wait(interval_seconds):
            return


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Limpeza da memória de conversa.")
    parser.add_argument("--dry-run", action="store_true", help="Só reporta; não altera.")
    args = parser.parse_args()
    try:
        run_cleanup(dry_run=args.dry_run)
    finally:
        db.close_pool()


if __name__ == "__main__":
    main()

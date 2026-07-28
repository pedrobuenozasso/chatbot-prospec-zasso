"""Bloqueio distribuído para garantir um único consumidor do Telegram."""

import logging

import psycopg

from bot.config import Settings

logger = logging.getLogger(__name__)

# Advisory locks de dois inteiros evitam depender de hash ou estado em arquivo.
# O lock pertence à sessão do Postgres e é liberado automaticamente se o processo
# morrer ou a conexão for encerrada.
_LOCK_NAMESPACE = 20260724
_LOCK_ID = 1


def acquire(settings: Settings) -> psycopg.Connection | None:
    """Mantém uma conexão aberta enquanto esta instância for a consumidora ativa."""
    conn = psycopg.connect(settings.database_url, autocommit=True, connect_timeout=5)
    acquired = conn.execute(
        "SELECT pg_try_advisory_lock(%s, %s)",
        (_LOCK_NAMESPACE, _LOCK_ID),
    ).fetchone()[0]
    if not acquired:
        conn.close()
        return None
    logger.info("Lock de instância única adquirido.")
    return conn


def release(conn: psycopg.Connection | None) -> None:
    """Libera explicitamente; fechar a conexão também liberaria o advisory lock."""
    if conn is None:
        return
    try:
        conn.execute(
            "SELECT pg_advisory_unlock(%s, %s)",
            (_LOCK_NAMESPACE, _LOCK_ID),
        )
    finally:
        conn.close()

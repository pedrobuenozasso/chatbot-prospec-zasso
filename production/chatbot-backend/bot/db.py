"""Pool compartilhado de conexões PostgreSQL."""

from contextlib import contextmanager
from threading import Lock
from typing import Iterator

import psycopg
from pgvector.psycopg import register_vector
from psycopg_pool import ConnectionPool

from bot.config import Settings

_pool: ConnectionPool | None = None
_pool_url: str | None = None
_pool_lock = Lock()


def _configure_connection(conn: psycopg.Connection) -> None:
    register_vector(conn)
    conn.commit()


def get_pool(settings: Settings) -> ConnectionPool:
    """Cria o pool uma vez por processo e o reutiliza em todo o pipeline."""
    global _pool, _pool_url
    if _pool is not None:
        if _pool_url != settings.database_url:
            raise RuntimeError("O pool já foi inicializado para outro DATABASE_URL.")
        return _pool

    with _pool_lock:
        if _pool is None:
            _pool = ConnectionPool(
                conninfo=settings.database_url,
                min_size=1,
                max_size=5,
                timeout=10,
                kwargs={"connect_timeout": 5},
                configure=_configure_connection,
                open=False,
                name="chatbot-postgres",
            )
            _pool.open(wait=True, timeout=10)
            _pool_url = settings.database_url
    return _pool


@contextmanager
def connection(settings: Settings) -> Iterator[psycopg.Connection]:
    """Empresta uma conexão pronta e a devolve ao pool ao final do bloco."""
    with get_pool(settings).connection() as conn:
        yield conn


def close_pool() -> None:
    global _pool, _pool_url
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None
            _pool_url = None

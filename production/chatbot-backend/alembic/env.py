"""
Ambiente do Alembic para o chatbot-backend.

O app usa psycopg cru (sem ORM), então o Alembic entra APENAS para versionar o
schema — as migrations são escritas à mão com `op` (sem autogenerate, por isso
`target_metadata = None`). A URL do banco vem do `.env` (mesma DATABASE_URL do
app), não do alembic.ini, pra ter uma fonte única de verdade.

As tabelas `documents`/`chunks` são do ingestion-worker (geridas pelo schema.sql
dele) e NÃO são tocadas aqui — o Alembic só cuida das tabelas de memória de
conversa deste serviço. A tabela `alembic_version` convive sem conflito.
"""
import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

load_dotenv()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# DATABASE_URL do ambiente vence o placeholder do alembic.ini (fonte única).
_database_url = os.environ.get("DATABASE_URL")
if _database_url:
    # SQLAlchemy exige o driver no esquema; psycopg3 usa postgresql+psycopg://.
    if _database_url.startswith("postgresql://"):
        _database_url = _database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif _database_url.startswith("postgres://"):
        _database_url = _database_url.replace("postgres://", "postgresql+psycopg://", 1)
    config.set_main_option("sqlalchemy.url", _database_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Sem modelos ORM — migrations são imperativas, não autogeradas.
target_metadata = None


def run_migrations_offline() -> None:
    """Gera o SQL sem conectar (alembic upgrade head --sql)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Conecta no banco e aplica as migrations."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

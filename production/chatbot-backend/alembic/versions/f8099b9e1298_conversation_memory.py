"""conversation memory

Revision ID: f8099b9e1298
Revises: 
Create Date: 2026-07-23 20:17:01.043690

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f8099b9e1298'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria as tabelas de memória de conversa do chatbot."""
    # Estado persistente por chat do Telegram: idioma sticky + marcos de sessão.
    op.create_table(
        "conversations",
        # chat_id é o id do Telegram (inserido por nós), NÃO gerado — autoincrement=False
        # impede o BIGSERIAL/sequence que o SQLAlchemy assume por padrão em PK inteira.
        sa.Column("chat_id", sa.BigInteger(), primary_key=True, autoincrement=False),
        # Idioma sticky da conversa (ISO 639-1). NULL até a 1a classificação.
        sa.Column("language", sa.Text(), nullable=True),
        # Trava a re-classificação de idioma após as 1as mensagens (ver bot/memory.py).
        sa.Column("language_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        # Última vez que o menu foi enviado — dispara o reenvio após pausa (3h).
        sa.Column("menu_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Janela rolante de mensagens. A tabela guarda tudo (é o log); a "janela" é
    # só a query das últimas N por recência. chunks_used preserva os chunks do
    # turno pro follow-up (estágio B) e pra auditoria/auto-check futuro.
    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "chat_id", sa.BigInteger(),
            sa.ForeignKey("conversations.chat_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunks_used", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('user', 'assistant')", name="conversation_messages_role_check"),
    )
    # Índice pra query da janela: últimas N mensagens de um chat por recência.
    op.create_index(
        "conversation_messages_chat_recency_idx",
        "conversation_messages",
        ["chat_id", sa.text("created_at DESC")],
    )

    # Arquivo de auditoria: o job de limpeza semanal move conversas inativas pra
    # cá antes de removê-las da tabela viva (retenção/LGPD, ver bot/cleanup.py).
    # Sem FK — sobrevive à remoção da conversa de origem.
    op.create_table(
        "conversation_messages_archive",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("chat_id", sa.BigInteger(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunks_used", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    """Remove as tabelas de memória de conversa."""
    op.drop_table("conversation_messages_archive")
    op.drop_index("conversation_messages_chat_recency_idx", table_name="conversation_messages")
    op.drop_table("conversation_messages")
    op.drop_table("conversations")

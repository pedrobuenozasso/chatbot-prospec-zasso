"""handoff priority flag

Revision ID: 446189f00df8
Revises: f8099b9e1298
Create Date: 2026-07-24 09:31:21.650728

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '446189f00df8'
down_revision: Union[str, Sequence[str], None] = 'f8099b9e1298'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Flag de handoff para humano em `conversations`. Dois gatilhos, mesma coluna
    de prioridade (nunca regride — ver bot/memory.mark_handoff):
      0 = nenhum
      1 = engajamento (3+ perguntas respondidas, cliente segue perguntando —
          sinal de lead quente, contato proativo)
      2 = pedido explícito ("quero falar com humano") — mais urgente

    `handoff_reason` guarda qual gatilho disparou por último (ajuda a explicar
    a prioridade). `handoff_requested_at` marca quando a prioridade ATUAL foi
    atingida (não a primeira vez — se subir de 1 para 2, o timestamp avança).

    Fila do Salesforce fica para depois (decisão do dono do projeto) — esta
    coluna só deixa o dado pronto para alimentar aquilo quando existir; por
    enquanto é consultável direto no banco. Segue a mesma janela de retenção
    do job de limpeza semanal (bot/cleanup.py) — sem exceção por handoff ativo,
    isso é uma limitação conhecida, não uma omissão.
    """
    op.add_column(
        "conversations",
        sa.Column("handoff_priority", sa.SmallInteger(), nullable=False, server_default="0"),
    )
    op.add_column("conversations", sa.Column("handoff_reason", sa.Text(), nullable=True))
    op.add_column(
        "conversations",
        sa.Column("handoff_requested_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "conversations_handoff_priority_check",
        "conversations",
        "handoff_priority IN (0, 1, 2)",
    )
    # Consulta futura da fila (ex.: Salesforce) vai filtrar/ordenar por isso.
    op.create_index(
        "conversations_handoff_priority_idx",
        "conversations",
        ["handoff_priority", "handoff_requested_at"],
        postgresql_where=sa.text("handoff_priority > 0"),
    )


def downgrade() -> None:
    """Remove a flag de handoff."""
    op.drop_index("conversations_handoff_priority_idx", table_name="conversations")
    op.drop_constraint("conversations_handoff_priority_check", "conversations", type_="check")
    op.drop_column("conversations", "handoff_requested_at")
    op.drop_column("conversations", "handoff_reason")
    op.drop_column("conversations", "handoff_priority")

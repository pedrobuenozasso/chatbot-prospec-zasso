"""response plan metadata

Revision ID: b61e84c7d2a9
Revises: 9f3c2b7a61de
Create Date: 2026-07-24
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b61e84c7d2a9"
down_revision: Union[str, Sequence[str], None] = "9f3c2b7a61de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conversation_messages",
        sa.Column("response_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "conversation_messages_archive",
        sa.Column("response_meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("conversation_messages_archive", "response_meta")
    op.drop_column("conversation_messages", "response_meta")

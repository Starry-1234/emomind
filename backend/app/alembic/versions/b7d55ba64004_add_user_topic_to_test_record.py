"""add_user_topic_to_test_record

Revision ID: b7d55ba64004
Revises: d501192f9ba1
Create Date: 2026-05-02 23:23:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d55ba64004'
down_revision: Union[str, None] = 'd501192f9ba1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('test_record', sa.Column('user_topic', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('test_record', 'user_topic')
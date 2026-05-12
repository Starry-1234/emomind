"""Add test_record table

Revision ID: d501192f9ba1
Revises: a1b2c3d4e5f6
Create date: 2026-05-02

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d501192f9ba1"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "test_record",
        sa.Column("test_name", sa.String(length=255), nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=True),
        sa.Column("result_description", sa.Text(), nullable=True),
        sa.Column("questions", sa.JSON(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("test_record")
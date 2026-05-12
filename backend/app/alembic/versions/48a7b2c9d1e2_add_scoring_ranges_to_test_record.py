"""Add scoring_ranges and total_max to test_record

Revision ID: 48a7b2c9d1e2
Revises: 1a31ce608336
Create Date: 2026-05-12 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


revision = "48a7b2c9d1e2"
down_revision = "b7d55ba64004"


def upgrade() -> None:
    op.add_column(
        "test_record",
        sa.Column("total_max", sa.Integer(), nullable=True),
    )
    op.add_column(
        "test_record",
        sa.Column("scoring_ranges", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("test_record", "scoring_ranges")
    op.drop_column("test_record", "total_max")

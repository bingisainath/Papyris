"""when an account was deleted (its personal data removed, shared expenses kept)

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-12 16:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('users', 'deleted_at')

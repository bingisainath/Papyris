"""e2e link history: the encrypted history file waiting for a newly linked device

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-09 19:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('e2e_devices', sa.Column('history_url', sa.String(length=500), nullable=True))


def downgrade():
    op.drop_column('e2e_devices', 'history_url')

"""delivery receipts per member, and the currency each person wants totals shown in

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-11 18:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade():
    # Time of the newest message that reached one of this member's devices (two grey ticks)
    op.add_column('conversation_members', sa.Column('last_delivered_at', sa.DateTime(timezone=True), nullable=True))
    # Show expense totals converted to this currency too (None = only the original currencies)
    op.add_column('users', sa.Column('display_currency', sa.String(3), nullable=True))


def downgrade():
    op.drop_column('users', 'display_currency')
    op.drop_column('conversation_members', 'last_delivered_at')

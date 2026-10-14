"""device link requests can be denied (one-tap approval on another device)

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-15 10:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('e2e_link_requests', sa.Column('denied_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('e2e_link_requests', 'denied_at')

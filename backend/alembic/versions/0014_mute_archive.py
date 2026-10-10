"""per-person mute (until a time) and archive for chats

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-10 20:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('conversation_members', sa.Column('muted_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('conversation_members', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('conversation_members', 'archived_at')
    op.drop_column('conversation_members', 'muted_until')

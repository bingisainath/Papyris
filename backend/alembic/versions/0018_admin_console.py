"""admin console: account suspension and the admin action log

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-13 18:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('suspended_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('suspended_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('suspension_reason', sa.String(500), nullable=True))
    op.create_table(
        'admin_actions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('admin_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(40), nullable=False),
        sa.Column('target_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reason', sa.String(500), nullable=True),
        sa.Column('details', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_admin_actions_created_at', 'admin_actions', ['created_at'])
    op.create_index('ix_admin_actions_target_user_id', 'admin_actions', ['target_user_id'])


def downgrade():
    op.drop_table('admin_actions')
    op.drop_column('users', 'suspension_reason')
    op.drop_column('users', 'suspended_until')
    op.drop_column('users', 'suspended_at')

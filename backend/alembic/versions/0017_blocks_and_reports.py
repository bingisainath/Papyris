"""blocking people and reporting abuse

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-12 18:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'user_blocks',
        sa.Column('blocker_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('blocked_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_user_blocks_blocked_id', 'user_blocks', ['blocked_id'])
    op.create_table(
        'reports',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('reporter_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reported_user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('conversation_id', UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('message_id', UUID(as_uuid=True), sa.ForeignKey('messages.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reason', sa.String(20), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('evidence', sa.Text(), nullable=True),
        sa.Column('status', sa.String(10), nullable=False, server_default='open'),
        sa.Column('resolution', sa.String(500), nullable=True),
        sa.Column('resolved_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_reports_reporter_id', 'reports', ['reporter_id'])
    op.create_index('ix_reports_reported_user_id', 'reports', ['reported_user_id'])
    op.create_index('ix_reports_status', 'reports', ['status'])


def downgrade():
    op.drop_table('reports')
    op.drop_table('user_blocks')

"""retry requests: a device that can't decrypt a message asks the sender to encrypt it again

Revision ID: 0024
Revises: 0023
Create Date: 2026-10-17 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'e2e_retry_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('messages.id', ondelete='CASCADE'), nullable=False),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requester_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requester_device_id', sa.Integer(), nullable=False),
        sa.Column('sender_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_device_id', sa.Integer(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('message_id', 'requester_user_id', 'requester_device_id', name='uq_e2e_retry_request'),
    )
    op.create_index('ix_e2e_retry_sender', 'e2e_retry_requests', ['sender_user_id', 'sender_device_id', 'created_at'])


def downgrade():
    op.drop_index('ix_e2e_retry_sender', 'e2e_retry_requests')
    op.drop_table('e2e_retry_requests')

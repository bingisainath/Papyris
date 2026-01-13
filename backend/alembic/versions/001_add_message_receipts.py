"""add message receipts table

Revision ID: 001_add_message_receipts
Revises: 
Create Date: 2026-01-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_message_receipts'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create message_receipts table
    op.create_table(
        'message_receipts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('message_id', sa.String(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='delivered'),
        sa.Column('delivered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('message_id', 'user_id', name='uq_message_user_receipt')
    )
    
    # Create indexes
    op.create_index('idx_message_receipt_message', 'message_receipts', ['message_id'])
    op.create_index('idx_message_receipt_user', 'message_receipts', ['user_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_message_receipt_user', table_name='message_receipts')
    op.drop_index('idx_message_receipt_message', table_name='message_receipts')
    
    # Drop table
    op.drop_table('message_receipts')


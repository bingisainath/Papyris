"""end-to-end encryption: link devices instead of a passphrase

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-08 09:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade():
    # Keys are no longer stored locked with a passphrase: devices pass them on directly
    op.drop_column('user_keys', 'locked_keys')
    op.create_table('key_link_requests',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('ephemeral_public', sa.String(length=64), nullable=False),
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('device_name', sa.String(length=100), nullable=False),
    sa.Column('payload', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_key_link_requests_user_id'), 'key_link_requests', ['user_id'], unique=False)
    op.create_index(op.f('ix_key_link_requests_code'), 'key_link_requests', ['code'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_key_link_requests_code'), table_name='key_link_requests')
    op.drop_index(op.f('ix_key_link_requests_user_id'), table_name='key_link_requests')
    op.drop_table('key_link_requests')
    op.add_column('user_keys', sa.Column('locked_keys', sa.Text(), nullable=True))

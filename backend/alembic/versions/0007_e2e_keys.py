"""end-to-end encryption keys, messages.has_link

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-07 09:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_keys',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('enc_public', sa.String(length=64), nullable=False),
    sa.Column('sign_public', sa.String(length=64), nullable=False),
    sa.Column('locked_keys', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('previous_user_keys',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('enc_public', sa.String(length=64), nullable=False),
    sa.Column('sign_public', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('replaced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_previous_user_keys_user_id'), 'previous_user_keys', ['user_id'], unique=False)
    op.add_column('messages', sa.Column('has_link', sa.Boolean(), server_default='false', nullable=False))


def downgrade():
    op.drop_column('messages', 'has_link')
    op.drop_index(op.f('ix_previous_user_keys_user_id'), table_name='previous_user_keys')
    op.drop_table('previous_user_keys')
    op.drop_table('user_keys')

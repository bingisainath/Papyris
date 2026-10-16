"""phones that show chat notifications themselves (decrypted on the phone)

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-16 16:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('device_tokens', sa.Column('renders_messages', sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade():
    op.drop_column('device_tokens', 'renders_messages')

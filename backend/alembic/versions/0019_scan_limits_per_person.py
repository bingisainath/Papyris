"""per-person receipt scan limits set by app admins

Revision ID: 0019
Revises: 0018
Create Date: 2026-10-14 18:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('scan_limit_override', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('extra_scans', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('extra_scans_month', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('users', 'extra_scans_month')
    op.drop_column('users', 'extra_scans')
    op.drop_column('users', 'scan_limit_override')

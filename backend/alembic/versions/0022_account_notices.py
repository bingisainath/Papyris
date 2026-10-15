"""account notices (warnings, report outcomes) and a report's outcome

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-15 20:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reports', sa.Column('outcome', sa.String(20), nullable=True))
    op.create_table(
        'account_notices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('title', sa.String(120), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('reason', sa.String(20), nullable=True),
        sa.Column('report_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('reports.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_account_notices_user_id', 'account_notices', ['user_id'])


def downgrade():
    op.drop_index('ix_account_notices_user_id', 'account_notices')
    op.drop_table('account_notices')
    op.drop_column('reports', 'outcome')

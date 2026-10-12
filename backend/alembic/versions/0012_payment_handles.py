"""payment handles on the profile (Revolut, PayPal.me, UPI) for "Pay" buttons

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-09 22:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('payment_handles', postgresql.JSONB(), nullable=True))


def downgrade():
    op.drop_column('users', 'payment_handles')

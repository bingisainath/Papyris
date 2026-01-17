# """add password reset fields

# Revision ID: a1b2c3d4e5f6
# Revises: d3190dc6b94f
# Create Date: 2024-01-16 12:00:00.000000

# """
# from alembic import op
# import sqlalchemy as sa

# # revision identifiers
# revision = 'a1b2c3d4e5f6'
# down_revision = 'd3190dc6b94f'  # ← REPLACE with YOUR (head) revision
# branch_labels = None
# depends_on = None

# def upgrade() -> None:
#     op.add_column('users', sa.Column('reset_token', sa.String(255), nullable=True))
#     op.add_column('users', sa.Column('reset_token_expires', sa.DateTime(timezone=True), nullable=True))
#     op.create_index('ix_users_reset_token', 'users', ['reset_token'], unique=False)

# def downgrade() -> None:
#     op.drop_index('ix_users_reset_token', 'users')
#     op.drop_column('users', 'reset_token_expires')
#     op.drop_column('users', 'reset_token')


"""add password reset fields

Revision ID: add_password_reset_001
Revises: d3190dc6b94f
Create Date: 2024-01-16 18:30:00.000000

INSTRUCTIONS:
1. Run `alembic history` to find your latest revision ID
2. Replace 'd3190dc6b94f' below with YOUR latest revision
3. Run `alembic upgrade head`
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'add_password_reset_002'
down_revision = 'd3190dc6b94f'  # ← REPLACE THIS with your latest revision from `alembic history`
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add reset_token column
    op.add_column('users', sa.Column('reset_token', sa.String(255), nullable=True))
    
    # Add reset_token_expires column
    op.add_column('users', sa.Column(
        'reset_token_expires', 
        sa.DateTime(timezone=True), 
        nullable=True
    ))
    
    # Create index for faster token lookups
    op.create_index('ix_users_reset_token', 'users', ['reset_token'], unique=False)

def downgrade() -> None:
    # Drop index
    op.drop_index('ix_users_reset_token', 'users')
    
    # Drop columns
    op.drop_column('users', 'reset_token_expires')
    op.drop_column('users', 'reset_token')
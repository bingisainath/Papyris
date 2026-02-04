"""Add blocking, group settings, read receipts, and search

Revision ID: add_features_v2
Revises: add_password_reset_002
Create Date: 2024-01-20

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '002_added_new_features'
down_revision = 'add_password_reset_002'


def upgrade():
    print("🚀 Starting migration...")
    
    # ====== 1. CREATE BLOCKED_USERS TABLE ======
    print("📝 Creating blocked_users table...")
    op.create_table(
        'blocked_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('blocker_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('blocked_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('blocked_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['blocker_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['blocked_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    # Unique constraint - can't block same user twice
    op.create_unique_constraint(
        'uq_blocker_blocked',
        'blocked_users',
        ['blocker_id', 'blocked_id']
    )
    
    # Indexes for performance
    op.create_index('idx_blocker_id', 'blocked_users', ['blocker_id'])
    op.create_index('idx_blocked_id', 'blocked_users', ['blocked_id'])
    
    # ====== 2. CREATE GROUP_SETTINGS TABLE ======
    print("📝 Creating group_settings table...")
    op.create_table(
        'group_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('only_admins_can_message', sa.Boolean(), server_default='false'),
        sa.Column('only_admins_can_add_members', sa.Boolean(), server_default='true'),
        sa.Column('send_message_notification', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('conversation_id', name='uq_conversation_settings')
    )
    
    # ====== 3. ENHANCE USER MODEL ======
    print("📝 Adding bio to users...")
    # Check if bio doesn't already exist
    connection = op.get_bind()
    result = connection.execute(sa.text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='bio'
    """))
    
    if not result.fetchone():
        op.add_column('users', sa.Column('bio', sa.String(500), nullable=True))
        print("   ✅ Added bio column")
    else:
        print("   ⏭️  Bio column already exists")
    
    # ====== 4. ENHANCE MESSAGES FOR SEARCH ======
    print("📝 Adding search capabilities to messages...")
    
    # Add search_vector column for full-text search
    op.add_column('messages',
        sa.Column('search_vector', postgresql.TSVECTOR, nullable=True)
    )
    
    # Create GIN index for full-text search
    op.execute("""
        CREATE INDEX idx_messages_search 
        ON messages USING GIN(search_vector)
    """)
    
    # Create trigger to auto-update search_vector
    op.execute("""
        CREATE OR REPLACE FUNCTION messages_search_trigger() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english', COALESCE(NEW.text, ''));
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql;
    """)
    
    op.execute("""
        CREATE TRIGGER messages_search_update
        BEFORE INSERT OR UPDATE ON messages
        FOR EACH ROW
        EXECUTE FUNCTION messages_search_trigger();
    """)
    
    # Update existing messages
    op.execute("""
        UPDATE messages 
        SET search_vector = to_tsvector('english', COALESCE(text, ''))
    """)
    
    print("✅ Migration completed successfully!")
    print("\nNew features available:")
    print("  - 🚫 Block/Unblock users")
    print("  - 👥 Group settings & admin controls")
    print("  - 🔍 Full-text message search")
    print("  - ✓✓ Read receipts (using existing message_receipts table)")


def downgrade():
    print("⏪ Rolling back migration...")
    
    # Drop search trigger and function
    op.execute("DROP TRIGGER IF EXISTS messages_search_update ON messages")
    op.execute("DROP FUNCTION IF EXISTS messages_search_trigger()")
    op.execute("DROP INDEX IF EXISTS idx_messages_search")
    op.drop_column('messages', 'search_vector')
    
    # Drop bio from users
    op.drop_column('users', 'bio')
    
    # Drop group_settings table
    op.drop_table('group_settings')
    
    # Drop blocked_users table
    op.drop_index('idx_blocked_id', 'blocked_users')
    op.drop_index('idx_blocker_id', 'blocked_users')
    op.drop_constraint('uq_blocker_blocked', 'blocked_users', type_='unique')
    op.drop_table('blocked_users')
    
    print("✅ Rollback completed!")
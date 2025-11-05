from sqlalchemy import create_engine, text

# Database setup
DATABASE_URL = "sqlite:///online_file_system.db"
engine = create_engine(DATABASE_URL, echo=True)
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except Exception:
        pass

queries = [

    # Users table
    """
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(50) NOT NULL UNIQUE,
        profile VARCHAR(100) NOT NULL,
        created_at DATE,
        storage INTEGER
    )
    """,

    # Folders table
    """
    CREATE TABLE IF NOT EXISTS folders (
        folder_id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_name VARCHAR(100) NOT NULL,
        parent_id INTEGER,
        user_id INTEGER,
        created_at DATE,
        updated_at DATE,
        FOREIGN KEY (parent_id) REFERENCES folders(folder_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
    """,

    # Files table
    """
    CREATE TABLE IF NOT EXISTS files (
        file_id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name VARCHAR(100) NOT NULL,
        parent_id INTEGER,
        file_path VARCHAR(100),
        user_id INTEGER,
        created_at DATE,
        updated_at DATE,
        file_size INTEGER,
        status VARCHAR(20) CHECK(status IN ('deleted', 'not_deleted')),
        FOREIGN KEY (parent_id) REFERENCES folders(folder_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
    """,

    # Shares table
    """
    CREATE TABLE IF NOT EXISTS shares (
        share_id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER DEFAULT NULL,
        file_id INTEGER DEFAULT NULL,
        token VARCHAR(100) NOT NULL UNIQUE,
        permission VARCHAR(10) CHECK(permission IN ('view', 'edit')) NOT NULL,
        created_at DATE,
        updated_at DATE,
        is_public BOOLEAN DEFAULT 0,
        FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(folder_id) ON DELETE CASCADE
    )
    """,
    # Share access table
    '''
    CREATE TABLE IF NOT EXISTS share_access(
        share_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (share_id) REFERENCES shares(share_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        PRIMARY KEY (share_id, user_id)
    )
    ''',
    # Activity logs table
    """
    CREATE TABLE IF NOT EXISTS activity_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        resource_type VARCHAR(50),
        resource_id INTEGER,
        details TEXT,
        ip_address VARCHAR(45),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
    """,

    """
    CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_files_parent_id ON files(parent_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_shares_file_id ON shares(file_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_shares_folder_id ON shares(folder_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id_created_at ON activity_logs(user_id, created_at)
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_share_access_user_id ON share_access(user_id)
    """,
]

def create_tables():
    conn = engine.connect()
    for q in queries:
        conn.execute(text(q))
    conn.commit()
    conn.close()

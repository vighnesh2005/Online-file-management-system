from sqlalchemy import create_engine, text

# Database setup (SQLite for example)
DATABASE_URL = "sqlite:///online_file_system.db"
engine = create_engine(DATABASE_URL, echo=True)

# Raw SQL queries for tables
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
        FOREIGN KEY (parent_id) REFERENCES folders(folder_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
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
        FOREIGN KEY (parent_id) REFERENCES folders(folder_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
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
        FOREIGN KEY (file_id) REFERENCES files(file_id),
        FOREIGN KEY (folder_id) REFERENCES folders(folder_id)
    )
    """,
    '''
    CREATE TABLE IF NOT EXISTS share_access(
        share_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        FOREIGN KEY (share_id) REFERENCES shares(share_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id),
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
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    """
]

def create_tables():
    conn = engine.connect()
    for q in queries:
        conn.execute(text(q))
    conn.commit()
    conn.close()

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
        password VARCHAR(50) NOT NULL,
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
        user_id INTEGER,
        created_at DATE,
        updated_at DATE,
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
        user_id INTEGER DEFAULT NULL,
        token VARCHAR(100) NOT NULL UNIQUE,
        permission VARCHAR(10) CHECK(permission IN ('view', 'edit')) NOT NULL,
        created_at DATE,
        updated_at DATE,
        FOREIGN KEY (file_id) REFERENCES files(file_id),
        FOREIGN KEY (folder_id) REFERENCES folders(folder_id)
    )
    """,

    # Recyclebin table
    """
    CREATE TABLE IF NOT EXISTS recyclebin (
        file_id INTEGER,
        added_on DATE,
        updated_on DATE,
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        FOREIGN KEY (file_id) REFERENCES files(file_id)
    )
    """,

    # Logs table
    """
    CREATE TABLE IF NOT EXISTS logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action VARCHAR(30),
        file_id INTEGER,
        folder_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (file_id) REFERENCES files(file_id),
        FOREIGN KEY (folder_id) REFERENCES folders(folder_id)
    )
    """
]

def create_tables():
    conn = engine.connect()
    for q in queries:
        conn.execute(text(q))
    conn.commit()
    conn.close()

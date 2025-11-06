from datetime import datetime, timedelta
from sqlalchemy import text

A_UPLOAD = "UPLOAD"
A_DOWNLOAD = "DOWNLOAD"
A_DELETE = "DELETE"
A_RENAME = "RENAME"
A_REPLACE = "REPLACE"
A_CREATE_FOLDER = "CREATE_FOLDER"
A_DELETE_FOLDER = "DELETE_FOLDER"
A_DOWNLOAD_FOLDER = "DOWNLOAD_FOLDER"


def _ext_from_name(name: str) -> str:
    if not name:
        return None
    if "." not in name:
        return None
    try:
        ext = name.rsplit(".", 1)[-1].lower()
        return ext or None
    except Exception:
        return None


def log_user_activity(db, user_id: int, file_id: int | None, action: str, file_type: str | None = None):
    try:
        db.execute(text(
            """
            INSERT INTO user_activity (user_id, file_id, action, file_type, timestamp)
            VALUES (:user_id, :file_id, :action, :file_type, :ts)
            """
        ), {
            "user_id": user_id,
            "file_id": file_id,
            "action": action,
            "file_type": file_type,
            "ts": datetime.now()
        })
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def generate_suggestions(db, user_id: int):
    suggestions = []
    try:
        ten_min_ago = datetime.now() - timedelta(minutes=10)
        rows = db.execute(text(
            """
            SELECT file_type, COUNT(*) as cnt
            FROM user_activity
            WHERE user_id = :uid
              AND action = :act
              AND timestamp >= :tmin
              AND file_type IS NOT NULL
            GROUP BY file_type
            HAVING COUNT(*) >= 3
            """
        ), {"uid": user_id, "act": A_UPLOAD, "tmin": ten_min_ago}).fetchall()
        for r in rows:
            file_type = r[0]
            key = f"group_type_{file_type}"
            dismissed = db.execute(text(
                "SELECT 1 FROM user_suggestions WHERE user_id = :uid AND suggestion_key = :k"
            ), {"uid": user_id, "k": key}).fetchone()
            if dismissed:
                continue
            msg = f"You’ve uploaded {r[1]} {file_type.upper()} files in the last 10 minutes — group them into a folder?"
            suggestions.append({
                "message": msg,
                "action": "CREATE_FOLDER",
                "suggestion_key": key,
                "file_type": file_type,
            })
    except Exception:
        pass

    try:
        rows = db.execute(text(
            """
            SELECT file_id, COUNT(*) AS cnt
            FROM user_activity
            WHERE user_id = :uid AND action = :act AND date(timestamp) = date('now') AND file_id IS NOT NULL
            GROUP BY file_id
            HAVING COUNT(*) >= 3
            """
        ), {"uid": user_id, "act": A_DOWNLOAD}).fetchall()
        for r in rows:
            fid = int(r[0])
            key = f"repeat_download_file_{fid}"
            dismissed = db.execute(text(
                "SELECT 1 FROM user_suggestions WHERE user_id = :uid AND suggestion_key = :k"
            ), {"uid": user_id, "k": key}).fetchone()
            if dismissed:
                continue
            name_row = db.execute(text("SELECT file_name FROM files WHERE file_id = :fid"), {"fid": fid}).fetchone()
            fname = name_row[0] if name_row else f"ID {fid}"
            msg = f"You downloaded '{fname}' multiple times today — mark as Important?"
            suggestions.append({
                "message": msg,
                "action": "MARK_IMPORTANT",
                "suggestion_key": key,
                "file_id": fid,
            })
    except Exception:
        pass

    return suggestions

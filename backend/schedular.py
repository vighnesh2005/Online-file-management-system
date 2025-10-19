from datetime import datetime, timedelta
from sqlalchemy import text
from utils import get_db
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
import os
import atexit

RETENTION_MINUTES = int(os.getenv("RECYCLE_RETENTION_MINUTES", "0"))
RETENTION_DAYS = int(os.getenv("RECYCLE_RETENTION_DAYS", "30"))

_scheduler = None

def delete_old_recycle_bin_files():
    print(f"🧹 Running recycle bin cleanup at {datetime.now()}")

    db_gen = get_db()
    db = next(db_gen)

    try:
        if RETENTION_MINUTES > 0:
            threshold = datetime.now() - timedelta(minutes=RETENTION_MINUTES)
        else:
            threshold = datetime.now() - timedelta(days=RETENTION_DAYS)

        old_files = db.execute(text('''
            SELECT file_id, file_path, file_size, user_id
            FROM files
            WHERE status = 'deleted'
              AND updated_at < :threshold
        '''), {"threshold": threshold}).fetchall()

        print(f"DEBUG: Found {len(old_files)} files to delete (older than {RETENTION_DAYS}d).")

        for f in old_files:
            file = dict(f._mapping)
            file_path = Path(file["file_path"]).absolute()

            # Delete file from disk if it exists
            if file_path.exists():
                try:
                    file_path.unlink()
                    print(f"Deleted file: {file_path}")
                except Exception as e:
                    print(f"Could not delete {file_path}: {e}")
            else:
                print(f"File missing on disk: {file_path}")

            db.execute(text('''
                UPDATE users
                SET storage = MAX(storage - :size, 0)
                WHERE user_id = :user_id
            '''), {"size": file["file_size"], "user_id": file["user_id"]})

            db.execute(text('DELETE FROM files WHERE file_id = :file_id'),
                       {"file_id": file["file_id"]})

        db.commit()
        if old_files:
            print(f"Cleanup completed. Removed {len(old_files)} files.")
        else:
            print("Cleanup completed. No files to remove.")

    except Exception as e:
        db.rollback()
        print(f"Cleanup failed: {e}")

    finally:
        db.close()
        try:
            next(db_gen)
        except StopIteration:
            pass


def start_cleanup_scheduler():
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    _scheduler = BackgroundScheduler()
    if os.getenv('RECYCLE_CLEAN_EVERY_MINUTE', '0') == '1':
        _scheduler.add_job(delete_old_recycle_bin_files, 'interval', minutes=1)
    else:
        hour = int(os.getenv('RECYCLE_CLEAN_HOUR', '2'))
        minute = int(os.getenv('RECYCLE_CLEAN_MINUTE', '30'))
        _scheduler.add_job(delete_old_recycle_bin_files, 'cron', hour=hour, minute=minute)
    _scheduler.start()
    print("Recycle bin cleanup scheduler started.")

    atexit.register(stop_cleanup_scheduler)
    return _scheduler


def stop_cleanup_scheduler():
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
            print("Recycle bin cleanup scheduler stopped.")
        finally:
            _scheduler = None

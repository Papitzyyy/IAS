r"""
init_db.py — create all tables from current models.

Also installs a PostgreSQL trigger on the audit_logs table to make it
truly append-only (blocks UPDATE and DELETE at the database level).

Usage (from backend/):
    venv/Scripts/python scripts/init_db.py
"""

import sys
import os

# Add the backend directory to the python path so it can find the app module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from app.db.database import engine
from app.db.models import Base  # noqa: F401 — registers all models
from app.core.config import settings

# PostgreSQL trigger SQL to make audit_logs append-only
_PG_TRIGGER = """
DO $$
BEGIN
    -- Create the trigger function if it doesn't exist
    CREATE OR REPLACE FUNCTION protect_audit_logs()
    RETURNS TRIGGER AS $fn$
    BEGIN
        RAISE EXCEPTION 'Audit logs are immutable — UPDATE and DELETE are blocked.';
        RETURN NULL;
    END;
    $fn$ LANGUAGE plpgsql;

    -- Drop and recreate the trigger
    DROP TRIGGER IF EXISTS trg_protect_audit_logs ON audit_logs;
    CREATE TRIGGER trg_protect_audit_logs
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION protect_audit_logs();
END $$;
"""

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Database tables created (or already exist).")

    # Install the append-only trigger for PostgreSQL
    if not settings.DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            conn.execute(text(_PG_TRIGGER))
            conn.commit()
        print("PostgreSQL audit_logs immutability trigger installed.")
    else:
        print("SQLite detected — skipping PostgreSQL trigger.")

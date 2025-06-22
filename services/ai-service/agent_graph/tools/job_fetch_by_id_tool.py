from langchain_core.tools import tool
import psycopg2, os

@tool
def fetch_all_user_profiles() -> dict:
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "main"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "password"),
        port=os.getenv("DB_PORT", "5432"),
    )
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, preferred_roles, education_level, experience_level FROM devconnect.users")
        users = cur.fetchall()
    conn.close()
    profiles = [{"id": u[0], "name": u[1], "roles": u[2], "edu": u[3], "exp": u[4]} for u in users]
    return {"user_profiles": profiles}

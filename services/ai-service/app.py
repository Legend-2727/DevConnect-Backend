
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess, json
from typing import List, Dict, Any
import traceback


from agent_graph.shortlist_graph import shortlist_graph
from agent_graph.job_graph import cv_graph
from langchain_core.messages import (
    HumanMessage, AIMessage, SystemMessage, ToolMessage, FunctionMessage
)


import psycopg2
import os





app = FastAPI()

# ─────────────────────────────── CV ENDPOINTS ────────────────────────────────
class RecommendRequest(BaseModel):
    user_id: str
    cv_path: str

class ImproveRequest(BaseModel):
    user_id: str
    cv_path: str
    role:    str          

class ShortlistReq(BaseModel):
    job_id: int  



def fetch_job_details(job_id: int):
    """Fetch job details and applicants from database"""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        database=os.getenv("DB_NAME", "main"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "password"),
        port=os.getenv("DB_PORT", "5432"),
    )
    
    try:
        with conn.cursor() as cur:
            # Fetch job details
            cur.execute("""
                SELECT title, description, skills 
                FROM devconnect.jobs 
                WHERE id = %s AND is_active = TRUE
            """, [job_id])  
            job_result = cur.fetchone()
            if not job_result:
                raise Exception(f"Job {job_id} not found or inactive")

            job_title, job_desc, job_skills = job_result

            # Fetch applicants
            cur.execute("""
                SELECT u.id, u.name, u.cv_url 
                FROM devconnect.applications a
                JOIN devconnect.users u ON a.user_id = u.id
                WHERE a.job_id = %s AND u.cv_url IS NOT NULL
            """, [job_id])

            applicants_result = cur.fetchall()
            applicants = [
                    {
                            "user_id": row[0],
                            "user_name": row[1],
                            "cv_path": row[2].replace('/files/', './uploads/') if row[2] else None
                    }
                    for row in applicants_result if row[2]  
            ]       
            return {
                    "job_title": job_title,
                    "job_desc": job_desc,
                    "job_skills": job_skills or [],
                    "applicants": applicants
                }
    finally:
        conn.close()

@app.post("/improve")
async def improve_cv(data: ImproveRequest):
    try:
        result = subprocess.run(
            ["python3", "agent_graph/graph_runner_improve.py",
             data.user_id, data.cv_path, data.role],
            capture_output=True, text=True, check=True
        )
        return json.loads(result.stdout)

    except subprocess.CalledProcessError as e:
        raise HTTPException(500, f"Subprocess error: {e.stderr}")

    except json.JSONDecodeError:
        raise HTTPException(500, "Invalid JSON from graph_runner_improve.py")

@app.post("/recommend")
async def recommend_jobs(data: RecommendRequest):
    try:
        print("Received recommend request:", data.dict())
        result = cv_graph.invoke({
            "messages": [
                HumanMessage(content=f"Process CV at {data.cv_path} and recommend jobs for user {data.user_id}")
            ],
            "cv_path": data.cv_path
        })
        print("Recommend graph result:", result)
        return result  # or serialize(result) if needed

    except Exception as e:
        print("Exception in /recommend:", e)
        traceback.print_exc()
        raise HTTPException(500, f"Job recommendation failed: {str(e)}")



def serialize(obj):
    if isinstance(obj, (HumanMessage, AIMessage, SystemMessage, ToolMessage, FunctionMessage)):
        return {
            "type": obj.__class__.__name__,
            "content": getattr(obj, "content", None),
            "tool_call_id": getattr(obj, "tool_call_id", None),
            "name": getattr(obj, "name", None)
        }
    elif isinstance(obj, list):
        return [serialize(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    else:
        return obj




@app.post("/shortlist")
async def shortlist(req: ShortlistReq):
    """
    Simplified payload - just pass job_id:
    {
      "job_id": 1
    }
    """
    try:
        print(f"Received shortlist request for job_id: {req.job_id}")
        
        # Fetch all job details from database
        job_data = fetch_job_details(req.job_id)
        
        print(f"Fetched job: {job_data['job_title']} with {len(job_data['applicants'])} applicants")
        
        if len(job_data['applicants']) == 0:
            return {
                "job_id": req.job_id,
                "job_title": job_data["job_title"],
                "error": "No applicants with CVs found",
                "total_applicants": 0,
                "shortlisted_count": 0,
                "shortlist": [],
                "email_sent": False
            }
        result = shortlist_graph.invoke({
            "messages": [
                HumanMessage(content="Extract CVs, shortlist candidates, and send email notification.")
            ],
            "job_desc": job_data["job_desc"],
            "job_skills": job_data["job_skills"],
            "job_id": req.job_id,
            "job_title": job_data["job_title"],
            "applicants": job_data["applicants"]
        })
        
        print("Shortlist graph result:", result)
        
        return {
            "job_id": req.job_id,
            "job_title": job_data["job_title"],
            "total_applicants": len(job_data["applicants"]),
            "shortlist": serialize(result.get("shortlist", [])),
            "shortlisted_count": len(result.get("shortlist", [])),
            "email_sent": result.get("email_sent", False)
        }
    
    except Exception as e:
        print("Exception in /shortlist:", e)
        traceback.print_exc()
        raise HTTPException(500, f"Short-listing failed: {str(e)}")
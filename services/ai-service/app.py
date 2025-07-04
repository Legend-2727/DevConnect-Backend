
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

from agent_graph.interview_scheduling_graph import interview_scheduling_graph 


import psycopg2
import os
from apscheduler.schedulers.background import BackgroundScheduler  
from apscheduler.triggers.interval import IntervalTrigger  
import atexit

scheduler = BackgroundScheduler()
def get_jobs_awaiting_interview_scheduling() -> List[int]:
    """Get jobs that have sent shortlist emails but haven't scheduled interviews yet"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "db"),
            database=os.getenv("DB_NAME", "main"), 
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", "password"),
            port=os.getenv("DB_PORT", "5432"),
        )
        
        with conn.cursor() as cur:
            from datetime import datetime, timedelta
            
            
            cur.execute("""
                SELECT DISTINCT se.job_id
                FROM devconnect.sent_emails se
                WHERE se.subject LIKE %s
                AND se.sent_at >= %s
                AND se.job_id IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM devconnect.interviews i 
                    WHERE i.job_id = se.job_id
                    AND i.status = 'SCHEDULED'
                )
                ORDER BY se.job_id
            """, [
                '%Shortlisted Candidates%',
                datetime.now() - timedelta(days=7)
            ])
            
            rows = cur.fetchall()
            job_ids = [row[0] for row in rows] if rows else []
            print(f" Found {len(job_ids)} jobs awaiting interview scheduling: {job_ids}")
            return job_ids
            
    except Exception as e:
        print(f" Error fetching pending jobs: {e}")
        import traceback
        traceback.print_exc()
        return []
    finally:
        if 'conn' in locals():
            conn.close()


def get_shortlisted_candidates(job_id: int) -> List[dict]:
    """Fetch shortlisted candidates for a job from database"""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        database=os.getenv("DB_NAME", "main"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "password"),
        port=os.getenv("DB_PORT", "5432"),
    )
    
    try:
        with conn.cursor() as cur:
            
            cur.execute("""
                SELECT u.id, u.name, acc.email
                FROM devconnect.applications a
                JOIN devconnect.users u ON a.user_id = u.id
                JOIN devconnect.accounts acc ON u.account_id = acc.id
                WHERE a.job_id = %s AND a.status = 'SHORTLISTED'
            """, [job_id])
            
            results = cur.fetchall()
            candidates = [
                {
                    "user_id": row[0],
                    "user_name": row[1],
                    "user_email": row[2],  
                    "score": 85  
                }
                for row in results
            ]
            
            print(f"Fetched {len(candidates)} shortlisted candidates for job {job_id}")
            return candidates
            
    except Exception as e:
        print(f"Error fetching shortlisted candidates: {e}")
        return []
    finally:
        conn.close()



def create_scheduled_interview(job_id: int, candidate_user_id: int, interview_datetime: str, interviewer_id: int = None) -> bool:
    """Create interview record in database"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "db"),
            database=os.getenv("DB_NAME", "main"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", "password"),
            port=os.getenv("DB_PORT", "5432"),
        )
        
        with conn.cursor() as cur:
            
            from datetime import datetime
            
            try:
                
                if "AM" in interview_datetime or "PM" in interview_datetime:
                    
                    time_part = interview_datetime.split(" - ")[0] if " - " in interview_datetime else interview_datetime
                    dt = datetime.strptime(time_part, "%Y-%m-%d %I:%M %p")
                else:
                    dt = datetime.strptime(interview_datetime, "%Y-%m-%d %H:%M")
                
                scheduled_date = dt.date()
                scheduled_time = dt.time()
                
            except ValueError:
                # Fallback: try to parse just the date and assume 10:00 AM
                try:
                    if "june" in interview_datetime.lower():
                        
                        import re
                        date_match = re.search(r'(\d+).*?june', interview_datetime.lower())
                        time_match = re.search(r'(\d+)\s*(am|pm)', interview_datetime.lower())
                        
                        if date_match and time_match:
                            day = int(date_match.group(1))
                            hour = int(time_match.group(1))
                            period = time_match.group(2)
                            
                            if period == 'pm' and hour != 12:
                                hour += 12
                            elif period == 'am' and hour == 12:
                                hour = 0
                            
                            scheduled_date = datetime(2025, 6, day).date()
                            scheduled_time = datetime(2025, 6, day, hour, 0).time()
                        else:
                            raise ValueError("Could not parse date/time")
                    else:
                        raise ValueError("Unsupported date format")
                        
                except:
                    # Ultimate fallback
                    from datetime import timedelta
                    tomorrow = datetime.now() + timedelta(days=1)
                    scheduled_date = tomorrow.date()
                    scheduled_time = datetime.strptime("10:00", "%H:%M").time()
                    print(f"⚠️  Could not parse '{interview_datetime}', using fallback: {scheduled_date} {scheduled_time}")
            
            
            if not interviewer_id:
                # Try to find default interviewer or create one
                cur.execute("""
                    SELECT id FROM devconnect.interviewers 
                    WHERE email = %s OR name = %s
                    LIMIT 1
                """, ['hr@company.com', 'Default HR'])
                
                interviewer_result = cur.fetchone()
                if interviewer_result:
                    interviewer_id = interviewer_result[0]
                else:
                    
                    cur.execute("""
                        INSERT INTO devconnect.interviewers (name, email) 
                        VALUES (%s, %s) RETURNING id
                    """, ['Default HR', 'hr@company.com'])
                    interviewer_id = cur.fetchone()[0]
                    print(f" Created default interviewer with ID: {interviewer_id}")
            
            
            cur.execute("""
                INSERT INTO devconnect.interviews (
                    job_id, candidate_user_id, interviewer_id,
                    scheduled_date, scheduled_time, duration_minutes,
                    meeting_link, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, [
                job_id, 
                candidate_user_id,  
                interviewer_id,
                scheduled_date,     
                scheduled_time,     
                60,                 
                f"https://meet.google.com/abc-{job_id}-{candidate_user_id}",  # Generate meeting link
                'SCHEDULED'
            ])
            
            conn.commit()
            print(f" Created interview record: Job {job_id}, Candidate {candidate_user_id}, Date {scheduled_date}, Time {scheduled_time}")
            return True
            
    except Exception as e:
        print(f" Error creating interview record: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if 'conn' in locals():
            conn.close()

def background_interview_monitoring():
    """Background function that runs every 2 minutes"""
    try:
        print(" Running automated interview monitoring...")
        
        
        pending_jobs = get_jobs_awaiting_interview_scheduling()
        
        if not pending_jobs:
            print("ℹ No jobs awaiting interview scheduling")
            return
        
        print(f" Found {len(pending_jobs)} pending jobs: {pending_jobs}")
        
        results = []
        for job_id in pending_jobs:
            try:
                print(f"Checking job {job_id} for interview scheduling...")
                
                
                shortlisted = get_shortlisted_candidates(job_id)
                
                if not shortlisted:
                    print(f"  No shortlisted candidates found for job {job_id}")
                    continue
                
                
                result = interview_scheduling_graph.invoke({
                    "messages": [HumanMessage(content="Automated interview monitoring")],
                    "job_id": job_id,
                    "shortlisted_candidates": shortlisted
                })
                
                interviews_scheduled = len(result.get("scheduled_interviews", []))
                
                
                if interviews_scheduled > 0:
                    print(f" Creating {interviews_scheduled} interview records in database...")
                    
                    # for interview in result.get("scheduled_interviews", []):
                        
                    #     create_scheduled_interview(
                    #         job_id=job_id,
                    #         candidate_user_id=interview.get("candidate_id"),  
                    #         interview_datetime=interview.get("datetime"),
                    #         interviewer_id=interview.get("interviewer_id")  
                    #     )
                    
                    # print(f" Successfully scheduled {interviews_scheduled} interviews for job {job_id}")
                    # results.append({
                    #     "job_id": job_id,
                    #     "interviews_scheduled": interviews_scheduled,
                    #     "status": "success"
                    # })
                    
                    
                else:
                    print(f"⏳ No interviewer replies yet for job {job_id}")
                
            except Exception as e:
                print(f" Error processing job {job_id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        if results:
            print(f" Automated monitoring completed: {len(results)} jobs processed")
        else:
            print(" No new interviews scheduled in this cycle")
            
    except Exception as e:
        print(f" Background monitoring error: {e}")
        import traceback
        traceback.print_exc()



def init_scheduler():
    """Initialize scheduler when module loads"""
    try:
        print(" Initializing scheduler at module level...")
        
        scheduler.add_job(
            func=background_interview_monitoring,
            trigger=IntervalTrigger(minutes=2),
            id='interview_monitoring',
            name='Automated Interview Monitoring',
            replace_existing=True
        )
        
        scheduler.start()
        print(" Scheduler started at module level - will check every 2 minutes")
        
        
        print(" Running initial background check...")
        background_interview_monitoring()
        
    except Exception as e:
        print(f" Module scheduler error: {e}")
        import traceback
        traceback.print_exc()


init_scheduler()


app = FastAPI()



@app.on_event("shutdown")
async def shutdown_event():
    """Stop the scheduler when FastAPI shuts down"""
    try:
        if scheduler.running:
            print(" Stopping automated interview monitoring scheduler...")
            scheduler.shutdown(wait=False)
        else:
            print("ℹ  Scheduler was not running")
    except Exception as e:
        print(f"Error shutting down scheduler: {e}")


def cleanup_scheduler():
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception:
        pass  

atexit.register(cleanup_scheduler)









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

class ScheduleInterviewsReq(BaseModel):  
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
    



@app.post("/schedule-interviews")
async def schedule_interviews_for_job(req: ScheduleInterviewsReq):
    """
    Check for interviewer replies and automatically schedule interviews.
    
    This can be called:
    1. Manually by HR
    2. Automatically via cron job every 30 minutes
    3. Triggered by webhook when emails are received
    """
    try:
        print(f"Checking interview scheduling for job {req.job_id}")
        
        # Get shortlisted candidates for this job
        shortlisted = get_shortlisted_candidates(req.job_id)
        
        if not shortlisted:
            return {
                "job_id": req.job_id,
                "message": "No shortlisted candidates found",
                "interviewer_replies_found": 0,
                "interviews_scheduled": 0,
                "calendar_invites_sent": False,
                "scheduled_interviews": []
            }
        
        print(f"Found {len(shortlisted)} shortlisted candidates")
        
        result = interview_scheduling_graph.invoke({
            "messages": [HumanMessage(content="Monitor and schedule interviews")],
            "job_id": req.job_id,
            "shortlisted_candidates": shortlisted
        })
        
        print("Interview scheduling result:", result)
        
        return {
            "job_id": req.job_id,
            "interviewer_replies_found": len(result.get("interviewer_replies", [])),
            "interviews_scheduled": len(result.get("scheduled_interviews", [])),
            "calendar_invites_sent": result.get("calendar_invites_sent", False),
            "scheduled_interviews": serialize(result.get("scheduled_interviews", []))
        }
        
    except Exception as e:
        print("Exception in /schedule-interviews:", e)
        traceback.print_exc()
        raise HTTPException(500, f"Interview scheduling failed: {str(e)}")

@app.post("/monitor-all-interviews")
async def monitor_all_pending_interviews():
    """
    Check all jobs with recent shortlists for interviewer replies.
    Used for automated background monitoring.
    """
    try:
        print("Monitoring all pending interviews...")
        
        # Get all jobs that sent shortlist emails in last 7 days
        pending_jobs = get_jobs_awaiting_interview_scheduling()
        
        print(f"Found {len(pending_jobs)} jobs awaiting interview scheduling")
        
        results = []
        for job_id in pending_jobs:
            try:
                print(f"Processing job {job_id}")
                result = await schedule_interviews_for_job(ScheduleInterviewsReq(job_id=job_id))
                results.append(result)
            except Exception as e:
                print(f"Failed to process job {job_id}: {e}")
                results.append({
                    "job_id": job_id,
                    "error": str(e),
                    "interviews_scheduled": 0
                })
                continue
        
        total_scheduled = sum(r.get("interviews_scheduled", 0) for r in results)
        
        return {
            "processed_jobs": len(results),
            "total_interviews_scheduled": total_scheduled,
            "results": results
        }
        
    except Exception as e:
        print("Exception in /monitor-all-interviews:", e)
        traceback.print_exc()
        raise HTTPException(500, f"Interview monitoring failed: {str(e)}")






@app.get("/")
async def root():
    return {"message": "DevConnect AI Service is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-service"}







"""
Optimal interview scheduling tool
"""
from langchain_core.tools import tool
from datetime import datetime, timedelta
import uuid
import os
import psycopg2

def get_job_title(job_id: int) -> str:
    """Get job title from database"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "db"),
            database=os.getenv("DB_NAME", "main"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", "password"),
            port=os.getenv("DB_PORT", "5432"),
        )
        
        with conn.cursor() as cur:
            cur.execute("SELECT title FROM devconnect.jobs WHERE id = %s", [job_id])
            result = cur.fetchone()
            return result[0] if result else "Software Engineer"
            
    except Exception as e:
        print(f"Error fetching job title: {e}")
        return "Software Engineer"
    finally:
        if 'conn' in locals():
            conn.close()

@tool
def schedule_interviews_optimally(
    candidates: str, 
    available_slots: str, 
    job_id: int = None,  
    interview_duration_minutes: int = 60
) -> dict:
    """
    Automatically schedule interviews for shortlisted candidates.
    
    Args:
        candidates: JSON string of candidates with scores
        available_slots: JSON string of available time slots
        job_id: Job ID to get job title
        interview_duration_minutes: Duration per interview
    
    Returns:
        dict: {
            "scheduled_interviews": [
                {
                    "candidate_id": 1,
                    "candidate_name": "Alice Ahmed",
                    "candidate_email": "alice@email.com", 
                    "job_title": "Frontend Developer",
                    "interview_date": "2025-06-24",
                    "interview_time": "2:00 PM - 3:00 PM",
                    "meeting_link": "https://meet.google.com/abc-def-ghi",
                    "interviewer_email": "sarah.malik@acme.com"
                }
            ]
        }
    """
    try:
        import json
        
        
        job_title = get_job_title(job_id) if job_id else "Software Engineer"
        print(f" Scheduling interviews for {job_title} position (Job ID: {job_id})")
        
        # Parse inputs
        if isinstance(candidates, str):
            candidates_list = json.loads(candidates)
        else:
            candidates_list = candidates
            
        if isinstance(available_slots, str):
            slots_list = json.loads(available_slots)
        else:
            slots_list = available_slots
        
        # Sort candidates by score (highest first)
        sorted_candidates = sorted(
            candidates_list, 
            key=lambda x: x.get('score', 0), 
            reverse=True
        )
        
        scheduled_interviews = []
        used_slots = []
        
        for candidate in sorted_candidates:
            # Find best available slot
            best_slot = None
            for slot in slots_list:
                if slot not in used_slots:
                    best_slot = slot
                    break
            
            if best_slot:
                # Generate Google Meet link
                meeting_id = str(uuid.uuid4())[:8] + "-" + str(uuid.uuid4())[9:13] + "-" + str(uuid.uuid4())[14:17]
                meeting_link = f"https://meet.google.com/{meeting_id}"
                
                # Calculate interview end time
                start_time = best_slot.get("time", "TBD")
                
                scheduled_interview = {
                    "candidate_id": candidate.get("user_id"),
                    "candidate_name": candidate.get("user_name", "Unknown"),
                    "candidate_email": candidate.get("user_email", ""),
                    "job_title": job_title,  
                    "interview_date": best_slot.get("date", "TBD"),
                    "interview_time": start_time,
                    "meeting_link": meeting_link,
                    "interviewer_email": best_slot.get("interviewer_email", "interviewer@company.com"),
                    "duration_minutes": interview_duration_minutes,
                    "candidate_score": candidate.get("score", 0)
                }
                
                scheduled_interviews.append(scheduled_interview)
                used_slots.append(best_slot)
        
        print(f" Scheduled {len(scheduled_interviews)} interviews for {job_title}")
        
        return {
            "scheduled_interviews": scheduled_interviews,
            "total_scheduled": len(scheduled_interviews),
            "job_title": job_title,  
            "scheduling_summary": f"Scheduled {len(scheduled_interviews)} interviews for {job_title} position"
        }
        
    except Exception as e:
        print(f" Error in scheduling: {e}")
        return {
            "scheduled_interviews": [],
            "total_scheduled": 0,
            "error": str(e)
        }
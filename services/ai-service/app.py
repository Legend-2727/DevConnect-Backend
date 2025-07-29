from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess, json
from typing import List, Dict, Any
import traceback
import os
from dotenv import load_dotenv

# CV Modification imports
try:
    import google.generativeai as genai
    from fpdf import FPDF
    CV_MODIFICATION_AVAILABLE = True
except ImportError as e:
    print(f"Warning: CV modification dependencies not available: {e}")
    CV_MODIFICATION_AVAILABLE = False
    genai = None
    FPDF = None


try:
    from agent_graph.shortlist_graph import shortlist_graph
    from agent_graph.job_graph import cv_graph
    from langchain_core.messages import (
        HumanMessage, AIMessage, SystemMessage, ToolMessage, FunctionMessage
    )
    from agent_graph.interview_scheduling_graph import interview_scheduling_graph
    LANGRAPH_AVAILABLE = True
except ImportError as e:
    print(f"Warning: LangGraph components not available: {e}")
    print("Running in basic mode without AI agent functionality")
    LANGRAPH_AVAILABLE = False
    
    # Mock classes for basic functionality
    class HumanMessage:
        def __init__(self, content): self.content = content
    class AIMessage:
        def __init__(self, content): self.content = content
    class SystemMessage:
        def __init__(self, content): self.content = content
    class ToolMessage:
        def __init__(self, content): self.content = content
    class FunctionMessage:
        def __init__(self, content): self.content = content 

# Load environment variables
load_dotenv()

# Configure Google AI for CV modification
if CV_MODIFICATION_AVAILABLE and genai:
    try:
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        print("✅ Google AI configured for CV modification")
    except Exception as e:
        print(f"⚠️ Warning: Could not configure Google AI: {e}")
        CV_MODIFICATION_AVAILABLE = False

# CV Modification Models
class ModifyCVRequest(BaseModel):
    cv_url: str
    job_role: str
    company_id: int
    job_id: int 


import psycopg2
try:
    from apscheduler.schedulers.background import BackgroundScheduler  
    from apscheduler.triggers.interval import IntervalTrigger  
    SCHEDULER_AVAILABLE = True
except ImportError:
    print("Warning: APScheduler not available - background monitoring disabled")
    SCHEDULER_AVAILABLE = False
    BackgroundScheduler = None
    IntervalTrigger = None  
import atexit

if SCHEDULER_AVAILABLE:
    scheduler = BackgroundScheduler()
else:
    scheduler = None
def get_jobs_awaiting_interview_scheduling() -> List[int]:
    """Get jobs that have sent shortlist emails but haven't scheduled interviews yet"""
    try:
        # Try DATABASE_URL first (like other services), then fallback to individual env vars
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
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
    # Try DATABASE_URL first (like other services), then fallback to individual env vars
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        conn = psycopg2.connect(database_url)
    else:
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
        # Try DATABASE_URL first (like other services), then fallback to individual env vars
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
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
    """Background function that runs every 60 minutes"""
    try:
        print("🔄 Running automated interview monitoring...")
        
        # Get jobs that have sent shortlist emails
        pending_jobs = get_jobs_awaiting_interview_scheduling()
        
        if not pending_jobs:
            print("ℹ️ No jobs awaiting interview scheduling")
            return
        
        print(f"📋 Found {len(pending_jobs)} pending jobs: {pending_jobs}")
        
        results = []
        for job_id in pending_jobs:
            try:
                print(f"🔍 Checking job {job_id} for interview scheduling...")
                
                # FIRST: Check for email replies (NO AI USED)
                from agent_graph.tools.email_monitor_tool import check_interviewer_replies
                email_check = check_interviewer_replies(job_id)
                
                if not email_check.get("has_replies", False):
                    print(f"⏳ No interviewer replies found for job {job_id} - skipping AI processing")
                    continue
                
                print(f"📧 Found {len(email_check.get('replies', []))} email replies for job {job_id} - proceeding with AI processing")
                
                # SECOND: Only call AI graph if there are actual replies
                shortlisted = get_shortlisted_candidates(job_id)
                
                if not shortlisted:
                    print(f"❌ No shortlisted candidates found for job {job_id}")
                    continue
                
                # NOW call the AI graph (only when there are replies)
                print(f"🤖 Calling AI graph for job {job_id} with {len(email_check['replies'])} replies")
                result = interview_scheduling_graph.invoke({
                    "messages": [HumanMessage(content="Automated interview monitoring")],
                    "job_id": job_id,
                    "shortlisted_candidates": shortlisted
                })
                
                interviews_scheduled = len(result.get("scheduled_interviews", []))
                
                if interviews_scheduled > 0:
                    print(f"✅ Successfully scheduled {interviews_scheduled} interviews for job {job_id}")
                    results.append({
                        "job_id": job_id,
                        "interviews_scheduled": interviews_scheduled,
                        "status": "success"
                    })
                else:
                    print(f"⏳ No interviews scheduled for job {job_id} (no suitable time slots found)")
                
            except Exception as e:
                print(f"❌ Error processing job {job_id}: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        if results:
            print(f"🎉 Automated monitoring completed: {len(results)} jobs processed successfully")
        else:
            print("ℹ️ No new interviews scheduled in this cycle")
            
    except Exception as e:
        print(f"❌ Background monitoring error: {e}")
        import traceback
        traceback.print_exc()



def init_scheduler():
    """Initialize scheduler when module loads"""
    import datetime
    print(f"🕐 [{datetime.datetime.now()}] init_scheduler() called")
    
    if not SCHEDULER_AVAILABLE:
        print(f"⚠️  [{datetime.datetime.now()}] Scheduler not available - background monitoring disabled")
        return
        
    try:
        print(f"🔄 [{datetime.datetime.now()}] Initializing scheduler at module level...")
        
        scheduler.add_job(
            func=background_interview_monitoring,
            trigger=IntervalTrigger(minutes=2),  # Changed back to 2 minutes for demonstration and debugging
            id='interview_monitoring',
            name='Automated Interview Monitoring',
            replace_existing=True
        )
        
        scheduler.start()
        print(f"✅ [{datetime.datetime.now()}] Scheduler started at module level - will check every 2 minutes (for demonstration)")
        
        # Print initial background check
        print(f"🔄 [{datetime.datetime.now()}] Running initial background check...")
        # background_interview_monitoring()  # Commented out to conserve API quota
        
    except Exception as e:
        print(f"❌ [{datetime.datetime.now()}] Module scheduler error: {e}")
        import traceback
        traceback.print_exc()


# Re-enable the scheduler
init_scheduler()

def extract_text_from_pdf_url(file_url: str) -> str:
    """Extract text from PDF file at given URL"""
    if not CV_MODIFICATION_AVAILABLE:
        return "CV modification not available - missing dependencies"
    
    try:
        import requests
        from PyPDF2 import PdfReader
        import io
        
        response = requests.get(file_url)
        response.raise_for_status()  # Raise an error for bad responses (e.g., 404 Not Found)
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        
        return text.strip()
    
    except Exception as e:
        print(f"Error extracting text from PDF URL: {e}")
        return f"Error reading PDF: {str(e)}"

# CV Modification Helper Functions
def extract_text_from_pdf(file_path):
    """Extract text from PDF file"""
    if not CV_MODIFICATION_AVAILABLE:
        return "CV modification not available - missing dependencies"
    
    # http://98.70.42.26:4004/uploads/cvs/1753742844341-534324938.pdf

    if (file_path.startswith("http://") or file_path.startswith("https://")):
        return extract_text_from_pdf_url(file_path)
    
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return f"Error reading PDF: {str(e)}"

def get_job_details_for_cv(job_id: int) -> Dict[str, Any]:
    """Fetch job details from the database by job_id for CV modification"""
    try:
        # Try DATABASE_URL first (like other services), then fallback to individual env vars
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            connection = psycopg2.connect(database_url)
        else:
            connection = psycopg2.connect(
                host=os.getenv("DB_HOST", "db"),
                port=os.getenv("DB_PORT", "5432"),
                database=os.getenv("DB_NAME", "main"),
                user=os.getenv("DB_USER", "root"),
                password=os.getenv("DB_PASS", "password")
            )
        cursor = connection.cursor()
        cursor.execute("""
            SELECT j.*, c.name as company_name, c.industry
            FROM devconnect.jobs j
            JOIN devconnect.companies c ON j.company_id = c.id
            WHERE j.id = %s
        """, (job_id,))
        job = cursor.fetchone()
        if job:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, job))
        return {}
    except Exception as e:
        print(f"Error fetching job details for job_id={job_id}: {e}")
        return {}
    finally:
        if 'connection' in locals():
            connection.close()

def get_job_requirements_for_cv(job_id):
    """Get job requirements for CV modification"""
    job = get_job_details_for_cv(job_id)
    if not job:
        print(f"Failed to fetch job requirements for job_id={job_id}: job not found in DB")
        return ""
    requirements = job.get("skills", [])
    description = job.get("description", "")
    print(f"Parsed requirements from DB: {requirements}, description: {description}")
    return f"{description}\nSkills: {', '.join(requirements) if requirements else 'General skills'}"

def generate_ai_cv(cv_text, job_role, requirements):
    """Generate improved CV using AI"""
    if not CV_MODIFICATION_AVAILABLE or not genai:
        return f"CV modification not available. Original CV:\n{cv_text}"
    
    try:
        prompt = (
            f"Original CV:\n{cv_text}\n\n"
            f"Job Role: {job_role}\n"
            f"Company Requirements: {requirements}\n\n"
            "Your task:\n"
            "- Rewrite the CV to highlight and improve description of backend-relevant skills and experiences.\n"
            "- DO NOT invent any new skills — only improve existing ones.\n"
            "- Format the output clearly using sections: [Contact Info, Summary, Skills, Experience, Education, Certifications].\n"
            "- Use proper headings (like '## Summary') and bullet points where appropriate.\n"
            "- Keep the tone professional and suitable for a job application."
        )

        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        print("AI CV generation completed")
        return response.text
    except Exception as e:
        print(f"Error generating AI CV: {e}")
        return f"Error in AI generation: {str(e)}\n\nOriginal CV:\n{cv_text}"

def sanitize_text(text):
    """Replace non-ASCII characters for PDF compatibility"""
    return text.encode("latin-1", "replace").decode("latin-1")

def create_pdf(cv_text, filename="modified_cv.pdf"):
    """Create PDF from CV text"""
    if not CV_MODIFICATION_AVAILABLE or not FPDF:
        return b"PDF creation not available - missing dependencies"
    
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.set_font("Arial", size=12)

        lines = cv_text.splitlines()
        for line in lines:
            line = sanitize_text(line.strip())
            if not line:
                pdf.ln(5)
            elif line.startswith("##"):
                pdf.set_font("Arial", "B", 12)
                pdf.cell(0, 10, line.replace("##", "").strip(), ln=True)
                pdf.set_font("Arial", size=12)
            elif line.startswith("- "):
                bullet = u"\u2022 " + line[2:].strip()
                bullet = sanitize_text(bullet)
                pdf.cell(10)
                pdf.multi_cell(0, 8, bullet)
            else:
                pdf.multi_cell(0, 8, line)

        pdf.output(filename)
        with open(filename, "rb") as f:
            return f.read()
    except Exception as e:
        print(f"Error creating PDF: {e}")
        return f"Error creating PDF: {str(e)}".encode()


app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        f"http://{os.getenv('CORSFIX')}:3000",
        "http://localhost:4004",
        f"http://{os.getenv('CORSFIX')}:4004"
    ],  # frontend and file service origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("shutdown")
async def shutdown_event():
    """Stop the scheduler when FastAPI shuts down"""
    if not SCHEDULER_AVAILABLE or scheduler is None:
        print("ℹ️  No scheduler to shutdown")
        return
        
    try:
        if scheduler.running:
            print("🔄 Stopping automated interview monitoring scheduler...")
            scheduler.shutdown(wait=False)
        else:
            print("ℹ️  Scheduler was not running")
    except Exception as e:
        print(f"Error shutting down scheduler: {e}")


def cleanup_scheduler():
    if not SCHEDULER_AVAILABLE or scheduler is None:
        return
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
    # Try DATABASE_URL first (like other services), then fallback to individual env vars
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        conn = psycopg2.connect(database_url)
    else:
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

@app.post("/api/v1/modify-cv")
async def modify_cv(req: ModifyCVRequest):
    """
    Modify CV based on job requirements using AI
    """
    try:
        if not CV_MODIFICATION_AVAILABLE:
            raise HTTPException(500, "CV modification not available - missing dependencies")
        
        # Convert CV URL to file path
        file_path = req.cv_url.replace("http://localhost:4004", "/app")
        print(f"Processing CV modification request: {req.dict()}")
        print(f"Resolved file path: {file_path}")
        
        # Extract text from PDF
        cv_text = extract_text_from_pdf(file_path)
        print(f"Extracted CV text: {cv_text[:200]}...")  # Print first 200 chars for brevity
        
        # Get job requirements
        requirements = get_job_requirements_for_cv(req.job_id)
        print(f"Job requirements: {requirements}")
        
        # Generate modified CV using AI
        modified_cv_text = generate_ai_cv(cv_text, req.job_role, requirements)
        print(f"Modified CV text: {modified_cv_text[:200]}...")
        
        # Create PDF
        pdf_bytes = create_pdf(modified_cv_text)
        print(f"PDF bytes length: {len(pdf_bytes)}")
        
        return {
            "modified_cv": modified_cv_text, 
            "pdf": pdf_bytes.hex(),
            "status": "success",
            "message": "CV modified successfully"
        }
        
    except Exception as e:
        print(f"Error in CV modification: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error modifying CV: {str(e)}")


def recommendation_result_helper(result):
    try:
        # Extract the list of recommended jobs
        recommended_jobs = result.get("recommended_jobs", [])
        
        if not recommended_jobs:
            return result  # No modifications needed if no jobs
        
        # Extract job IDs for database query
        job_ids = [job["id"] for job in recommended_jobs]
        
        # Connect to database
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "db"),
            database=os.getenv("DB_NAME", "main"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", "password"),
            port=os.getenv("DB_PORT", "5432"),
        )
        
        try:
            with conn.cursor() as cur:
                # Query to get company name, company ID, and job location for each job
                placeholders = ", ".join(["%s"] * len(job_ids))
                cur.execute(f"""
                    SELECT j.id, j.company_id, c.name, j.location
                    FROM devconnect.jobs j
                    JOIN devconnect.companies c ON j.company_id = c.id
                    WHERE j.id IN ({placeholders})
                """, job_ids)
                
                # Create a dictionary to map job_id to company details
                job_details = {}
                for row in cur.fetchall():
                    job_id, company_id, company_name, job_location = row
                    job_details[job_id] = {
                        "company_id": company_id,
                        "company_name": company_name,
                        "location": job_location or "Remote/Not specified"  # Default if location is NULL
                    }
                
                # Add company details to each recommended job
                for job in recommended_jobs:
                    job_id = job["id"]
                    if job_id in job_details:
                        job.update({
                            "company_id": job_details[job_id]["company_id"],
                            "company_name": job_details[job_id]["company_name"],
                            "location": job_details[job_id]["location"]
                        })
                    else:
                        # If job details not found (unlikely since we're querying by job IDs in the result)
                        job.update({
                            "company_id": None,
                            "company_name": "Unknown Company",
                            "location": "Unknown Location"
                        })
        finally:
            conn.close()
        
        return result
    except Exception as e:
        print(f"Error in recommendation_result_helper: {e}")
        import traceback
        traceback.print_exc()
        return result  # Return original result if there was an error
    
@app.post("/recommend")
async def recommend_jobs(data: RecommendRequest):
    try:
        print("Received recommend request:", data.dict())
        
        if LANGRAPH_AVAILABLE:
            result = cv_graph.invoke({
                "messages": [
                    HumanMessage(content=f"Process CV at {data.cv_path} and recommend jobs for user {data.user_id}")
                ],
                "cv_path": data.cv_path
            })
            result = recommendation_result_helper(result)  # Use the helper function to add company details
            print("Recommend graph result:", result)
            return result
        else:
            return {
                "user_id": data.user_id,
                "cv_path": data.cv_path,
                "recommendations": [],
                "message": "Running in basic mode - AI job recommendations not available"
            }

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
        
        if LANGRAPH_AVAILABLE:
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
        else:
            # Basic mode without AI - return all applicants as shortlisted
            return {
                "job_id": req.job_id,
                "job_title": job_data["job_title"],
                "total_applicants": len(job_data["applicants"]),
                "shortlist": job_data["applicants"],
                "shortlisted_count": len(job_data["applicants"]),
                "email_sent": False,
                "message": "Running in basic mode - AI shortlisting not available"
            }
    
    except Exception as e:
        print("Exception in /shortlist:", e)
        traceback.print_exc()
        raise HTTPException(500, f"Short-listing failed: {str(e)}")



@app.get("/test")
async def test_endpoint():
    return {"message": "Test endpoint working"}

@app.post("/companies/{company_id}/jobs/{job_id}/shortlist")
async def shortlist_company_job(company_id: int, job_id: int):
    """
    Company-specific shortlist endpoint
    """
    try:
        print(f"Received company shortlist request for company {company_id}, job {job_id}")
        
        # Verify the job belongs to the company
        # Try DATABASE_URL first (like other services), then fallback to individual env vars
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            conn = psycopg2.connect(database_url)
        else:
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
                    SELECT j.id, j.title, j.company_id 
                    FROM devconnect.jobs j 
                    WHERE j.id = %s AND j.company_id = %s AND j.is_active = TRUE
                """, [job_id, company_id])
                
                job_result = cur.fetchone()
                if not job_result:
                    raise HTTPException(404, f"Job {job_id} not found for company {company_id} or job is inactive")
        finally:
            conn.close()
        
        # Use the existing shortlist functionality
        job_data = fetch_job_details(job_id)
        
        if len(job_data['applicants']) == 0:
            return {
                "company_id": company_id,
                "job_id": job_id,
                "job_title": job_data["job_title"],
                "error": "No applicants with CVs found",
                "total_applicants": 0,
                "shortlisted_count": 0,
                "shortlist": [],
                "email_sent": False
            }
        
        if LANGRAPH_AVAILABLE:
            result = shortlist_graph.invoke({
                "messages": [
                    HumanMessage(content="Extract CVs, shortlist candidates, and send email notification.")
                ],
                "job_desc": job_data["job_desc"],
                "job_skills": job_data["job_skills"],
                "job_id": job_id,
                "job_title": job_data["job_title"],
                "applicants": job_data["applicants"]
            })
            
            return {
                "company_id": company_id,
                "job_id": job_id,
                "job_title": job_data["job_title"],
                "total_applicants": len(job_data["applicants"]),
                "shortlist": serialize(result.get("shortlist", [])),
                "shortlisted_count": len(result.get("shortlist", [])),
                "email_sent": result.get("email_sent", False)
            }
        else:
            # Basic mode - mark some candidates as shortlisted in database
            shortlisted_candidates = []
            
            print(f"Basic mode shortlisting for job: {job_data['job_title']}")
            print(f"Available applicants: {job_data['applicants']}")
            
            # Simple logic: shortlist candidates with cv_2.pdf and cv_3.pdf for Full Stack roles
            for applicant in job_data["applicants"]:
                should_shortlist = False
                print(f"Evaluating candidate {applicant['user_id']} with CV: {applicant['cv_path']}")
                
                # Simple matching logic - shortlist based on CV file
                if "Full Stack" in job_data["job_title"]:
                    if "cv_2.pdf" in applicant["cv_path"] or "cv_3.pdf" in applicant["cv_path"]:
                        should_shortlist = True
                        print(f"  ✅ Shortlisting {applicant['user_name']} - CV matches Full Stack criteria")
                elif "Mobile" in job_data["job_title"]:
                    if "cv_1.pdf" in applicant["cv_path"] or "cv_3.pdf" in applicant["cv_path"]:
                        should_shortlist = True
                        print(f"  ✅ Shortlisting {applicant['user_name']} - CV matches Mobile criteria")
                else:
                    # Default: shortlist first 2 candidates
                    if len(shortlisted_candidates) < 2:
                        should_shortlist = True
                        print(f"  ✅ Shortlisting {applicant['user_name']} - Default criteria")
                
                if should_shortlist:
                    shortlisted_candidates.append({
                        "user_id": applicant["user_id"],
                        "user_name": applicant["user_name"], 
                        "cv_path": applicant["cv_path"],
                        "score": 85,  # Mock score
                        "reason": "Skills match job requirements"
                    })
                else:
                    print(f"  ❌ Not shortlisting {applicant['user_name']}")
            
            print(f"Final shortlist: {len(shortlisted_candidates)} candidates")
            
            # Update database status for shortlisted candidates
            if shortlisted_candidates:
                conn = psycopg2.connect(
                    host=os.getenv("DB_HOST", "db"),
                    database=os.getenv("DB_NAME", "main"),
                    user=os.getenv("DB_USER", "root"),
                    password=os.getenv("DB_PASS", "password"),
                    port=os.getenv("DB_PORT", "5432"),
                )
                
                try:
                    with conn.cursor() as cur:
                        for candidate in shortlisted_candidates:
                            cur.execute("""
                                UPDATE devconnect.applications 
                                SET status = 'SHORTLISTED', updated_at = NOW()
                                WHERE job_id = %s AND user_id = %s
                            """, [job_id, candidate["user_id"]])
                        conn.commit()
                        print(f"Updated {len(shortlisted_candidates)} candidates to SHORTLISTED status")
                finally:
                    conn.close()
            else:
                print("No candidates shortlisted, skipping database update")
            
            return {
                "company_id": company_id,
                "job_id": job_id,
                "job_title": job_data["job_title"],
                "total_applicants": len(job_data["applicants"]),
                "shortlist": shortlisted_candidates,
                "shortlisted_count": len(shortlisted_candidates),
                "email_sent": False,
                "message": "Running in basic mode - candidates shortlisted based on simple matching"
            }
    
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        print("Exception in company shortlist:", e)
        traceback.print_exc()
        raise HTTPException(500, f"Company shortlisting failed: {str(e)}")


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
    features = [
        "LangGraph AI Agents",
        "Job Recommendation System", 
        "Candidate Shortlisting",
        "Interview Scheduling"
    ]
    
    if CV_MODIFICATION_AVAILABLE:
        features.append("AI-Powered CV Modification")
    
    return {
        "message": "DevConnect AI Service", 
        "status": "running", 
        "version": "2.3.2",
        "features": features,
        "cv_modification": "available" if CV_MODIFICATION_AVAILABLE else "disabled (missing dependencies)"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "ai-service", 
        "version": "2.3.2",
        "langraph_available": LANGRAPH_AVAILABLE,
        "cv_modification_available": CV_MODIFICATION_AVAILABLE,
        "scheduler_available": SCHEDULER_AVAILABLE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)







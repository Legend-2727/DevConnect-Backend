import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from langchain_core.tools import tool
import psycopg2

def fetch_interviewer_email(job_id: int) -> tuple:
    """Fetch interviewer email for a specific job"""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        database=os.getenv("DB_NAME", "main"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "password"),
        port=os.getenv("DB_PORT", "5432"),
    )
    with conn.cursor() as cur:
        cur.execute("""
            SELECT i.email, i.name 
            FROM devconnect.interviewers i
            JOIN devconnect.job_interviewers ji ON i.id = ji.interviewer_id
            WHERE ji.job_id = %s
        """, [job_id])
        result = cur.fetchone()
    conn.close()
    return result if result else (None, None)

@tool
def send_shortlist_email(
    job_title: str, 
    job_id: int, 
    shortlisted_candidates: str,  # Change from list to str
    job_description: str
) -> dict:
    """
    Send an AI-generated email to the interviewer about shortlisted candidates.
    
    Args:
        job_title: Title of the job
        job_id: ID of the job  
        shortlisted_candidates: JSON string of shortlisted candidates with scores and justifications
        job_description: Job description
    """
    try:
        # Parse candidates from string
        import json
        candidates = json.loads(shortlisted_candidates) if isinstance(shortlisted_candidates, str) else shortlisted_candidates
        
        # Get interviewer details
        interviewer_email, interviewer_name = fetch_interviewer_email(job_id)
        
        if not interviewer_email:
            return {"success": False, "error": "No interviewer found for this job"}
        
        # Create email content
        subject = f"New Shortlisted Candidates for {job_title}"
        
        # Generate professional email body
        body = f"""Dear {interviewer_name or 'Hiring Manager'},

I hope this email finds you well. I'm excited to share that we have successfully completed the initial screening for the {job_title} position and have identified {len(candidates)} highly qualified candidate{'s' if len(candidates) != 1 else ''} for your review.

Job Details:
Position: {job_title}
Job ID: {job_id}

Shortlisted Candidates:
"""
        
        for i, candidate in enumerate(candidates, 1):
            body += f"""
{i}. Candidate ID: {candidate.get('user_id', 'Unknown')}
   Match Score: {candidate.get('score', 0)}/100
   Assessment: {candidate.get('justification', 'No justification provided')}
   
"""
        
        body += f"""
Next Steps:
Please review these candidates and let me know your availability for conducting interviews. I recommend prioritizing candidates with higher match scores, though all shortlisted candidates meet the essential requirements for this role.

If you need any additional information about these candidates or would like to schedule interviews, please don't hesitate to reach out.

Best regards,
DevConnect AI Recruitment System

---
This is an automated message from DevConnect's AI-powered recruitment system.
"""
        
        # Send email
        success = send_email(interviewer_email, subject, body)
        
        return {
            "success": success,
            "recipient": interviewer_email,
            "subject": subject,
            "candidates_count": len(candidates)
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send email using SMTP"""
    try:
        # Gmail SMTP configuration
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        sender_email = os.getenv("GMAIL_USER")
        sender_password = os.getenv("GMAIL_APP_PASSWORD")
        
        if not sender_email or not sender_password:
            print("ERROR: Gmail credentials not configured")
            return False
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = f"DevConnect Recruitment <{sender_email}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Add body to email
        msg.attach(MIMEText(body, 'plain'))
        
        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, to_email, text)
        server.quit()
        
        print(f"✅ Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False
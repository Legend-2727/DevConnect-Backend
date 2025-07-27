"""
Email monitoring tool to check for interviewer replies
"""
import imaplib
import email
from email.header import decode_header
import os
from datetime import datetime, timedelta
from langchain_core.tools import tool
import re

@tool
def check_interviewer_replies(job_id: int) -> dict:
    """
    Check for interviewer replies to shortlist emails.
    
    Args:
        job_id: The job ID to check replies for
    
    Returns:
        dict: {
            "has_replies": bool,
            "replies": [
                {
                    "from": "sarah.malik@acme.com",
                    "subject": "Re: New Shortlisted Candidates for Backend Engineer",
                    "body": "Thanks for the candidates. I'm available Monday 2-4pm...",
                    "received_at": "2025-06-23T10:30:00Z"
                }
            ]
        }
    """
    try:
        # Gmail credentials
        gmail_user = os.getenv("GMAIL_USER")
        gmail_password = os.getenv("GMAIL_APP_PASSWORD")
        
        if not gmail_user or not gmail_password:
            return {
                "has_replies": False,
                "error": "Gmail credentials not configured",
                "replies": []
            }
        
        # Connect to Gmail via IMAP
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(gmail_user, gmail_password)
        mail.select("inbox")
        
        # Search for replies to shortlist emails in last 7 days
        since_date = (datetime.now() - timedelta(days=7)).strftime("%d-%b-%Y")
        search_criteria = f'(SUBJECT "Re: New Shortlisted Candidates") (SINCE "{since_date}")'
        
        result, message_ids = mail.search(None, search_criteria)
        
        replies = []
        if message_ids[0]:
            for msg_id in message_ids[0].split():
                try:
                    # Fetch email
                    result, msg_data = mail.fetch(msg_id, "(RFC822)")
                    email_message = email.message_from_bytes(msg_data[0][1])
                    
                    # Extract details
                    from_email = email_message.get("From", "")
                    subject = decode_header(email_message.get("Subject", ""))[0][0]
                    if isinstance(subject, bytes):
                        subject = subject.decode()
                    
                    # Get email body
                    body = get_email_body(email_message)
                    
                    # Get received date
                    date_tuple = email.utils.parsedate_tz(email_message.get("Date"))
                    if date_tuple:
                        received_at = datetime.fromtimestamp(email.utils.mktime_tz(date_tuple))
                    else:
                        received_at = datetime.now()
                    
                    replies.append({
                        "from": from_email,
                        "subject": subject,
                        "body": body,
                        "received_at": received_at.isoformat()
                    })
                    
                except Exception as e:
                    print(f"Error processing email {msg_id}: {e}")
                    continue
        
        mail.logout()
        
        return {
            "has_replies": len(replies) > 0,
            "replies": replies,
            "total_found": len(replies)
        }
        
    except Exception as e:
        return {
            "has_replies": False,
            "error": str(e),
            "replies": []
        }

def get_email_body(email_message):
    """Extract text body from email message"""
    body = ""
    
    if email_message.is_multipart():
        for part in email_message.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    body = part.get_payload(decode=True).decode()
                    break
                except:
                    continue
    else:
        try:
            body = email_message.get_payload(decode=True).decode()
        except:
            body = str(email_message.get_payload())
    
    return body.strip()
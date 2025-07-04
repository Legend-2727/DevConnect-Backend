"""
interview_scheduling_graph.py
LangGraph that:
  1) Monitors interviewer email replies
  2) Extracts available time slots using AI
  3) Schedules interviews optimally
  4) Sends calendar invitations to candidates and interviewers
"""
from __future__ import annotations
import json, os
from typing import List, Optional
from typing_extensions import Annotated, TypedDict

from langgraph.prebuilt import create_react_agent
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langchain_core.messages import (
    BaseMessage, HumanMessage, ToolMessage
)
from langchain_google_genai import ChatGoogleGenerativeAI
from datetime import datetime, timedelta

# Import the tools
from agent_graph.tools.email_monitor_tool import check_interviewer_replies
from agent_graph.tools.time_extraction_tool import extract_time_slots_with_ai
from agent_graph.tools.interview_scheduler_tool import schedule_interviews_optimally
from agent_graph.tools.calendar_invitation_tool import send_interview_invitations

# ─────────────────────────────── State ────────────────────────────────
class InterviewSchedulingState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    job_id: int
    shortlisted_candidates: List[dict]
    interviewer_replies: Optional[List[dict]]
    available_slots: Optional[List[dict]]
    scheduled_interviews: Optional[List[dict]]
    interviews_saved: Optional[bool]       
    saved_count: Optional[int]              
    calendar_invites_sent: Optional[bool]

# ─────────────────────────────── LLM & agents ─────────────────────────
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

email_monitor_agent = create_react_agent(
    model=llm, 
    tools=[check_interviewer_replies],
    prompt=(
        "You are an email monitoring assistant. Use the check_interviewer_replies tool "
        "to check for interviewer responses to shortlist emails. Always use the tool."
    )
)

time_extraction_agent = create_react_agent(
    model=llm,
    tools=[extract_time_slots_with_ai], 
    prompt=(
        "You are a time slot extraction specialist. Use the extract_time_slots_with_ai tool "
        "to parse available time slots from interviewer emails. Always use the tool."
    )
)

scheduling_agent = create_react_agent(
    model=llm,
    tools=[schedule_interviews_optimally],
    prompt=(
        "You are an interview scheduling optimizer. Use the schedule_interviews_optimally tool "
        "to create an optimal interview schedule matching candidates with available time slots. "
        "Prioritize higher-scored candidates for better time slots. Always use the tool."
    )
)

invitation_agent = create_react_agent(
    model=llm,
    tools=[send_interview_invitations],
    prompt=(
        "You are a calendar invitation manager. Use the send_interview_invitations tool "
        "to send professional calendar invites to candidates and interviewers. Always use the tool."
    )
)

# ─────────────────────────────── helpers ──────────────────────────────
def _latest_tool_payload(msgs):
    """Return the .content of the last ToolMessage (string)."""
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            return m.content
    raise ValueError("No ToolMessage found.")

def _extract_tool_payload(msgs):
    """
    Extract and parse tool payload from messages.
    Returns parsed JSON if possible, otherwise raw content.
    """
    try:
        content = _latest_tool_payload(msgs)
        if isinstance(content, str):
            # Try to parse as JSON
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # If not JSON, return as-is
                return {"raw_content": content}
        return content
    except ValueError:
        return {}

def _smart_payload(content, key_expected: str | None = None):
    """
    Best-effort parser:
      • if content is JSON -> return content[key_expected] (or whole dict)
      • else -> return raw string
    """
    try:
        data = json.loads(content)
        if key_expected and isinstance(data, dict) and key_expected in data:
            return data[key_expected]
        return data
    except json.JSONDecodeError:
        return content

# ─────────────────────────────── nodes ────────────────────────────────
def monitor_emails_node(state: InterviewSchedulingState):
    """Check for interviewer replies"""
    print(f"Monitoring emails for job {state['job_id']}...")
    
    res = email_monitor_agent.invoke({
        "messages": [
            HumanMessage(content=f"Check for interviewer replies for job {state['job_id']}")
        ]
    })
    
    replies_data = _extract_tool_payload(res["messages"])
    replies = replies_data.get("replies", []) if isinstance(replies_data, dict) else []
    
    print(f"Found {len(replies)} interviewer replies")
    
    return {
        "interviewer_replies": replies,
        "messages": state["messages"] + res["messages"]
    }

def extract_time_slots_node(state: InterviewSchedulingState):
    """Extract available time slots from replies"""
    if not state.get("interviewer_replies"):
        print("No interviewer replies found, skipping time slot extraction")
        return {"available_slots": [], "messages": state["messages"]}
    
    print(f"Extracting time slots from {len(state['interviewer_replies'])} replies...")
    
    all_slots = []
    for reply in state["interviewer_replies"]:
        try:
            res = time_extraction_agent.invoke({
                "messages": [
                    HumanMessage(content=(
                        f"Extract available time slots from this interviewer email: {reply['body']}"
                    ))
                ]
            })
            
            slots_data = _extract_tool_payload(res["messages"])
            if isinstance(slots_data, dict) and "time_slots" in slots_data:
                slots = slots_data["time_slots"]
            elif isinstance(slots_data, list):
                slots = slots_data
            else:
                slots = []
                
            all_slots.extend(slots)
            print(f"Extracted {len(slots)} time slots from reply")
            
        except Exception as e:
            print(f"Failed to extract time slots from reply: {e}")
            continue
    
    print(f"Total extracted time slots: {len(all_slots)}")
    
    return {
        "available_slots": all_slots,
        "messages": state["messages"]
    }

def schedule_interviews_node(state: InterviewSchedulingState):
    """Create interview schedule"""
    if not state.get("available_slots") or not state.get("shortlisted_candidates"):
        print("No available slots or candidates, skipping scheduling")
        return {
            "scheduled_interviews": [],
            "messages": state["messages"]
        }
    
    print(f"Scheduling interviews for {len(state['shortlisted_candidates'])} candidates...")
    
    res = scheduling_agent.invoke({
        "messages": [
            HumanMessage(content=(
                f"Use the schedule_interviews_optimally tool with these parameters:\n"
                f"- candidates: {json.dumps(state['shortlisted_candidates'])}\n"
                f"- available_slots: {json.dumps(state['available_slots'])}\n"
                f"- job_id: {state['job_id']}\n"
                f"Please schedule the interviews using the exact time slots provided."
            ))
        ]
    })
    
    schedule_data = _extract_tool_payload(res["messages"])
    scheduled = schedule_data.get("scheduled_interviews", []) if isinstance(schedule_data, dict) else []
    
    print(f"Successfully scheduled {len(scheduled)} interviews")
    
    return {
        "scheduled_interviews": scheduled,
        "messages": state["messages"] + res["messages"]
    }

def send_invitations_node(state: InterviewSchedulingState):
    """Send calendar invites to all parties"""
    if not state.get("scheduled_interviews"):
        print("No scheduled interviews, skipping invitations")
        return {
            "calendar_invites_sent": False,
            "messages": state["messages"]
        }
    
    print(f"Sending calendar invitations for {len(state['scheduled_interviews'])} interviews...")
    
    res = invitation_agent.invoke({
        "messages": [
            HumanMessage(content=(
                f"Send interview invitations for: {json.dumps(state['scheduled_interviews'])}"
            ))
        ]
    })
    
    invite_result = _extract_tool_payload(res["messages"])
    invites_sent = invite_result.get("calendar_events_created", False) if isinstance(invite_result, dict) else False
    
    print(f"Calendar invites sent: {invites_sent}")
    
    return {
        "calendar_invites_sent": invites_sent,
        "messages": state["messages"] + res["messages"]
    }

# ─────────────────────────────── Conditional Logic ────────────────────
def should_proceed_to_scheduling(state: InterviewSchedulingState):
    """Check if we have both replies and candidates to proceed"""
    has_replies = bool(state.get("interviewer_replies"))
    has_slots = bool(state.get("available_slots"))
    has_candidates = bool(state.get("shortlisted_candidates"))
    
    if has_replies and has_slots and has_candidates:
        return "schedule_interviews"
    else:
        print("Conditions not met for scheduling - ending workflow")
        return "END"

def should_send_invitations(state: InterviewSchedulingState):
    """Check if we have scheduled interviews to send invitations for"""
    has_scheduled = bool(state.get("scheduled_interviews"))
    
    if has_scheduled:
        return "send_invitations"
    else:
        print("No interviews scheduled - ending workflow")
        return "END"
    
def should_save_to_db(state: InterviewSchedulingState):
    """Check if we have scheduled interviews to save to database"""
    has_scheduled = bool(state.get("scheduled_interviews"))
    
    if has_scheduled:
        print(" Interviews scheduled - proceeding to database save")
        return "save_to_db"
    else:
        print(" No interviews scheduled - ending workflow")
        return "END"

def should_send_invitations_after_save(state: InterviewSchedulingState):
    """Check if interviews were successfully saved and should send invitations"""
    interviews_saved = state.get("interviews_saved", False)
    
    if interviews_saved:
        print(" Interviews saved - proceeding to send invitations")
        return "send_invitations"
    else:
        print(" No interviews saved - ending workflow")
        return "END"



def save_interviews_to_db_node(state: InterviewSchedulingState):
    """Save scheduled interviews to database - BREAKS THE INFINITE LOOP!"""
    if not state.get("scheduled_interviews"):
        print("💾 No scheduled interviews to save")
        return {
            "interviews_saved": False,
            "messages": state["messages"]
        }
    
    print(f"💾 Saving {len(state['scheduled_interviews'])} interviews to database...")
    
    saved_count = 0
    for interview in state['scheduled_interviews']:
        try:
            success = create_interview_record_in_graph(
                job_id=state['job_id'],
                candidate_user_id=interview.get("candidate_id"),
                interview_date=interview.get("interview_date", "2025-06-25"),
                interview_time=interview.get("interview_time", "10:00 AM"),
                interviewer_email=interview.get("interviewer_email", "hr@company.com")
            )
            
            if success:
                saved_count += 1
                print(f" Saved interview for candidate {interview.get('candidate_id')}")
                
        except Exception as e:
            print(f" Error saving interview: {e}")
            continue
    
    print(f" Saved {saved_count} interviews - LOOP BROKEN!")
    
    return {
        "interviews_saved": saved_count > 0,
        "saved_count": saved_count,
        "messages": state["messages"]
    }

def create_interview_record_in_graph(job_id: int, candidate_user_id: int, interview_date: str, interview_time: str, interviewer_email: str) -> bool:
    """Create interview record - PREVENTS INFINITE SCHEDULING"""
    import psycopg2
    from datetime import datetime
    
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "db"),
            database=os.getenv("DB_NAME", "main"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", "password"),
            port=os.getenv("DB_PORT", "5432"),
        )
        
        with conn.cursor() as cur:
            # Parse datetime
            try:
                datetime_str = f"{interview_date} {interview_time}"
                if "AM" in datetime_str or "PM" in datetime_str:
                    dt = datetime.strptime(datetime_str, "%Y-%m-%d %I:%M %p")
                else:
                    dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M")
                    
                scheduled_date = dt.date()
                scheduled_time = dt.time()
            except:
                # Fallback
                tomorrow = datetime.now() + timedelta(days=1)
                scheduled_date = tomorrow.date()
                scheduled_time = datetime.strptime("10:00", "%H:%M").time()
            
            # Get/create interviewer
            cur.execute("""
                SELECT id FROM devconnect.interviewers WHERE email = %s
            """, [interviewer_email])
            
            result = cur.fetchone()
            if result:
                interviewer_id = result[0]
            else:
                cur.execute("""
                    SELECT company_id FROM devconnect.jobs WHERE id = %s
                """, [job_id])
                
                job_result = cur.fetchone()
                if job_result:
                    company_id = job_result[0]
                else:
                    # Fallback to a default company_id (or create one)
                    company_id = 1  # Assuming company_id = 1 exists

                # AHON
                
                # print(f"🏢 Using company_id: {company_id} for new interviewer")
                # cur.execute("""
                #     INSERT INTO devconnect.interviewers (name, email) 
                #     VALUES (%s, %s) RETURNING id
                # """, ['HR Interviewer', interviewer_email])
                # interviewer_id = cur.fetchone()[0]
            
            #  THIS INSERT BREAKS THE INFINITE LOOP!
            cur.execute("""
                INSERT INTO devconnect.interviews (
                    job_id, candidate_user_id, interviewer_id,
                    scheduled_date, scheduled_time, duration_minutes,
                    meeting_link, status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, [
                job_id,
                candidate_user_id,
                interviewer_id,
                scheduled_date,
                scheduled_time,
                60,
                f"https://meet.google.com/abc-{job_id}-{candidate_user_id}",
                'SCHEDULED'
            ])
            
            conn.commit()
            print(f"🔥 LOOP BREAKER: Inserted interview for job {job_id}")
            return True
            
    except Exception as e:
        print(f"❌ Database insert failed: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

# Add to graph flow


# Update flow: schedule_interviews → save_to_db → send_invitations



# ─────────────────────────────── graph ────────────────────────────────
builder = StateGraph(InterviewSchedulingState)

# Add nodes
builder.add_node("monitor_emails", monitor_emails_node)
builder.add_node("extract_slots", extract_time_slots_node)
builder.add_node("schedule_interviews", schedule_interviews_node)
builder.add_node("send_invitations", send_invitations_node)
builder.add_node("save_to_db", save_interviews_to_db_node)

# Set flow with conditional logic
builder.set_entry_point("monitor_emails")
builder.add_edge("monitor_emails", "extract_slots")
builder.add_conditional_edges(
    "extract_slots",
    should_proceed_to_scheduling,
    {
        "schedule_interviews": "schedule_interviews",
        "END": "__end__"
    }
)

builder.add_conditional_edges(
    "schedule_interviews", 
    should_send_invitations,  
    {
        "send_invitations": "send_invitations",  
        "END": "__end__"
    }
)
builder.add_edge("send_invitations", "save_to_db")


builder.add_edge("save_to_db", "__end__")

# Compile the graph
interview_scheduling_graph = builder.compile()

# ─────────────────────────────── Helper Functions ────────────────────
def get_shortlisted_candidates(job_id: int) -> List[dict]:
    """Fetch shortlisted candidates for a job from database"""
    import psycopg2
    
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
                SELECT u.id, u.name, u.email
                FROM devconnect.applications a
                JOIN devconnect.users u ON a.user_id = u.id
                WHERE a.job_id = %s AND a.status = 'SHORTLISTED'
            """, [job_id])
            
            results = cur.fetchall()
            return [
                {
                    "user_id": row[0],
                    "user_name": row[1],
                    "user_email": row[2],
                    "score": 85  # You might want to store this in database
                }
                for row in results
            ]
    finally:
        conn.close()

def get_jobs_awaiting_interview_scheduling() -> List[int]:
    """Get jobs that have sent shortlist emails but haven't scheduled interviews yet"""
    import psycopg2
    from datetime import datetime, timedelta
    
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        database=os.getenv("DB_NAME", "main"), 
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "password"),
        port=os.getenv("DB_PORT", "5432"),
    )
    
    try:
        with conn.cursor() as cur:
            # Get jobs that sent shortlist emails in last 7 days but no interviews scheduled
            cur.execute("""
                SELECT DISTINCT se.job_id
                FROM devconnect.sent_emails se
                WHERE se.subject LIKE '%Shortlisted Candidates%'
                AND se.created_at >= %s
                AND NOT EXISTS (
                    SELECT 1 FROM devconnect.interviews i 
                    WHERE i.job_id = se.job_id
                )
            """, [datetime.now() - timedelta(days=7)])
            
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()
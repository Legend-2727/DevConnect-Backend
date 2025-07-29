
"""
LangGraph that:
  1) extracts raw CV text for each applicant
  2) calls the shortlist-tool for every candidate
  3) returns the final shortlist list[{user_id, score, justification}]
  4) sends email notification to interviewers
"""
from __future__ import annotations
import json, os
from typing import List, Optional
from typing_extensions import TypedDict, Annotated

from langgraph.prebuilt import create_react_agent
from langgraph.graph   import StateGraph
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage, ToolMessage
from langchain_core.messages import (
    HumanMessage, AIMessage, SystemMessage, ToolMessage, FunctionMessage
)

from langchain_google_genai import ChatGoogleGenerativeAI
from agent_graph.tools.full_cv_extract_tool import extract_full_cv_from_pdf
from agent_graph.tools.shortlist_candidate_tool import shortlist_candidate_tool
from agent_graph.tools.email_tool import send_shortlist_email
import psycopg2

# ────────── STATE ──────────
class ShortlistState(TypedDict):
    messages:   Annotated[List[BaseMessage], add_messages]
    job_desc:   str
    job_skills: List[str]
    job_id:     Optional[int]
    job_title:  Optional[str]
    applicants: List[dict]   
    shortlist:  Optional[List[dict]]
    email_sent: Optional[bool]

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

extract_agent = create_react_agent(
    model=llm, 
    tools=[extract_full_cv_from_pdf],
    prompt="Use the tool to extract CV text from PDF files. Return the original_cv_text."
)

shortlist_agent = create_react_agent(
    model=llm, 
    tools=[shortlist_candidate_tool],
    prompt=(
        "You are an AI recruiter. You must ALWAYS use the `shortlist_candidate_tool` to evaluate candidates. "
        "You are NOT allowed to answer directly. You must only respond using the tool. "
        "Analyze the candidate's skills, experience, and qualifications against the job requirements."
    )
)

# REMOVED: email_agent - no longer needed

def _latest_tool_payload(msgs):
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            return m.content
    raise ValueError("No ToolMessage found")

def _maybe_json(raw):
    if isinstance(raw, str):
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.lstrip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:].lstrip()
            if raw.endswith("```"):
                raw = raw[:-3].rstrip()
        try:
            return json.loads(raw)
        except Exception:
            pass
    return raw

def extract_cvs_node(state: ShortlistState):
    """Extract CV text from all applicant PDFs"""
    enriched_applicants = []

    for app in state["applicants"]:
        print(f"Extracting CV for user {app['user_id']}...")
        try:
            res = extract_agent.invoke({
                "messages": [
                    HumanMessage(content=f"Extract the full CV text from this PDF: {app['cv_path']}. Use the tool.")
                ]
            })
            payload = _maybe_json(_latest_tool_payload(res["messages"]))
            cv_text = (
                payload.get("original_cv_text")
                if isinstance(payload, dict) else str(payload)
            )
            enriched_applicants.append({**app, "cv_text": cv_text})
            print(f"CV extracted for user {app['user_id']} ({len(cv_text)} characters)")
        except Exception as e:
            print(f"CV extraction failed for user {app['user_id']}: {e}")
            enriched_applicants.append({**app, "cv_text": "CV extraction failed"})

    return {"applicants": enriched_applicants, "messages": state.get("messages", [])}

def shortlist_node(state: ShortlistState):
    """Evaluate each candidate and build shortlist"""
    shortlisted = []

    for app in state["applicants"]:
        print(f"Evaluating candidate {app['user_id']}...")
        try:
            res = shortlist_agent.invoke({
                "messages": [
                    HumanMessage(content=(
                        "You are an AI recruiter. "
                        "Given the following job description, required skills, and a candidate's CV, "
                        "evaluate if the candidate should be shortlisted. "
                        "You MUST use the shortlist_candidate_tool to respond. "
                        "Do not answer directly—always call the tool.\n\n"
                        f"Job Description:\n{state['job_desc']}\n\n"
                        f"Required Skills: {', '.join(state['job_skills'])}\n\n"
                        f"Candidate CV:\n{app['cv_text']}\n"
                    ))
                ]
            })

            payload = _maybe_json(_latest_tool_payload(res["messages"]))
            score = payload.get("score", 0)
            decision = payload.get("decision", "REJECT")
            justification = payload.get("justification", "")
            
            print(f"Candidate {app['user_id']}: {decision} (Score: {score})")
            
            if decision.upper() == "SHORTLIST":
                shortlisted.append({
                    "user_id": app["user_id"],
                    "user_name": app.get("user_name", "Unknown"),
                    "score": score,
                    "justification": justification
                })
        except Exception as e:
            print(f" Evaluation failed for user {app['user_id']}: {e}")

    print(f"Final shortlist: {len(shortlisted)} candidates")
    return {"shortlist": shortlisted, "messages": state.get("messages", [])}

def send_email_node(state: ShortlistState):
    """Send email notification to interviewers - DIRECT FUNCTION CALL (NO AI)"""
    if not state.get("shortlist") or len(state["shortlist"]) == 0:
        print("No candidates shortlisted, skipping email")
        return {"email_sent": False, "messages": state.get("messages", [])}
    
    try:
        # DIRECT FUNCTION CALL - NO AI AGENT NEEDED
        job_title = state.get('job_title', 'Backend Developer')
        job_id = state.get('job_id', 1)
        job_description = state['job_desc']
        shortlisted_candidates = json.dumps(state["shortlist"])
        
        # Call the email function directly
        result = send_shortlist_email(
            job_title=job_title,
            job_id=job_id,
            shortlisted_candidates=shortlisted_candidates,
            job_description=job_description
        )
        
        email_success = result.get("success", False)
        print(f"Email sending result: {result}")

        # Save to database regardless of email success
        save_shortlist_email_to_db(
            job_id=job_id,
            job_title=job_title,
            shortlisted_count=len(state["shortlist"])
        )
        
        return {"email_sent": email_success, "messages": state.get("messages", [])}
        
    except Exception as e:
        print(f"Email error: {e}")
        return {"email_sent": False, "messages": state.get("messages", [])}



def save_shortlist_email_to_db(job_id: int, job_title: str, shortlisted_count: int):
    """Save shortlist email info to database for background scheduler tracking"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST", "db"),
            database=os.getenv("DB_NAME", "main"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", "password"),
            port=os.getenv("DB_PORT", "5432"),
        )
        
        with conn.cursor() as cur:
            # ✅ FIXED: Use the correct column names that match existing table
            cur.execute("""
                INSERT INTO devconnect.sent_emails 
                (job_id, to_email, subject, body, sent_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, [
                job_id,
                "muheetrahi@gmail.com",  # Match the actual email being sent
                f"New Shortlisted Candidates for {job_title}",
                f"Shortlisted {shortlisted_count} candidates for {job_title} position (Job ID: {job_id})"
            ])
            
            conn.commit()
            print(f"✅ Saved shortlist email info to database for job {job_id}")
            
    except Exception as e:
        print(f"❌ Failed to save email info to database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()


# ────────── Graph ──────────
builder = StateGraph(ShortlistState)
builder.add_node("extract_cvs", extract_cvs_node)
builder.add_node("make_shortlist", shortlist_node)
builder.add_node("send_email", send_email_node) 

builder.set_entry_point("extract_cvs")
builder.add_edge("extract_cvs", "make_shortlist")
builder.add_edge("make_shortlist", "send_email")
builder.set_finish_point("send_email")

shortlist_graph = builder.compile()


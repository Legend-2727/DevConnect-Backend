"""
Select whether a candidate should be SHORTLISTED for a job and why.
Return *JSON only* in the following schema:

{
  "score":        float,   // 0-100 overall fit
  "decision":     "SHORTLIST" | "REJECT",
  "justification":"..."
}
"""
from typing_extensions import TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools    import tool
from pydantic import BaseModel
from typing import List

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.2)

class ShortlistArgs(BaseModel):
    job_description: str
    job_skills: List[str]
    candidate_cv: str

@tool("shortlist_candidate", args_schema=ShortlistArgs, return_direct=True)
def shortlist_candidate_tool(job_description, job_skills, candidate_cv):
    """
    Shortlists a candidate based on the provided name.
    """
    prompt = f"""
You are a technical recruiter.  

**Job-description (markdown)**  
{job_description}

**Must-have skills**: {', '.join(job_skills) if job_skills else 'N/A'}

**Candidate CV (raw text)**  
{candidate_cv}

Step 1 → score the candidate 0-100 for overall fit  
Step 2 → if score ≥ 65 ⇒ decision = SHORTLIST else REJECT  
Step 3 → give a one-sentence justification  

Reply **only** valid JSON.
"""

    response = llm.invoke(prompt).content.strip()
    return response                # Graph helper will JSON-parse it

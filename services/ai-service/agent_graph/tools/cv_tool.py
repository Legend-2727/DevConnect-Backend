
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

@tool
def modify_cv_for_role(original_cv_text: str, role: str) -> dict:
    """
    Rewrite the candidate's CV to match the given backend role.
    Returns: {"improved_cv_text": "..."}
    """
    prompt = f"""
You are an expert CV writer.
Rephrase and enhance the candidate's CV to align with the target role of {role}.
Do not invent experience or skills—only improve wording, summary, skills, and structure.

---
Original CV:
{original_cv_text}
---

Return ONLY the improved CV text.
"""
    response = llm.invoke(prompt)          # ← synchronous
    return {"improved_cv_text": response.content.strip()}


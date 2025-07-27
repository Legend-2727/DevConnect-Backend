from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

@tool
async def shortlist_users(job_description: str, user_profiles: list) -> dict:
    """
    Uses AI to shortlist users for a job.
    """
    prompt = f"""
You are an AI recruiter. Based on the job description below, select the most relevant candidates.

Job:
{job_description}

Candidates:
{user_profiles}

Return a list of user IDs who best match the job requirements.
    """

    response = await llm.ainvoke(prompt)
    return {"recommended_user_ids": eval(response.content)}

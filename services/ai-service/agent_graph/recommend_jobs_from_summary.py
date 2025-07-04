from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from agent_graph.tools.job_tool import recommend_jobs_from_summary
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

recommend_agent = create_react_agent(
    model=llm,
    tools=[recommend_jobs_from_summary],
    prompt="""
    Use the user's summarized skill profile to recommend the most relevant jobs.
    """
)




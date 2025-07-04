from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from agent_graph.tools.full_cv_extract_tool import extract_full_cv_from_pdf
from dotenv import load_dotenv

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

summary_agent = create_react_agent(
    model=llm,
    tools=[extract_full_cv_from_pdf],
    prompt="""
    Use the tool to extract the full CV text from the provided PDF.
    Then summarize the candidate’s key skills, experience, and relevant qualifications in a clean paragraph or bullet list.
    Return the result in the `summary_text` field.
    """
)

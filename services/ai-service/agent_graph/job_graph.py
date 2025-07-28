from langgraph.graph import StateGraph
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict, Annotated
from typing import List, Optional
from langgraph.graph.message import add_messages
from agent_graph.tools.full_cv_extract_tool import extract_full_cv_from_pdf
from agent_graph.tools.job_tool import recommend_jobs_from_summary
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, ToolMessage, AIMessage

llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

summary_agent = create_react_agent(
    model=llm,
    tools=[extract_full_cv_from_pdf],
    prompt=(
        "You are an AI assistant. "
        "First, use the extract_full_cv_from_pdf tool to extract the full CV text. "
        "After extracting the CV, analyze it and create a concise summary highlighting: "
        "1) Key technical skills and technologies "
        "2) Years of experience and expertise level "
        "3) Most relevant work experience and achievements "
        "4) Educational background if relevant. "
        "Provide this summary in a clear, professional paragraph."
    )
)

recommend_agent = create_react_agent(
    model=llm,
    tools=[recommend_jobs_from_summary],
    prompt=(
        "You are an AI assistant. "
        "You must ALWAYS use the recommend_jobs_from_summary tool to recommend jobs. "
        "Do not answer directly—always call the tool."
    )
)

class CVRecommendationState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    cv_path: Optional[str]
    summary_text: Optional[str]
    recommended_jobs: Optional[List[int]]

def _latest_tool_payload(msgs):
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            return m.content
    raise ValueError("No ToolMessage found")

import json
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

def extract_summary_node(state: CVRecommendationState):
    # First directly extract the CV text using the tool function
    cv_result = extract_full_cv_from_pdf(state['cv_path'])
    
    if "error" in cv_result:
        print(f"ERROR: Failed to extract CV: {cv_result['error']}")
        return {
            **state,
            "summary_text": f"Error extracting CV: {cv_result['error']}",
            "messages": state.get("messages", [])
        }
    
    cv_text = cv_result["original_cv_text"]
    print(f"DEBUG: Successfully extracted CV text ({len(cv_text)} chars)")
    
    # Now have the agent create a summary from the extracted CV text
    res = summary_agent.invoke({
        "messages": [
            HumanMessage(content=(
                "The CV has already been extracted. Here is the full text:\n\n"
                f"{cv_text}\n\n"
                "Please analyze it and provide a comprehensive summary of the candidate's "
                "key skills, experience, and qualifications."
            ))
        ]
    })
    
    print("DEBUG: Messages from summary agent:")
    for i, m in enumerate(res["messages"]):
        print(f"{i}. {type(m).__name__}: {getattr(m, 'content', '')[:100]}...")
    
    # Look for the summary in the last AI message
    summary_text = None
    
    for m in reversed(res["messages"]):
        if isinstance(m, AIMessage) and m.content:
            summary_text = m.content.strip()
            break
    
    # Fallback to the original CV text if no summary was created
    if not summary_text:
        summary_text = f"CV extracted: {cv_text[:300]}..."
        print("DEBUG: No summary generated, using fallback")
    
    print(f"DEBUG: Final summary_text length: {len(summary_text)}")
    
    return {
        **state,
        "cv_text": cv_text,  # Store the raw CV text in the state
        "summary_text": summary_text,
        "messages": state.get("messages", [])
    }

def recommend_jobs_node(state: CVRecommendationState):
    res = recommend_agent.invoke({
        "messages": [
            HumanMessage(content=(
                "Use the recommend_jobs_from_summary tool to recommend relevant jobs. "
                f"Candidate summary: {state['summary_text']}"
            ))
        ]
    })
    
    print("DEBUG: Messages from recommend agent:")
    for i, m in enumerate(res["messages"]):
        print(f"{i}. {type(m).__name__}: {getattr(m, 'content', '')[:100]}...")
    
    payload = _maybe_json(_latest_tool_payload(res["messages"]))
    recommended_jobs = payload.get("recommended_jobs") if isinstance(payload, dict) else []
    
    print(f"DEBUG: Recommended jobs: {len(recommended_jobs)} jobs found")
    
    return {
        **state,
        "recommended_jobs": recommended_jobs,
        "messages": state.get("messages", [])  # Don't accumulate agent messages
    }

builder = StateGraph(CVRecommendationState)
builder.add_node("extract_summary", extract_summary_node)
builder.add_node("recommend_jobs", recommend_jobs_node)
builder.set_entry_point("extract_summary")
builder.add_edge("extract_summary", "recommend_jobs")
builder.set_finish_point("recommend_jobs")
cv_graph = builder.compile()
    

builder = StateGraph(CVRecommendationState)
builder.add_node("extract_summary", extract_summary_node)
builder.add_node("recommend_jobs", recommend_jobs_node)
builder.set_entry_point("extract_summary")
builder.add_edge("extract_summary", "recommend_jobs")
builder.set_finish_point("recommend_jobs")
cv_graph = builder.compile()

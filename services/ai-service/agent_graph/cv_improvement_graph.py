
"""
cv_improvement_graph.py   (patched version)
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

from agent_graph.tools.full_cv_extract_tool import extract_full_cv_from_pdf
from agent_graph.tools.cv_tool                import modify_cv_for_role
from agent_graph.tools.generate_pdf_from_text import generate_pdf_from_text

# ─────────────────────────────── State ────────────────────────────────
class CVImprovementState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    cv_path: Optional[str]
    original_cv_text: Optional[str]
    target_role: Optional[str]
    improved_cv_text: Optional[str]
    pdf_url: Optional[str]

# ─────────────────────────────── LLM & agents ─────────────────────────
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.3)

full_cv_agent  = create_react_agent(llm, [extract_full_cv_from_pdf],
    prompt="Use `extract_full_cv_from_pdf` to return raw text.")
improve_agent  = create_react_agent(llm, [modify_cv_for_role],
    prompt="Use `modify_cv_for_role` given `original_cv_text` + `target_role`.")
pdf_agent      = create_react_agent(llm, [generate_pdf_from_text],
    prompt="Use `generate_pdf_from_text` and return the URL.")

# ─────────────────────────────── helpers ──────────────────────────────
def _append(history, new_msgs):
    return history + [m for m in new_msgs if m not in history]

# def _latest_tool_payload(msgs: List[BaseMessage]) -> str:
#     """Return .content of the last ToolMessage."""
#     for m in reversed(msgs):
#         if isinstance(m, ToolMessage):
#             return m.content
#     raise ValueError("No ToolMessage found in this turn.")


import json
from langchain_core.messages import ToolMessage

def _latest_tool_payload(msgs):
    """Return the .content of the last ToolMessage (string)."""
    for m in reversed(msgs):
        if isinstance(m, ToolMessage):
            return m.content
    raise ValueError("No ToolMessage found.")

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
        return data                       # entire dict or other JSON value
    except json.JSONDecodeError:
        # not JSON – just return the raw string
        return content


# ─────────────────────────────── nodes ────────────────────────────────
def extract_full_cv_node(state):
    res = full_cv_agent.invoke({
        "messages": state["messages"],
        "input":    state["cv_path"]
    })
    payload = _smart_payload(_latest_tool_payload(res["messages"]),
                             key_expected="original_cv_text")
    cv_text = payload if isinstance(payload, str) else str(payload)

    return {
        "original_cv_text": cv_text,
        "messages": state["messages"] + res["messages"]
    }

def rewrite_cv_node(state):
    res = improve_agent.invoke({
        "messages": state["messages"],
        "input": {
            "original_cv_text": state["original_cv_text"],
            "target_role":      state["target_role"]
        }
    })
    payload  = _smart_payload(_latest_tool_payload(res["messages"]),
                              key_expected="improved_cv_text")
    improved = payload if isinstance(payload, str) else str(payload)

    return {
        "improved_cv_text": improved,
        "messages": state["messages"] + res["messages"]
    }

def generate_pdf_node(state):
    res     = pdf_agent.invoke({
        "messages": state["messages"],
        "input":    state["improved_cv_text"]
    })
    # last ToolMessage content is already a URL string
    pdf_url = _latest_tool_payload(res["messages"])

    return {
        "pdf_url":  pdf_url,
        "messages": state["messages"] + res["messages"]
    }


# ─────────────────────────────── graph ────────────────────────────────
builder = StateGraph(CVImprovementState)
builder.add_node("extract_full_cv", extract_full_cv_node)
builder.add_node("rewrite_cv",      rewrite_cv_node)
builder.add_node("generate_pdf",    generate_pdf_node)

builder.set_entry_point("extract_full_cv")
builder.add_edge("extract_full_cv", "rewrite_cv")
builder.add_edge("rewrite_cv",      "generate_pdf")
builder.set_finish_point("generate_pdf")

cv_improvement_graph = builder.compile()

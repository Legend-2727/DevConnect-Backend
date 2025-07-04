import sys
import os
import json
from langchain_core.messages import (
    HumanMessage, AIMessage, SystemMessage, ToolMessage, FunctionMessage
)

# Add parent directory to path for proper import
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_graph.cv_improvement_graph import cv_improvement_graph

def run_cv_improvement_graph(user_id: str, cv_path: str, role: str) -> dict:
    initial_state = {
        "cv_path": cv_path,
        "target_role": role,
        "messages": [
            HumanMessage(content=f"""
            You are an expert CV assistant. A user (ID: {user_id}) has uploaded their CV located at:

            Path: {cv_path}

            Your goal is to:
            1. Extract a clean summary of the user's skills and experience using the file.
            2. Improve the CV to better match the target role: **{role}**
            3. Generate a new downloadable PDF of the improved CV.

            Please begin by reading the CV from the path above.
            """)
        ]
    }
    return cv_improvement_graph.invoke(initial_state)

def serialize(obj):
    if isinstance(obj, (HumanMessage, AIMessage, SystemMessage, ToolMessage, FunctionMessage)):
        return {
            "type": obj.__class__.__name__,
            "content": getattr(obj, "content", None),
            "tool_call_id": getattr(obj, "tool_call_id", None),
            "name": getattr(obj, "name", None)
        }
    elif isinstance(obj, list):
        return [serialize(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    else:
        return obj

# CLI entry point
if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("❌ Usage: python graph_runner_improve.py <user_id> <cv_path> <target_role>")
        sys.exit(1)

    user_id = sys.argv[1]
    cv_path = sys.argv[2]
    role = sys.argv[3]

    try:
        result = run_cv_improvement_graph(user_id, cv_path, role)
        print(json.dumps(serialize(result)))
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


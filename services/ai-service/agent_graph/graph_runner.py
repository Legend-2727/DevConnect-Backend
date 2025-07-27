
import sys
import os
import json
from langchain_core.messages import HumanMessage,AIMessage, SystemMessage,ToolMessage, FunctionMessage

# Make sure parent path is added so agent_graph is importable
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent_graph.job_graph import cv_graph  # Now this works correctly

def run_cv_graph(user_id: int, cv_path: str) -> dict:
    initial_state = {
        "cv_path": cv_path,
        "messages": [HumanMessage(content=f"Process CV at {cv_path} and recommend jobs for user {user_id}")]
    }

    return cv_graph.invoke(initial_state)



if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("❌ Usage: python graph_runner.py <user_id> <cv_path>")
        sys.exit(1)

    user_id = int(sys.argv[1])
    cv_path = sys.argv[2]

    result = run_cv_graph(user_id, cv_path)
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

    print(json.dumps(serialize(result)))

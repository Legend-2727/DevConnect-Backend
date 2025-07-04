
"""
CLI helper so company-service can do:
`python3 graph_runner_shortlist.py <job_json_payload>`
"""
import json, sys, os
from agent_graph.shortlist_graph import shortlist_graph

if __name__ == "__main__":
    payload = json.loads(sys.argv[1])      
    result  = shortlist_graph.invoke({
        "messages":   [],
        "job_desc":   payload["job_desc"],
        "job_skills": payload.get("job_skills", []),
        "applicants": payload["applicants"]
    })
    print(json.dumps({"shortlist": result["shortlist"]}))

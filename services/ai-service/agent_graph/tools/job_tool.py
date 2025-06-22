import psycopg2
import os
import re
from langchain_core.tools import tool
from collections import Counter

def fetch_jobs_from_db():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        database=os.getenv("DB_NAME", "main"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASS", "password"),
        port=os.getenv("DB_PORT", "5432"),
    )
    with conn.cursor() as cur:
        cur.execute("SELECT id, title, description, skills FROM devconnect.jobs WHERE is_active = TRUE")
        rows = cur.fetchall()
    conn.close()
    return rows

def extract_key_terms(text):
    """Extract potential skill terms from text using patterns"""
    text_lower = text.lower()
    
    # Extract technical terms (alphanumeric + common chars)
    technical_terms = set()
    
    # 1. Camelcase/PascalCase terms (React, Node.js, PostgreSQL)
    camel_pattern = r'\b[A-Z][a-z]+(?:[A-Z][a-z]*)*\b'
    technical_terms.update(re.findall(camel_pattern, text))
    
    # 2. Terms with dots/hyphens (Node.js, CI/CD, Spring-Boot)
    dotted_pattern = r'\b[a-zA-Z]+[.\-/][a-zA-Z]+(?:[.\-/][a-zA-Z]+)*\b'
    technical_terms.update(re.findall(dotted_pattern, text))
    
    # 3. Uppercase abbreviations (REST, API, SQL, AWS)
    abbrev_pattern = r'\b[A-Z]{2,}\b'
    technical_terms.update(re.findall(abbrev_pattern, text))
    
    # 4. Common tech terms (longer than 2 chars, avoid common words)
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text_lower)
    
    
    common_words = {
        'the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'they', 'been',
        'have', 'had', 'what', 'were', 'said', 'each', 'which', 'their', 'time',
        'will', 'about', 'if', 'up', 'out', 'many', 'then', 'them', 'can', 'only',
        'other', 'new', 'some', 'could', 'way', 'these', 'may', 'than', 'first',
        'been', 'call', 'who', 'oil', 'sit', 'now', 'find', 'long', 'down',
        'day', 'did', 'get', 'come', 'made', 'part', 'over', 'think', 'where',
        'much', 'system', 'those', 'both', 'take', 'your', 'work', 'life',
        'building', 'using', 'including', 'following', 'experience', 'years',
        'engineer', 'developer', 'candidate', 'skills', 'technologies'
    }
    
    tech_words = [word for word in words if word not in common_words and len(word) > 2]
    technical_terms.update(tech_words)
    
    return [term.lower() for term in technical_terms if len(term) > 2]

@tool
def recommend_jobs_from_summary(summary_text: str) -> dict:
    """
    Recommends top matching jobs using dynamic skill extraction and TF-IDF-like scoring.
    """
    jobs = fetch_jobs_from_db()
    
    # Extract candidate's key terms
    candidate_terms = extract_key_terms(summary_text)
    print(f"DEBUG: Extracted candidate terms: {candidate_terms[:15]}...")
    
    # Count term frequency in candidate profile
    candidate_term_counts = Counter(candidate_terms)
    
    scored_jobs = []
    
    for job_id, title, desc, skills_array in jobs:
        # Combine all job text
        job_skills_text = ' '.join(skills_array) if skills_array else ''
        job_full_text = f"{title} {desc} {job_skills_text}"
        
        # Extract job terms
        job_terms = extract_key_terms(job_full_text)
        job_term_counts = Counter(job_terms)
        
        # Calculate different types of matches
        score = 0
        exact_matches = 0
        skill_matches = 0
        
        # 1. Exact term matches (case-insensitive)
        for term, count in candidate_term_counts.items():
            if term in job_terms:
                exact_matches += 1
                # Weight by frequency in candidate profile
                term_score = count * 2
                
                # Extra weight if term appears in job skills array
                if skills_array and any(term in skill.lower() for skill in skills_array):
                    term_score *= 3
                    skill_matches += 1
                
                # Extra weight if term appears in job title
                if term in title.lower():
                    term_score *= 2
                
                score += term_score
        
        # 2. Fuzzy/partial matches for compound terms
        for candidate_term in candidate_terms:
            if len(candidate_term) > 4:  # Only for longer terms
                for job_term in job_terms:
                    if candidate_term != job_term and candidate_term in job_term:
                        score += 1
                    elif job_term in candidate_term:
                        score += 1
        
        # 3. Role type bonus
        role_keywords = {
            'backend': ['backend', 'server', 'api'],
            'frontend': ['frontend', 'client', 'ui', 'ux'],
            'fullstack': ['fullstack', 'full-stack', 'full stack'],
            'data': ['data', 'analytics', 'science'],
            'devops': ['devops', 'infrastructure', 'deployment'],
            'mobile': ['mobile', 'android', 'ios', 'app']
        }
        
        candidate_lower = summary_text.lower()
        job_lower = job_full_text.lower()
        
        for role_type, keywords in role_keywords.items():
            candidate_has_role = any(kw in candidate_lower for kw in keywords)
            job_has_role = any(kw in job_lower for kw in keywords)
            
            if candidate_has_role and job_has_role:
                score += 10
                break
        
        # 4. Calculate relevance ratio
        total_candidate_terms = len(set(candidate_terms))
        relevance_ratio = exact_matches / total_candidate_terms if total_candidate_terms > 0 else 0
        
        # Boost score based on relevance ratio
        score += relevance_ratio * 20
        
        scored_jobs.append((score, exact_matches, skill_matches, relevance_ratio, {
            "id": job_id,
            "title": title,
            "description": desc,
            "skills": skills_array,
            "match_score": round(score, 2),
            "exact_matches": exact_matches,
            "skill_matches": skill_matches,
            "relevance_ratio": round(relevance_ratio, 3)
        }))
    
    # Sort by: score (desc), exact matches (desc), skill matches (desc), relevance ratio (desc)
    scored_jobs.sort(key=lambda x: (x[0], x[1], x[2], x[3]), reverse=True)
    
    # Take top 5 jobs with score > 0
    top_jobs = [job for score, _, _, _, job in scored_jobs if score > 0][:5]
    
    print("DEBUG: Top job scores:")
    for job in top_jobs[:3]:
        print(f"  {job['title']}: score={job['match_score']}, exact={job['exact_matches']}, skills={job['skill_matches']}")
    
    return {"recommended_jobs": top_jobs}

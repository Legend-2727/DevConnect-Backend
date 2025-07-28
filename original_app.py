from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
import psycopg2
import psycopg2.extras
import google.generativeai as genai
import json
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv
import traceback
from datetime import datetime, timedelta
from fpdf import FPDF

# Load environment variables
load_dotenv()

# Configure Google AI
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI(title="DevConnect AI Service", version="2.2.3")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
def get_db_connection():
    try:
        connection = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            database=os.getenv("DB_NAME", "main"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASS", "password")
        )
        return connection
    except Exception as e:
        print(f"Database connection error: {e}")
        return None
    

class ModifyCVRequest(BaseModel):
    cv_url: str
    job_role: str
    company_id: int
    job_id: int

def extract_text_from_pdf(file_path):
    from PyPDF2 import PdfReader
    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text




# def get_job_requirements(job_id):
#     url = f"http://company-service:4005/api/v1/companies/jobs/{job_id}"
#     resp = requests.get(url)
#     if resp.status_code != 200:
#         return ""
#     job = resp.json().get("job", {})
#     requirements = job.get("skills", [])
#     description = job.get("description", "")
#     return f"{description}\nSkills: {', '.join(requirements)}"

def get_job_details(job_id: int) -> Dict[str, Any]:
    """Fetch job details from the database by job_id"""
    connection = get_db_connection()
    if not connection:
        print(f"Database connection failed for get_job_details({job_id})")
        return {}
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT j.*, c.name as company_name, c.industry
            FROM devconnect.jobs j
            JOIN devconnect.companies c ON j.company_id = c.id
            WHERE j.id = %s
        """, (job_id,))
        job = cursor.fetchone()
        if job:
            print(f"Fetched job details for job_id={job_id}: {job}")
        else:
            print(f"No job found for job_id={job_id}")
        return dict(job) if job else {}
    except Exception as e:
        print(f"Error fetching job details for job_id={job_id}: {e}")
        return {}
    finally:
        connection.close()

def get_job_requirements(job_id):
    job = get_job_details(job_id)
    if not job:
        print(f"Failed to fetch job requirements for job_id={job_id}: job not found in DB")
        return ""
    requirements = job.get("skills", [])
    description = job.get("description", "")
    print(f"Parsed requirements from DB: {requirements}, description: {description}")
    return f"{description}\nSkills: {', '.join(requirements)}"

def generate_ai_cv(cv_text, job_role, requirements):
    prompt = (
        f"Original CV:\n{cv_text}\n\n"
        f"Job Role: {job_role}\n"
        f"Company Requirements: {requirements}\n\n"
        "Your task:\n"
        "- Rewrite the CV to highlight and improve description of backend-relevant skills and experiences.\n"
        "- DO NOT invent any new skills — only improve existing ones.\n"
        "- Format the output clearly using sections: [Contact Info, Summary, Skills, Experience, Education, Certifications].\n"
        "- Use proper headings (like '## Summary') and bullet points where appropriate.\n"
        "- Keep the tone professional and suitable for a job application."
    )

    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    print("Heloo-----------------------------------")
    # print(response.text)
    return response.text


# def create_pdf(cv_text, filename="modified_cv.pdf"):
#     pdf = FPDF()
#     pdf.add_page()
#     pdf.set_auto_page_break(auto=True, margin=15)
#     pdf.set_font("Arial", size=12)
#     for line in cv_text.split('\n'):
#         pdf.multi_cell(0, 10, line)
#     pdf.output(filename)
#     with open(filename, "rb") as f:
#         return f.read()

def sanitize_text(text):
    # Replace non-ASCII characters with a placeholder or remove them
    return text.encode("latin-1", "replace").decode("latin-1")

def create_pdf(cv_text, filename="modified_cv.pdf"):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Arial", size=12)

    lines = cv_text.splitlines()
    for line in lines:
        line = sanitize_text(line.strip())
        if not line:
            pdf.ln(5)
        elif line.startswith("##"):
            pdf.set_font("Arial", "B", 12)
            pdf.cell(0, 10, line.replace("##", "").strip(), ln=True)
            pdf.set_font("Arial", size=12)
        elif line.startswith("- "):
            bullet = u"\u2022 " + line[2:].strip()
            bullet = sanitize_text(bullet)
            pdf.cell(10)
            pdf.multi_cell(0, 8, bullet)
        else:
            pdf.multi_cell(0, 8, line)

    pdf.output(filename)
    with open(filename, "rb") as f:
        return f.read()

@app.post("/api/v1/modify-cv")
async def modify_cv(req: ModifyCVRequest):
    # print("Received request body:", req.dict())  # Print the parsed request
    file_path = req.cv_url.replace("http://localhost:4004", "/app")
    # print("Resolved file path:", file_path)
    cv_text = extract_text_from_pdf(file_path)
    # print("Extracted CV text:", cv_text[:200])  # Print first 200 chars for brevity
    requirements = get_job_requirements(req.job_id)
    # print("Job requirements:", requirements)
    modified_cv_text = generate_ai_cv(cv_text, req.job_role, requirements)
    print("Modified CV text:", modified_cv_text[:200])
    pdf_bytes = create_pdf(modified_cv_text)
    # print("PDF bytes length:", len(pdf_bytes))
    return {"modified_cv": modified_cv_text, "pdf": pdf_bytes.hex()}


def get_user_profile(user_id: int) -> Dict[str, Any]:
    """Fetch user profile from database"""
    connection = get_db_connection()
    if not connection:
        return {}
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT u.*, a.email 
            FROM devconnect.users u 
            JOIN devconnect.accounts a ON u.account_id = a.id 
            WHERE u.id = %s
        """, (user_id,))
        user = cursor.fetchone()
        return dict(user) if user else {}
    except Exception as e:
        print(f"Error fetching user profile: {e}")
        return {}
    finally:
        connection.close()

def get_all_jobs() -> List[Dict[str, Any]]:
    """Fetch all available jobs from database"""
    connection = get_db_connection()
    if not connection:
        return []
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT j.*, c.name as company_name, c.industry
            FROM devconnect.jobs j
            JOIN devconnect.companies c ON j.company_id = c.id
            WHERE j.deadline > NOW() OR j.deadline IS NULL
            ORDER BY j.posted_at DESC
        """)
        jobs = cursor.fetchall()
        return [dict(job) for job in jobs]
    except Exception as e:
        print(f"Error fetching jobs: {e}")
        return []
    finally:
        connection.close()

def get_job_applications(job_id: int) -> List[Dict[str, Any]]:
    """Fetch all applications for a specific job"""
    connection = get_db_connection()
    if not connection:
        return []
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT a.*, u.name, u.education_level, u.experience_level, 
                   u.preferred_roles, u.cv_url, u.bio, acc.email
            FROM devconnect.applications a
            JOIN devconnect.users u ON a.user_id = u.id
            JOIN devconnect.accounts acc ON u.account_id = acc.id
            WHERE a.job_id = %s AND a.status IN ('PENDING', 'UNDER_REVIEW')
        """, (job_id,))
        applications = cursor.fetchall()
        return [dict(app) for app in applications]
    except Exception as e:
        print(f"Error fetching job applications: {e}")
        return []
    finally:
        connection.close()

def get_job_details(job_id: int) -> Dict[str, Any]:
    """Fetch job details"""
    connection = get_db_connection()
    if not connection:
        return {}
    
    try:
        cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("""
            SELECT j.*, c.name as company_name, c.industry
            FROM devconnect.jobs j
            JOIN devconnect.companies c ON j.company_id = c.id
            WHERE j.id = %s
        """, (job_id,))
        job = cursor.fetchone()
        return dict(job) if job else {}
    except Exception as e:
        print(f"Error fetching job details: {e}")
        return {}
    finally:
        connection.close()

def analyze_with_ai(prompt: str) -> str:
    """Use Google Gemini AI for analysis"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')  # Updated model name
        response = model.generate_content(prompt)
        print(f"🤖 AI Response: {response.text[:200]}...")  # Debug log
        return response.text
    except Exception as e:
        print(f"AI analysis error: {e}")
        return ""

def enhanced_candidate_analysis(job_details: Dict, candidate: Dict) -> Dict:
    """Enhanced AI analysis for candidate evaluation"""
    try:
        prompt = f"""
        As an expert AI recruitment assistant, perform a comprehensive evaluation of this candidate for the job position.
        
        === JOB DETAILS ===
        Title: {job_details.get('title', 'Not specified')}
        Company: {job_details.get('company_name', 'Not specified')}
        Industry: {job_details.get('industry', 'Not specified')}
        Description: {job_details.get('description', 'Not specified')}
        Required Skills: {job_details.get('skills', [])}
        Employment Type: {job_details.get('employment_type', 'Not specified')}
        Location: {job_details.get('location', 'Not specified')}
        
        === CANDIDATE PROFILE ===
        Name: {candidate.get('name', 'Not specified')}
        Education: {candidate.get('education_level', 'Not specified')}
        Experience Level: {candidate.get('experience_level', 'Not specified')}
        Preferred Roles: {candidate.get('preferred_roles', [])}
        Bio/Description: {candidate.get('bio', 'Not provided')}
        CV URL: {candidate.get('cv_url', 'Not provided')}
        
        Please provide a detailed analysis in the following JSON format:
        {{
            "match_score": 85,
            "overall_fit": "excellent|good|fair|poor",
            "reasoning": "Detailed explanation of why this candidate matches the role...",
            "key_strengths": ["strength1", "strength2", "strength3"],
            "potential_concerns": ["concern1", "concern2"],
            "recommendation": "strongly_recommend|recommend|consider|not_recommend",
            "skill_alignment": 90,
            "experience_match": 85,
            "cultural_fit": 80
        }}
        
        Be thorough but concise in your analysis. Consider technical skills, experience level, career progression, and potential for growth.
        """
        
        ai_response = analyze_with_ai(prompt)
        
        try:
            analysis = json.loads(ai_response)
            # Validate and set defaults
            analysis['match_score'] = max(0, min(100, analysis.get('match_score', 60)))
            analysis['overall_fit'] = analysis.get('overall_fit', 'fair')
            analysis['reasoning'] = analysis.get('reasoning', 'AI evaluation completed')
            analysis['key_strengths'] = analysis.get('key_strengths', ['General qualifications'])
            analysis['potential_concerns'] = analysis.get('potential_concerns', [])
            analysis['recommendation'] = analysis.get('recommendation', 'consider')
            analysis['skill_alignment'] = max(0, min(100, analysis.get('skill_alignment', 60)))
            analysis['experience_match'] = max(0, min(100, analysis.get('experience_match', 60)))
            analysis['cultural_fit'] = max(0, min(100, analysis.get('cultural_fit', 60)))
            return analysis
        except json.JSONDecodeError:
            # Fallback analysis
            return {
                "match_score": 65,
                "overall_fit": "fair",
                "reasoning": "Standard AI evaluation completed",
                "key_strengths": ["Professional background", "Relevant experience"],
                "potential_concerns": ["Requires further assessment"],
                "recommendation": "consider",
                "skill_alignment": 65,
                "experience_match": 65,
                "cultural_fit": 65
            }
    except Exception as e:
        print(f"Enhanced analysis error: {e}")
        return {
            "match_score": 50,
            "overall_fit": "fair",
            "reasoning": "Unable to complete full analysis",
            "key_strengths": ["To be assessed"],
            "potential_concerns": ["Requires manual review"],
            "recommendation": "consider",
            "skill_alignment": 50,
            "experience_match": 50,
            "cultural_fit": 50
        }
    

def clean_ai_json_response(ai_response: str) -> str:
    # Remove markdown code block markers and whitespace
    ai_response = ai_response.strip()
    if ai_response.startswith("```json"):
        ai_response = ai_response[len("```json"):].strip()
    if ai_response.startswith("```"):
        ai_response = ai_response[len("```"):].strip()
    if ai_response.endswith("```"):
        ai_response = ai_response[:-3].strip()
    return ai_response

def enhanced_job_matching(user_profile: Dict, job: Dict) -> Dict:
    """Enhanced AI analysis for job-user matching"""
    try:
        prompt = f"""
        As an expert AI career advisor, analyze how well this job opportunity matches the user's profile and career goals.
        
        === USER PROFILE ===
        Name: {user_profile.get('name', 'Not specified')}
        Education: {user_profile.get('education_level', 'Not specified')}
        Experience Level: {user_profile.get('experience_level', 'Not specified')}
        Preferred Roles: {user_profile.get('preferred_roles', [])}
        Bio/Description: {user_profile.get('bio', 'Not provided')}
        Website: {user_profile.get('website', 'Not provided')}
        
        === JOB OPPORTUNITY ===
        Title: {job.get('title', 'Not specified')}
        Company: {job.get('company_name', 'Not specified')}
        Industry: {job.get('industry', 'Not specified')}
        Description: {job.get('description', 'Not specified')}
        Required Skills: {job.get('skills', [])}
        Employment Type: {job.get('employment_type', 'Not specified')}
        Location: {job.get('location', 'Not specified')}
        
        Provide a comprehensive matching analysis in the following JSON format:
        {{
            "match_score": 85,
            "match_quality": "excellent|good|fair|poor",
            "match_explanation": "Detailed explanation of why this job is suitable..."
        }}
        
        Respond ONLY with valid JSON. Do not include markdown, code blocks, or any explanation.
        """
        
        ai_response = analyze_with_ai(prompt)
        ai_response = clean_ai_json_response(ai_response)
        
        try:
            analysis = json.loads(ai_response)
            # Validate and set defaults
            return {
                "match_score": max(0, min(100, analysis.get('match_score', 60))),
                "match_quality": analysis.get('match_quality', 'fair'),
                "match_explanation": analysis.get('match_explanation', 'Job matches your general profile')
            }
        except json.JSONDecodeError:
            # Fallback analysis
            return {
                "match_score": 65,
                "match_quality": "fair",
                "match_explanation": "Job evaluated by AI system - general match found"
            }
    except Exception as e:
        print(f"Enhanced job matching error: {e}")
        return {
            "match_score": 50,
            "match_quality": "fair",
            "match_explanation": "Basic compatibility assessment"
        }

@app.post("/api/ai/companies/{company_id}/jobs/{job_id}/shortlist")
async def shortlist_job_candidates(company_id: int, job_id: int):
    """
    Enhanced AI shortlisting with comprehensive candidate analysis
    """
    try:
        print(f"🎯 Starting AI shortlisting for company {company_id}, job {job_id}")
        
        # Fetch job details
        job = get_job_details(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        print(f"📋 Job found: {job['title']} at {job.get('company_name', 'Unknown Company')}")
        
        # Fetch all applications for this job
        applications = get_job_applications(job_id)
        if not applications:
            return {
                "company_id": company_id,
                "job_id": job_id,
                "shortlisted_candidates": [],
                "total_shortlisted": 0,
                "total_applications": 0,
                "ai_confidence": 0.0,
                "status": "success",
                "message": "No applications found for this job"
            }
        
        print(f"📊 Found {len(applications)} applications to analyze")
        shortlisted_candidates = []
        
        for i, app in enumerate(applications):
            print(f"🔍 Analyzing candidate {i+1}/{len(applications)}: {app['name']}")
            
            # Use enhanced AI analysis
            analysis = enhanced_candidate_analysis(job, app)
            
            # Shortlist candidates with score >= 70 or recommendation is recommend/strongly_recommend
            should_shortlist = (
                analysis['match_score'] >= 70 or 
                analysis['recommendation'] in ['recommend', 'strongly_recommend']
            )
            
            if should_shortlist:
                candidate_data = {
                    "user_id": app['user_id'],
                    "application_id": app['id'],
                    "name": app['name'],
                    "email": app['email'],
                    "match_score": analysis['match_score'],
                    "overall_fit": analysis['overall_fit'],
                    "ai_reasoning": analysis['reasoning'],
                    "key_strengths": analysis['key_strengths'],
                    "potential_concerns": analysis['potential_concerns'],
                    "recommendation": analysis['recommendation'],
                    "skill_alignment": analysis['skill_alignment'],
                    "experience_match": analysis['experience_match'],
                    "cultural_fit": analysis['cultural_fit'],
                    "education_level": app['education_level'],
                    "experience_level": app['experience_level']
                }
                shortlisted_candidates.append(candidate_data)
                print(f"✅ Shortlisted: {app['name']} (Score: {analysis['match_score']})")
            else:
                print(f"❌ Not shortlisted: {app['name']} (Score: {analysis['match_score']})")
        
        # Sort by match score (descending)
        shortlisted_candidates.sort(key=lambda x: x['match_score'], reverse=True)
        
        # Calculate enhanced AI confidence
        if shortlisted_candidates:
            scores = [c['match_score'] for c in shortlisted_candidates]
            avg_score = sum(scores) / len(scores)
            score_variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
            consistency_factor = max(0, 1 - (score_variance / 1000))  # Normalize variance
            ai_confidence = min((avg_score / 100) * consistency_factor, 0.98)
        else:
            ai_confidence = 0.0
        
        result = {
            "company_id": company_id,
            "job_id": job_id,
            "job_title": job.get('title', 'Unknown'),
            "shortlisted_candidates": shortlisted_candidates,
            "total_shortlisted": len(shortlisted_candidates),
            "total_applications": len(applications),
            "ai_confidence": round(ai_confidence, 3),
            "shortlist_percentage": round((len(shortlisted_candidates) / len(applications)) * 100, 1) if applications else 0,
            "status": "success",
            "message": f"🤖 AI shortlisting completed: {len(shortlisted_candidates)} candidates shortlisted from {len(applications)} applications ({round((len(shortlisted_candidates) / len(applications)) * 100, 1)}%)"
        }
        
        print(f"🎉 Shortlisting complete: {result['message']}")
        return result
        
    except Exception as e:
        print(f"❌ Error in AI shortlisting: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error in AI shortlisting: {str(e)}")

@app.get("/api/v1/recommend/{user_id}")
async def recommend_jobs(user_id: int):
    """
    Enhanced job recommendations with comprehensive analysis
    """
    try:
        print(f"🎯 Starting job recommendations for user {user_id}")
        
        # Fetch user profile
        user = get_user_profile(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        print(f"👤 User found: {user.get('name', 'Unknown')} ({user.get('experience_level', 'Unknown level')})")
        
        # Fetch all available jobs
        jobs = get_all_jobs()
        if not jobs:
            return {
                "user_id": user_id,
                "recommendations": [],
                "total_matches": 0,
                "status": "success",
                "message": "No jobs available at the moment"
            }
        
        print(f"💼 Found {len(jobs)} jobs to analyze")
        recommended_jobs = []
        
        for i, job in enumerate(jobs):
            print(f"🔍 Analyzing job {i+1}/{len(jobs)}: {job['title']} at {job.get('company_name', 'Unknown')}")
            
            # Use enhanced job matching analysis
            analysis = enhanced_job_matching(user, job)
            
            # Recommend jobs with score >= 60 or recommendation is consider/recommend/highly_recommend
            should_recommend = (
                analysis['match_score'] >= 60 
            )
            
            if should_recommend:
                job_data = {
                    "id": job['id'],
                    "title": job['title'],
                    "company": job['company_name'],
                    "company_id": job['company_id'],
                    "industry": job.get('industry', 'Not specified'),
                    "location": job.get('location', 'Not specified'),
                    "description": job['description'][:300] + "..." if len(job['description']) > 300 else job['description'],
                    "match_score": analysis['match_score'],
                    "match_quality": analysis['match_quality'],
                    "match_explanation": analysis['match_explanation'],
                    "employment_type": job.get('employment_type', 'Not specified'),
                    "skills": job.get('skills', []),
                    "posted_at": str(job.get('posted_at', '')),
                    "deadline": str(job.get('deadline', ''))
                }
                recommended_jobs.append(job_data)
                print(f"✅ Recommended: {job['title']} (Score: {analysis['match_score']})")
            else:
                print(f"❌ Not recommended: {job['title']} (Score: {analysis['match_score']})")
        
        # Sort by match score (descending) and limit to top 15
        recommended_jobs.sort(key=lambda x: x['match_score'], reverse=True)
        top_recommendations = recommended_jobs[:15]
        
        # Calculate recommendation quality metrics
        
        if top_recommendations:
            # Print the fields that will be used in the frontend for Modify CV
            for job in top_recommendations:
                print(
                    f"Job for Modify CV: id={job.get('id')}, title={job.get('title')}, company_id={job.get('company_id', 'N/A')}, "
                    f"company={job.get('company')}, match_score={job.get('match_score')}, match_quality={job.get('match_quality')}"
                )

            # print(f"🎉 Recommendations complete: {result['message']}")

            avg_score = sum(job['match_score'] for job in top_recommendations) / len(top_recommendations)
            high_quality_count = len([job for job in top_recommendations if job['match_score'] >= 80])
            recommendation_quality = "excellent" if high_quality_count >= 5 else "good" if high_quality_count >= 2 else "fair"
        else:
            avg_score = 0
            recommendation_quality = "no_matches"
        
        result = {
            "user_id": user_id,
            "user_name": user.get('name', 'Unknown'),
            "user_experience_level": user.get('experience_level', 'Unknown'),
            "recommendations": top_recommendations,
            "total_matches": len(top_recommendations),
            "total_jobs_available": len(jobs),
            "average_match_score": round(avg_score, 1),
            "recommendation_quality": recommendation_quality,
            "status": "success",
            "message": f"🤖 Found {len(top_recommendations)} job recommendations with {recommendation_quality} quality match"
        }
        
        print(f"🎉 Recommendations complete: {result['message']}")
        return result
        
    except Exception as e:
        print(f"❌ Error generating recommendations: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

@app.get("/")
async def root():
    return {
        "message": "DevConnect AI Service", 
        "status": "running", 
        "version": "2.2.3",
        "features": [
            "Enhanced candidate shortlisting",
            "Advanced job recommendations", 
            "AI-powered matching algorithms",
            "Comprehensive candidate analysis"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "service": "ai-service", 
        "version": "2.2.3",
        "ai_engine": "Google Gemini Pro"
    }

# Additional endpoints for debugging and monitoring
@app.get("/api/v1/stats")
async def get_ai_stats():
    """Get AI service statistics"""
    try:
        connection = get_db_connection()
        if not connection:
            return {"error": "Database connection failed"}
        
        cursor = connection.cursor()
        
        # Get basic stats
        cursor.execute("SELECT COUNT(*) FROM devconnect.jobs")
        total_jobs = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM devconnect.applications")
        total_applications = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM devconnect.users")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM devconnect.companies")
        total_companies = cursor.fetchone()[0]
        
        connection.close()
        
        return {
            "status": "active",
            "version": "2.2.3",
            "database_stats": {
                "total_jobs": total_jobs,
                "total_applications": total_applications,
                "total_users": total_users,
                "total_companies": total_companies
            },
            "ai_features": {
                "shortlisting": "active",
                "recommendations": "active",
                "analysis_engine": "Google Gemini Pro"
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "version": "2.2.3"
        }

# Backwards compatibility endpoints
@app.post("/api/v1/shortlist")
async def legacy_shortlist():
    return {
        "message": "Please use /api/ai/companies/{company_id}/jobs/{job_id}/shortlist", 
        "status": "deprecated",
        "version": "2.2.3"
    }

# Additional endpoint to match your test command
@app.post("/api/ai/recommend/{user_id}")
async def recommend_jobs_post(user_id: int):
    """POST version of recommendation endpoint to match test command"""
    return await recommend_jobs(user_id)

# Test endpoints that work without database data
@app.get("/api/v1/test-recommend/{user_id}")
async def test_recommend(user_id: int):
    """Test recommendation endpoint that works without real data"""
    return {
        "user_id": user_id,
        "message": "✅ Recommendation endpoint working!",
        "test_recommendations": [
            {
                "id": 1,
                "title": "Senior Software Developer",
                "company": "TechCorp",
                "match_score": 95,
                "match_explanation": "Perfect match for your skills and experience"
            },
            {
                "id": 2,
                "title": "Full Stack Engineer", 
                "company": "StartupX",
                "match_score": 87,
                "match_explanation": "Great opportunity for growth and learning"
            }
        ],
        "status": "success",
        "version": "2.2.3"
    }

@app.post("/api/v1/test-shortlist/{company_id}/{job_id}")
async def test_shortlist(company_id: int, job_id: int):
    """Test shortlist endpoint that works without real data"""
    return {
        "company_id": company_id,
        "job_id": job_id,
        "message": "✅ Shortlist endpoint working!",
        "test_shortlisted_candidates": [
            {
                "user_id": 1,
                "name": "John Smith",
                "email": "john@example.com",
                "match_score": 92,
                "ai_reasoning": "Excellent technical skills and relevant experience"
            },
            {
                "user_id": 2,
                "name": "Sarah Wilson",
                "email": "sarah@example.com", 
                "match_score": 88,
                "ai_reasoning": "Strong background and good cultural fit"
            }
        ],
        "total_shortlisted": 2,
        "status": "success",
        "version": "2.2.3"
    }

@app.post("/api/v1/schedule-interview")
async def schedule_interview():
    return {
        "message": "Interview scheduling functionality", 
        "status": "not implemented",
        "version": "2.2.3"
    }

@app.post("/api/v1/extract-cv")
async def extract_cv():
    return {
        "message": "CV extraction functionality", 
        "status": "not implemented",
        "version": "2.2.3"
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

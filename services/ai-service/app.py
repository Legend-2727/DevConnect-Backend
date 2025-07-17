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

# Load environment variables
load_dotenv()

# Configure Google AI
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI(title="DevConnect AI Service", version="2.2.3")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
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
            WHERE u.account_id = %s
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
            WHERE a.job_id = %s AND a.status = 'PENDING'
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
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(prompt)
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
            "match_explanation": "Detailed explanation of why this job is suitable...",
            "career_growth_potential": "high|medium|low",
            "skill_development_opportunities": ["skill1", "skill2"],
            "pros": ["advantage1", "advantage2", "advantage3"],
            "cons": ["concern1", "concern2"],
            "recommendation_strength": "highly_recommend|recommend|consider|not_recommend",
            "salary_expectation": "competitive|above_average|average|below_average"
        }}
        
        Focus on career alignment, growth potential, and long-term benefits for the user.
        """
        
        ai_response = analyze_with_ai(prompt)
        
        try:
            analysis = json.loads(ai_response)
            # Validate and set defaults
            analysis['match_score'] = max(0, min(100, analysis.get('match_score', 60)))
            analysis['match_quality'] = analysis.get('match_quality', 'fair')
            analysis['match_explanation'] = analysis.get('match_explanation', 'Job matches your general profile')
            analysis['career_growth_potential'] = analysis.get('career_growth_potential', 'medium')
            analysis['skill_development_opportunities'] = analysis.get('skill_development_opportunities', ['General skills'])
            analysis['pros'] = analysis.get('pros', ['Career opportunity'])
            analysis['cons'] = analysis.get('cons', ['Standard considerations'])
            analysis['recommendation_strength'] = analysis.get('recommendation_strength', 'consider')
            analysis['salary_expectation'] = analysis.get('salary_expectation', 'average')
            return analysis
        except json.JSONDecodeError:
            # Fallback analysis
            return {
                "match_score": 65,
                "match_quality": "fair",
                "match_explanation": "Job evaluated by AI system - general match found",
                "career_growth_potential": "medium",
                "skill_development_opportunities": ["To be determined"],
                "pros": ["Career opportunity", "Professional development"],
                "cons": ["Requires further evaluation"],
                "recommendation_strength": "consider",
                "salary_expectation": "average"
            }
    except Exception as e:
        print(f"Enhanced job matching error: {e}")
        return {
            "match_score": 50,
            "match_quality": "fair", 
            "match_explanation": "Basic compatibility assessment",
            "career_growth_potential": "medium",
            "skill_development_opportunities": ["To be assessed"],
            "pros": ["Professional opportunity"],
            "cons": ["Manual review recommended"],
            "recommendation_strength": "consider",
            "salary_expectation": "average"
        }

@app.get("/")
async def root():
    return {"message": "DevConnect AI Service", "status": "running", "version": "2.2.1"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-service", "version": "2.2.1"}

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
                analysis['match_score'] >= 60 or 
                analysis['recommendation_strength'] in ['consider', 'recommend', 'highly_recommend']
            )
            
            if should_recommend:
                job_data = {
                    "id": job['id'],
                    "title": job['title'],
                    "company": job['company_name'],
                    "industry": job.get('industry', 'Not specified'),
                    "location": job.get('location', 'Not specified'),
                    "description": job['description'][:300] + "..." if len(job['description']) > 300 else job['description'],
                    "match_score": analysis['match_score'],
                    "match_quality": analysis['match_quality'],
                    "match_explanation": analysis['match_explanation'],
                    "career_growth_potential": analysis['career_growth_potential'],
                    "skill_development_opportunities": analysis['skill_development_opportunities'],
                    "pros": analysis['pros'],
                    "cons": analysis['cons'],
                    "recommendation_strength": analysis['recommendation_strength'],
                    "salary_expectation": analysis['salary_expectation'],
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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="DevConnect AI Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "DevConnect AI Service", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-service"}

@app.post("/api/v1/shortlist")
async def shortlist_candidates():
    # Placeholder for AI shortlisting functionality
    return {"message": "AI shortlisting functionality", "status": "not implemented"}

@app.post("/api/ai/companies/{company_id}/jobs/{job_id}/shortlist")
async def shortlist_job_candidates(company_id: int, job_id: int):
    """
    AI shortlists candidates for a specific job
    """
    try:
        # In production, this would:
        # 1. Fetch job requirements from company service
        # 2. Fetch all applications for this job
        # 3. Analyze CVs and user profiles using AI/ML
        # 4. Rank candidates based on job fit
        # 5. Return top N candidates as shortlist
        
        # Mock shortlisted candidates for now
        shortlisted_candidates = [
            {
                "user_id": 2,
                "application_id": 101,
                "name": "John Doe",
                "email": "john.doe@email.com",
                "match_score": 95,
                "ai_reasoning": "Strong match: 5+ years React experience, previous startup experience, excellent problem-solving skills demonstrated in portfolio projects.",
                "key_strengths": ["React expertise", "Full-stack capabilities", "Leadership experience"]
            },
            {
                "user_id": 5,
                "application_id": 102,
                "name": "Sarah Johnson",
                "email": "sarah.johnson@email.com", 
                "match_score": 88,
                "ai_reasoning": "Good match: Solid technical foundation, strong communication skills, relevant project experience in similar domain.",
                "key_strengths": ["Technical skills", "Communication", "Domain knowledge"]
            },
            {
                "user_id": 8,
                "application_id": 103,
                "name": "Mike Chen",
                "email": "mike.chen@email.com",
                "match_score": 82,
                "ai_reasoning": "Potential match: Fresh graduate with strong academic record, impressive internship projects, eager to learn.",
                "key_strengths": ["Academic excellence", "Fresh perspective", "Learning agility"]
            }
        ]
        
        return {
            "company_id": company_id,
            "job_id": job_id,
            "shortlisted_candidates": shortlisted_candidates,
            "total_shortlisted": len(shortlisted_candidates),
            "ai_confidence": 0.87,
            "status": "success",
            "message": "AI shortlisting completed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in AI shortlisting: {str(e)}")

@app.post("/api/v1/schedule-interview")
async def schedule_interview():
    # Placeholder for interview scheduling functionality
    return {"message": "Interview scheduling functionality", "status": "not implemented"}

@app.post("/api/v1/extract-cv")
async def extract_cv():
    # Placeholder for CV extraction functionality
    return {"message": "CV extraction functionality", "status": "not implemented"}

@app.get("/api/v1/recommend/{user_id}")
async def recommend_jobs(user_id: int):
    """
    Recommend jobs for a specific user based on their profile
    """
    try:
        # Placeholder implementation - in production, this would:
        # 1. Fetch user profile from user service
        # 2. Fetch available jobs from company service
        # 3. Use AI/ML to match user profile with jobs
        # 4. Return ranked job recommendations
        
        # Mock recommended jobs for now
        recommended_jobs = [
            {
                "id": 1,
                "title": "Frontend Developer",
                "company": "Tech Corp",
                "location": "San Francisco, CA",
                "description": "Looking for a skilled frontend developer with React experience",
                "match_score": 95,
                "salary_range": "$80,000 - $120,000",
                "requirements": ["React", "JavaScript", "HTML/CSS", "Redux"]
            },
            {
                "id": 2,
                "title": "Full Stack Engineer",
                "company": "Innovation Labs",
                "location": "New York, NY",
                "description": "Join our team as a full stack engineer working on cutting-edge applications",
                "match_score": 88,
                "salary_range": "$90,000 - $140,000",
                "requirements": ["Node.js", "React", "PostgreSQL", "AWS"]
            },
            {
                "id": 3,
                "title": "Software Developer",
                "company": "StartupX",
                "location": "Austin, TX",
                "description": "Help build the next generation of software solutions",
                "match_score": 82,
                "salary_range": "$70,000 - $110,000",
                "requirements": ["JavaScript", "Python", "Docker", "Git"]
            }
        ]
        
        return {
            "user_id": user_id,
            "recommendations": recommended_jobs,
            "total_matches": len(recommended_jobs),
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

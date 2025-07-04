import axios from "axios";
import db from "../db/index.js";
import { sendShortlistMail } from "../utils/email.js";


const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'http://ai-service:8000' 
    : 'http://localhost:8000');
    
const UPLOAD_BASE_PATH = process.env.UPLOAD_BASE_PATH || '/app/uploads';



export const shortlistApplicants = async (req, res) => {
  const { companyId, jobId } = req.params;

  try {
    
    const jobRes = await db.query(
      `SELECT j.id, j.title 
       FROM devconnect.jobs j
       WHERE j.id = $1 AND j.company_id = $2`,
      [jobId, companyId]
    );
    
    if (jobRes.rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }

    
    let aiResponse;
    try {
      aiResponse = await axios.post(
        `${AI_SERVICE_URL}/shortlist`, 
        { job_id: parseInt(jobId) },
        { timeout: 120000 } 
      );
    } catch (err) {
      console.error("AI service error:", err.message);
      return res.status(502).json({ 
        error: "AI service unavailable or timed out" 
      });
    }

    const result = aiResponse.data;
    const shortlist = result.shortlist || [];

    
    if (shortlist.length > 0) {
      const shortlistedIds = shortlist.map(s => s.user_id);
      
      await db.query(
        `UPDATE devconnect.applications
         SET status = 'SHORTLISTED',
             updated_at = NOW()
         WHERE job_id = $1 AND user_id = ANY($2)`,
        [jobId, shortlistedIds]
      );
    }

    
    res.status(200).json({ 
      success: true,
      job_id: parseInt(jobId),
      job_title: result.job_title,
      total_applicants: result.total_applicants,
      shortlisted_count: result.shortlisted_count,
      email_sent: result.email_sent,
      shortlist: shortlist
    });
    
  } catch (err) {
    console.error("Shortlisting error:", err);
    res.status(500).json({ 
      error: "Internal server error during shortlisting" 
    });
  }
};
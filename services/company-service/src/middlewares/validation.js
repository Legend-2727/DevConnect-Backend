import db from '../db/index.js';

// Validate ID parameters
export const validateIds = (req, res, next) => {
  const { companyId, jobId } = req.params;
  
  if (!Number.isInteger(Number(companyId)) )
    return res.status(400).json({ error: "Invalid company ID format" });
  
  if (!Number.isInteger(Number(jobId))) 
    return res.status(400).json({ error: "Invalid job ID format" });
  
  // Attach converted integers to request
  req.params.companyId = parseInt(companyId);
  req.params.jobId = parseInt(jobId);
  next();
};

// Verify company owns the job
export const verifyCompanyOwnership = async (req, res, next) => {
  const { companyId, jobId } = req.params;
  
  try {
    const result = await db.query(
      `SELECT 1 FROM jobs 
       WHERE id = $1 AND company_id = $2`,
      [jobId, companyId]
    );
    
    if (result.rows.length === 0) {
      return res.status(403).json({ 
        error: "Job not found or company doesn't own this job" 
      });
    }
    
    next();
  } catch (err) {
    console.error("Ownership check error:", err);
    res.status(500).json({ error: "Server error during ownership verification" });
  }
};
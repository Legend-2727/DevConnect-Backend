import db from '../db/index.js';

// 1. Post a new job
export const createJob = async (req, res) => {
  const { company_id, title, description, skills, employment_type, location, deadline } = req.body;
  try {
    const result = await db.query(`
      INSERT INTO devconnect.jobs
      (company_id, title, description, skills, employment_type, location, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [company_id, title, description, skills, employment_type, location, deadline]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Job creation failed' });
  }
};

// 2. Get all jobs posted by a company
export const getCompanyJobs = async (req, res) => {
  const { companyId } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM devconnect.jobs WHERE company_id = $1`,
      [companyId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

// 3. Placeholder: Trigger AI Shortlisting
export const triggerShortlistAI = async (req, res) => {
  const { jobId } = req.params;

  // TODO: Replace with real AI logic
  const shortlistedUserIds = [2, 5]; // Dummy for now

  // Log & return
  res.status(200).json({
    message: 'AI shortlisting triggered',
    shortlisted: shortlistedUserIds
  });
};

// Test database connectivity
export const testDB = async (req, res) => {
  try {
    const result = await db.query('SELECT 1 as test');
    res.status(200).json({ success: true, test: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Browse all jobs (for users to see available jobs)
export const browseJobs = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        j.id,
        j.title,
        j.description,
        j.skills,
        j.employment_type,
        j.location,
        j.deadline,
        j.posted_at,
        c.name as company_name
      FROM devconnect.jobs j
      JOIN devconnect.companies c ON j.company_id = c.id
      ORDER BY j.posted_at DESC
    `);
    
    res.status(200).json({ 
      success: true, 
      jobs: result.rows 
    });
  } catch (err) {
    console.error('Browse jobs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
  }
};

// 4. Placeholder: Schedule Interviews for shortlisted
export const scheduleInterview = async (req, res) => {
  const { job_id, application_id, slot } = req.body;

  try {
    await db.query(`
      INSERT INTO devconnect.interviews (job_id, application_id, slot)
      VALUES ($1, $2, $3)
    `, [job_id, application_id, slot]);

    res.status(201).json({ message: 'Interview scheduled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
};

// Get applications for a specific job
export const getJobApplications = async (req, res) => {
  const { jobId } = req.params;
  try {
    const result = await db.query(`
      SELECT 
        a.id,
        a.user_id,
        a.status,
        a.applied_at,
        u.name as user_name,
        acc.email as user_email,
        u.cv_url
      FROM devconnect.applications a
      JOIN devconnect.users u ON a.user_id = u.id
      JOIN devconnect.accounts acc ON u.account_id = acc.id
      WHERE a.job_id = $1
      ORDER BY a.applied_at DESC
    `, [jobId]);

    res.status(200).json({
      success: true,
      applications: result.rows
    });
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch applications' 
    });
  }
};

// Get application count for a specific job
export const getJobApplicationCount = async (req, res) => {
  const { jobId } = req.params;
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM devconnect.applications
      WHERE job_id = $1
    `, [jobId]);

    res.status(200).json({
      success: true,
      count: parseInt(result.rows[0].count)
    });
  } catch (err) {
    console.error('Error fetching application count:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch application count',
      count: 0
    });
  }
};

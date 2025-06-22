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

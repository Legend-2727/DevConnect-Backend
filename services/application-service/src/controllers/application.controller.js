import db from '../db/index.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "devconnectsecret";

// Submit a job application
export const applyForJob = async (req, res) => {
  try {
    console.log('applyForJob called');
    console.log('Request body:', req.body);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const accountType = decoded.type;

    // Verify this is a User account
    if (accountType !== 'User') {
      return res.status(403).json({ error: 'Only users can apply for jobs' });
    }

    // Get user profile
    const userResult = await db.query(
      'SELECT id FROM devconnect.users WHERE account_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userProfileId = userResult.rows[0].id;
    const { jobId } = req.params;

    // Check if job exists and is active
    const jobResult = await db.query(
      'SELECT id FROM devconnect.jobs WHERE id = $1 AND is_active = TRUE',
      [jobId]
    );

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or no longer active' });
    }

    // Check if already applied
    const existingApplication = await db.query(
      'SELECT id FROM devconnect.applications WHERE job_id = $1 AND user_id = $2',
      [jobId, userProfileId]
    );

    if (existingApplication.rows.length > 0) {
      return res.status(409).json({ error: 'You have already applied for this job' });
    }

    // Create application
    const result = await db.query(`
      INSERT INTO devconnect.applications (job_id, user_id, status)
      VALUES ($1, $2, 'UNDER_REVIEW')
      RETURNING id, job_id, user_id, status, applied_at
    `, [jobId, userProfileId]);

    res.status(201).json({
      success: true,
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Apply for job error:', error);
    res.status(500).json({ error: 'Failed to apply for job' });
  }
};

// Get all applications for current user
export const getUserApplications = async (req, res) => {
  try {
    console.log('getUserApplications called');
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const accountType = decoded.type;

    // Verify this is a User account
    if (accountType !== 'User') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user profile
    const userResult = await db.query(
      'SELECT id FROM devconnect.users WHERE account_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userProfileId = userResult.rows[0].id;

    // Get all applications with job details
    const result = await db.query(`
      SELECT 
        a.id, a.job_id, a.status, a.applied_at, a.updated_at,
        j.title as job_title, j.description as job_description,
        j.employment_type, j.location,
        c.name as company_name, c.logo as company_logo
      FROM devconnect.applications a
      JOIN devconnect.jobs j ON a.job_id = j.id
      JOIN devconnect.companies c ON j.company_id = c.id
      WHERE a.user_id = $1
      ORDER BY a.applied_at DESC
    `, [userProfileId]);

    res.json({
      success: true,
      applications: result.rows
    });
  } catch (error) {
    console.error('Get user applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
};

// Get a specific application by ID
export const getApplicationById = async (req, res) => {
  try {
    console.log('getApplicationById called');
    console.log('Params:', req.params);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const accountType = decoded.type;

    // Get user or company ID based on account type
    let profileIdResult;
    if (accountType === 'User') {
      profileIdResult = await db.query(
        'SELECT id FROM devconnect.users WHERE account_id = $1',
        [userId]
      );
    } else if (accountType === 'Company') {
      profileIdResult = await db.query(
        'SELECT id FROM devconnect.companies WHERE account_id = $1',
        [userId]
      );
    } else {
      return res.status(403).json({ error: 'Invalid account type' });
    }

    if (profileIdResult.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const { applicationId } = req.params;

    // Get application with details
    let applicationQuery;
    let queryParams;

    if (accountType === 'User') {
      // For users, verify they own this application
      applicationQuery = `
        SELECT 
          a.id, a.job_id, a.user_id, a.status, a.applied_at, a.updated_at,
          j.title as job_title, j.description as job_description,
          j.employment_type, j.location,
          c.name as company_name, c.logo as company_logo,
          c.id as company_id
        FROM devconnect.applications a
        JOIN devconnect.jobs j ON a.job_id = j.id
        JOIN devconnect.companies c ON j.company_id = c.id
        WHERE a.id = $1 AND a.user_id = $2
      `;
      queryParams = [applicationId, profileIdResult.rows[0].id];
    } else {
      // For companies, verify they own the job this application is for
      applicationQuery = `
        SELECT 
          a.id, a.job_id, a.user_id, a.status, a.applied_at, a.updated_at,
          j.title as job_title, j.description as job_description,
          j.employment_type, j.location,
          c.name as company_name, c.logo as company_logo,
          u.name as applicant_name, u.education_level, u.experience_level, u.cv_url
        FROM devconnect.applications a
        JOIN devconnect.jobs j ON a.job_id = j.id
        JOIN devconnect.companies c ON j.company_id = c.id
        JOIN devconnect.users u ON a.user_id = u.id
        WHERE a.id = $1 AND c.id = $2
      `;
      queryParams = [applicationId, profileIdResult.rows[0].id];
    }

    const result = await db.query(applicationQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or access denied' });
    }

    res.json({
      success: true,
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Get application by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch application details' });
  }
};

// Withdraw an application (user only)
export const withdrawApplication = async (req, res) => {
  try {
    console.log('withdrawApplication called');
    console.log('Params:', req.params);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const accountType = decoded.type;

    // Verify this is a User account
    if (accountType !== 'User') {
      return res.status(403).json({ error: 'Only users can withdraw applications' });
    }

    // Get user profile
    const userResult = await db.query(
      'SELECT id FROM devconnect.users WHERE account_id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userProfileId = userResult.rows[0].id;
    const { applicationId } = req.params;

    // Update application status
    const result = await db.query(`
      UPDATE devconnect.applications
      SET status = 'WITHDRAWN', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, status, updated_at
    `, [applicationId, userProfileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or access denied' });
    }

    res.json({
      success: true,
      application: result.rows[0],
      message: 'Application withdrawn successfully'
    });
  } catch (error) {
    console.error('Withdraw application error:', error);
    res.status(500).json({ error: 'Failed to withdraw application' });
  }
};

// Update application status (company only)
export const updateApplicationStatus = async (req, res) => {
  try {
    console.log('updateApplicationStatus called');
    console.log('Params:', req.params);
    console.log('Request body:', req.body);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const accountType = decoded.type;

    // Verify this is a Company account
    if (accountType !== 'Company') {
      return res.status(403).json({ error: 'Only companies can update application status' });
    }

    const { applicationId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'INTERVIEW'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Get company profile
    const companyResult = await db.query(
      'SELECT id FROM devconnect.companies WHERE account_id = $1',
      [userId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const companyId = companyResult.rows[0].id;

    // Update application status (only if the application is for a job owned by this company)
    const result = await db.query(`
      UPDATE devconnect.applications a
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      FROM devconnect.jobs j
      WHERE a.id = $2 AND a.job_id = j.id AND j.company_id = $3
      RETURNING a.id, a.status, a.updated_at
    `, [status, applicationId, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or access denied' });
    }

    res.json({
      success: true,
      application: result.rows[0],
      message: 'Application status updated successfully'
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Failed to update application status' });
  }
};

import db from '../db/index.js';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || "devconnectsecret";

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/logos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Logo upload endpoint
export const uploadLogo = async (req, res) => {
  try {
    console.log('uploadLogo called');
    console.log('File:', req.file);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate the logo URL
    const logoUrl = `http://localhost:4005/uploads/logos/${req.file.filename}`;
    console.log('Logo URL:', logoUrl);

    // Update company profile with logo URL
    const result = await db.query(`
      UPDATE devconnect.companies 
      SET logo = $1 
      WHERE account_id = $2
      RETURNING *
    `, [logoUrl, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json({
      success: true,
      logoUrl: logoUrl,
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
};

// Export the multer middleware
export const logoUpload = upload.single('logo');

// Company Profile Functions
export const getCompanyProfile = async (req, res) => {
  try {
    console.log('🔍 getCompanyProfile called');
    console.log('🍪 All cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      console.log('❌ No token found in cookies');
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    console.log('🔑 Token found:', token.substring(0, 20) + '...');

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    console.log('👤 User ID from token:', userId);
    console.log('🏢 Account type from token:', decoded.type);

    // Verify this is actually a Company account
    const accountCheck = await db.query(
      'SELECT id, email, account_type FROM devconnect.accounts WHERE id = $1 AND account_type = $2',
      [userId, 'Company']
    );

    if (accountCheck.rows.length === 0) {
      console.log('❌ Account not found or not a Company account');
      return res.status(401).json({ error: 'Invalid account' });
    }

    const account = accountCheck.rows[0];
    console.log('✅ Verified account:', account);

    // Get company profile for this specific account
    const result = await db.query(`
      SELECT c.*, a.email
      FROM devconnect.companies c
      JOIN devconnect.accounts a ON c.account_id = a.id
      WHERE c.account_id = $1
    `, [userId]);

    console.log('🔍 Company profile query for account_id:', userId);
    console.log('📊 Query result rows count:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('🏢 Found company profile:', {
        id: result.rows[0].id,
        name: result.rows[0].name,
        account_id: result.rows[0].account_id,
        email: result.rows[0].email
      });
    }

    if (result.rows.length === 0) {
      console.log('🆕 No profile found for account_id:', userId);
      return res.json({ success: true, profile: null });
    }

    const companyData = result.rows[0];
    console.log('📤 Sending company data for account_id:', userId);

    res.json({
      success: true,
      profile: companyData
    });
  } catch (error) {
    console.error('❌ Get company profile error:', error);
    res.status(500).json({ error: 'Failed to fetch company profile' });
  }
};

export const createCompanyProfile = async (req, res) => {
  try {
    console.log('createCompanyProfile called');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Get account email
    const accountResult = await db.query(
      'SELECT email FROM devconnect.accounts WHERE id = $1',
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const accountEmail = accountResult.rows[0].email;

    // Extract data from FormData (handled by multer)
    const { name, industry, website } = req.body;
    let logoUrl = null;

    // Handle logo upload if present
    if (req.file) {
      logoUrl = `http://localhost:4005/uploads/logos/${req.file.filename}`;
    }

    // Check if profile already exists
    const existingProfile = await db.query(
      'SELECT id FROM devconnect.companies WHERE account_id = $1',
      [userId]
    );

    let query, values;
    if (existingProfile.rows.length > 0) {
      // Update existing profile
      query = `
        UPDATE devconnect.companies 
        SET name = $1, email = $2, industry = $3, website = $4, logo = COALESCE($5, logo)
        WHERE account_id = $6
        RETURNING *
      `;
      values = [name, accountEmail, industry, website, logoUrl, userId];
    } else {
      // Create new profile
      query = `
        INSERT INTO devconnect.companies 
        (account_id, name, email, industry, website, logo)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      values = [userId, name, accountEmail, industry, website, logoUrl];
    }

    const result = await db.query(query, values);
    const profile = result.rows[0];

    res.json({
      success: true,
      profile: profile
    });
  } catch (error) {
    console.error('Create company profile error:', error);
    res.status(500).json({ error: 'Failed to create company profile' });
  }
};

// 1. Post a new job
export const createJob = async (req, res) => {
  try {
    console.log('createJob called');
    console.log('Request body:', req.body);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Get company profile to verify ownership
    const companyResult = await db.query(
      'SELECT id FROM devconnect.companies WHERE account_id = $1',
      [userId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const companyId = companyResult.rows[0].id;
    const { title, description, skills, employment_type, location, deadline } = req.body;

    const result = await db.query(`
      INSERT INTO devconnect.jobs
      (company_id, title, description, skills, employment_type, location, deadline)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [companyId, title, description, skills, employment_type, location, deadline]);

    res.status(201).json({
      success: true,
      job: result.rows[0]
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Job creation failed' });
  }
};

// 2. Get all jobs posted by a company
export const getCompanyJobs = async (req, res) => {
  try {
    console.log('getCompanyJobs called');
    console.log('Params:', req.params);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Get company profile to verify ownership
    const companyResult = await db.query(
      'SELECT id FROM devconnect.companies WHERE account_id = $1',
      [userId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const companyId = companyResult.rows[0].id;
    const { companyId: requestedCompanyId } = req.params;

    // Verify that the requested company ID matches the logged-in user's company
    if (parseInt(requestedCompanyId) !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(
      `SELECT * FROM devconnect.jobs WHERE company_id = $1 ORDER BY posted_at DESC`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      jobs: result.rows
    });
  } catch (error) {
    console.error('Get company jobs error:', error);
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

// Debug endpoint to check current user
export const debugCurrentUser = async (req, res) => {
  try {
    console.log('🔍 Debug endpoint called');
    console.log('🍪 All cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.json({ error: 'No token found', cookies: req.cookies });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('🔑 Decoded token:', decoded);

    // Get account info
    const accountResult = await db.query(
      'SELECT id, email, account_type FROM devconnect.accounts WHERE id = $1',
      [decoded.id]
    );

    // Get all company accounts for comparison
    const allCompanies = await db.query(`
      SELECT a.id, a.email, a.account_type, c.id as company_id, c.name 
      FROM devconnect.accounts a 
      LEFT JOIN devconnect.companies c ON a.id = c.account_id 
      WHERE a.account_type = 'Company' 
      ORDER BY a.id
    `);

    res.json({
      tokenUserId: decoded.id,
      accountType: decoded.type,
      currentAccount: accountResult.rows[0] || null,
      allCompanyAccounts: allCompanies.rows
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Interviewer Management Functions
export const createInterviewer = async (req, res) => {
  try {
    console.log('createInterviewer called');
    console.log('Request body:', req.body);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Get company profile to verify ownership
    const companyResult = await db.query(
      'SELECT id FROM devconnect.companies WHERE account_id = $1',
      [userId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const companyId = companyResult.rows[0].id;
    const { name, email, role } = req.body;

    const result = await db.query(`
      INSERT INTO devconnect.interviewers (company_id, name, email, role)
      VALUES ($1, $2, $3, $4) 
      RETURNING *
    `, [companyId, name, email, role]);

    res.status(201).json({
      success: true,
      interviewer: result.rows[0]
    });
  } catch (error) {
    console.error('Create interviewer error:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Interviewer with this email already exists for this company' });
    }
    res.status(500).json({ error: 'Failed to create interviewer' });
  }
};

export const getCompanyInterviewers = async (req, res) => {
  try {
    console.log('getCompanyInterviewers called');

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Get company profile to verify ownership
    const companyResult = await db.query(
      'SELECT id FROM devconnect.companies WHERE account_id = $1',
      [userId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const companyId = companyResult.rows[0].id;

    const result = await db.query(
      `SELECT * FROM devconnect.interviewers WHERE company_id = $1 ORDER BY name`,
      [companyId]
    );

    res.json({
      success: true,
      interviewers: result.rows
    });
  } catch (error) {
    console.error('Get company interviewers error:', error);
    res.status(500).json({ error: 'Failed to fetch interviewers' });
  }
};

export const assignInterviewersToJob = async (req, res) => {
  try {
    console.log('assignInterviewersToJob called');
    console.log('Request body:', req.body);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const { jobId } = req.params;
    const { interviewerIds } = req.body;

    // Verify job ownership
    const jobResult = await db.query(`
      SELECT j.id FROM devconnect.jobs j
      JOIN devconnect.companies c ON j.company_id = c.id
      WHERE j.id = $1 AND c.account_id = $2
    `, [jobId, userId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    // Clear existing assignments
    await db.query('DELETE FROM devconnect.job_interviewers WHERE job_id = $1', [jobId]);

    // Add new assignments
    if (interviewerIds && interviewerIds.length > 0) {
      const insertPromises = interviewerIds.map(interviewerId => 
        db.query(
          'INSERT INTO devconnect.job_interviewers (job_id, interviewer_id) VALUES ($1, $2)',
          [jobId, interviewerId]
        )
      );
      await Promise.all(insertPromises);
    }

    // Get updated assignments
    const assignedResult = await db.query(`
      SELECT i.id, i.name, i.email, i.role 
      FROM devconnect.interviewers i
      JOIN devconnect.job_interviewers ji ON i.id = ji.interviewer_id
      WHERE ji.job_id = $1
    `, [jobId]);

    res.json({
      success: true,
      assignedInterviewers: assignedResult.rows
    });
  } catch (error) {
    console.error('Assign interviewers to job error:', error);
    res.status(500).json({ error: 'Failed to assign interviewers' });
  }
};

export const getJobInterviewers = async (req, res) => {
  try {
    console.log('getJobInterviewers called');
    const { jobId } = req.params;

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // Verify job ownership
    const jobResult = await db.query(`
      SELECT j.id FROM devconnect.jobs j
      JOIN devconnect.companies c ON j.company_id = c.id
      WHERE j.id = $1 AND c.account_id = $2
    `, [jobId, userId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    const result = await db.query(`
      SELECT i.id, i.name, i.email, i.role 
      FROM devconnect.interviewers i
      JOIN devconnect.job_interviewers ji ON i.id = ji.interviewer_id
      WHERE ji.job_id = $1
    `, [jobId]);

    res.json({
      success: true,
      interviewers: result.rows
    });
  } catch (error) {
    console.error('Get job interviewers error:', error);
    res.status(500).json({ error: 'Failed to fetch job interviewers' });
  }
};

// Get applications for a specific job
export const getJobApplications = async (req, res) => {
  try {
    console.log('getJobApplications called');
    console.log('Params:', req.params);
    console.log('Cookies:', req.cookies);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const { jobId } = req.params;

    // Verify that the job belongs to the current company
    const jobResult = await db.query(`
      SELECT j.id, j.title FROM devconnect.jobs j
      JOIN devconnect.companies c ON j.company_id = c.id
      WHERE j.id = $1 AND c.account_id = $2
    `, [jobId, userId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    // Get all applications for this job with user details
    const result = await db.query(`
      SELECT 
        a.id,
        a.job_id,
        a.user_id,
        a.status,
        a.applied_at,
        a.updated_at,
        u.name as user_name,
        u.education_level,
        u.experience_level,
        u.cv_url,
        acc.email as user_email
      FROM devconnect.applications a
      JOIN devconnect.users u ON a.user_id = u.id
      JOIN devconnect.accounts acc ON u.account_id = acc.id
      WHERE a.job_id = $1
      ORDER BY a.applied_at DESC
    `, [jobId]);

    res.json({
      success: true,
      job: jobResult.rows[0],
      applications: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ error: 'Failed to fetch job applications' });
  }
};

// Bulk update application statuses (for AI shortlisting acceptance)
export const bulkUpdateApplicationStatus = async (req, res) => {
  try {
    console.log('bulkUpdateApplicationStatus called');
    console.log('Request body:', req.body);

    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const { jobId } = req.params;
    const { acceptedApplicationIds, rejectedApplicationIds } = req.body;

    // Verify that the job belongs to the current company
    const jobResult = await db.query(`
      SELECT j.id, j.title FROM devconnect.jobs j
      JOIN devconnect.companies c ON j.company_id = c.id
      WHERE j.id = $1 AND c.account_id = $2
    `, [jobId, userId]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update accepted applications
      if (acceptedApplicationIds && acceptedApplicationIds.length > 0) {
        const acceptQuery = `
          UPDATE devconnect.applications 
          SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1) AND job_id = $2
          RETURNING id, user_id
        `;
        await db.query(acceptQuery, [acceptedApplicationIds, jobId]);
      }

      // Update rejected applications
      if (rejectedApplicationIds && rejectedApplicationIds.length > 0) {
        const rejectQuery = `
          UPDATE devconnect.applications 
          SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
          WHERE id = ANY($1) AND job_id = $2
          RETURNING id, user_id
        `;
        await db.query(rejectQuery, [rejectedApplicationIds, jobId]);
      }

      // Commit transaction
      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Application statuses updated successfully',
        accepted_count: acceptedApplicationIds?.length || 0,
        rejected_count: rejectedApplicationIds?.length || 0
      });
    } catch (error) {
      // Rollback transaction on error
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Bulk update application status error:', error);
    res.status(500).json({ error: 'Failed to update application statuses' });
  }
};


export const getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await db.query(
      'SELECT * FROM devconnect.jobs WHERE id = $1',
      [jobId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job details' });
  }
};

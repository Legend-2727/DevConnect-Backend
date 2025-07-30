import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let applicationController;
let db;
let jwt;
let fs;

beforeAll(async () => {
  applicationController = await import('../../controllers/application.controller.js');
  db = (await import('../../db/index.js')).default;
  jwt = (await import('jsonwebtoken')).default;
  fs = (await import('fs')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('Application Controller', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      cookies: {},
      body: {},
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  // Helper to set up a valid token and decoded user
  const setupAuth = (user = { id: 1, type: 'User' }) => {
    mockRequest.cookies.token = 'valid-token';
    jwt.verify.mockReturnValue(user);
  };

  describe('getCompanyProfile', () => {
    it('should return a company profile when found', async () => {
      mockRequest.params = { companyId: '1' };
      const mockCompany = { id: 1, name: 'Test Corp', industry: 'Tech' };
      db.query.mockResolvedValue({ rows: [mockCompany] });

      await applicationController.getCompanyProfile(mockRequest, mockResponse);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['1']);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, company: mockCompany });
    });

    it('should return 404 if company not found', async () => {
      mockRequest.params = { companyId: '999' };
      db.query.mockResolvedValue({ rows: [] });

      await applicationController.getCompanyProfile(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Company not found' });
    });

    it('should handle database errors', async () => {
      mockRequest.params = { companyId: '1' };
      db.query.mockRejectedValue(new Error('Database error'));

      await applicationController.getCompanyProfile(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to get company profile' });
    });
  });

  describe('getJobDescription', () => {
    it('should return job and company details when job found', async () => {
      mockRequest.params = { jobId: '1' };
      const mockJob = { id: 1, title: 'Developer', company_id: 2 };
      const mockCompany = { id: 2, name: 'Test Corp' };
      
      db.query
        .mockResolvedValueOnce({ rows: [mockJob] })
        .mockResolvedValueOnce({ rows: [mockCompany] });

      await applicationController.getJobDescription(mockRequest, mockResponse);

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        job: mockJob,
        company: mockCompany
      });
    });

    it('should return 404 if job not found', async () => {
      mockRequest.params = { jobId: '999' };
      db.query.mockResolvedValue({ rows: [] });

      await applicationController.getJobDescription(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Job not found' });
    });
  });

  describe('applyForJob', () => {
    

    it('should return 401 if no token provided', async () => {
      mockRequest.params = { jobId: '1' };
      
      await applicationController.applyForJob(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token' });
    });

    it('should return 403 if account is not a User type', async () => {
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.params = { jobId: '1' };
      
      await applicationController.applyForJob(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Only users can apply for jobs' });
    });

    it('should return 409 if user already applied for the job', async () => {
      setupAuth();
      mockRequest.params = { jobId: '1' };
      
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // Get user
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Job exists
        .mockResolvedValueOnce({ rows: [{ id: 5 }] }); // Existing application
      
      await applicationController.applyForJob(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'You have already applied for this job' });
    });
  });

  describe('getUserApplications', () => {
    it('should return user applications when authorized', async () => {
      setupAuth();
      const mockApplications = [
        { id: 1, job_title: 'Developer', company_name: 'Test Corp' }
      ];
      
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // Get user
        .mockResolvedValueOnce({ rows: mockApplications }); // Get applications
      
      await applicationController.getUserApplications(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        applications: mockApplications
      });
    });

    it('should return 401 if no token provided', async () => {
      await applicationController.getUserApplications(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if account is not a User type', async () => {
      setupAuth({ id: 1, type: 'Company' });
      
      await applicationController.getUserApplications(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('withdrawApplication', () => {
    it('should update application status to WITHDRAWN', async () => {
      setupAuth();
      mockRequest.params = { applicationId: '1' };
      
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // Get user
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'WITHDRAWN' }] }); // Update application
      
      await applicationController.withdrawApplication(mockRequest, mockResponse);
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE devconnect.applications'),
        ['1', 10]
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        application: expect.objectContaining({ status: 'WITHDRAWN' }),
        message: 'Application withdrawn successfully'
      });
    });

    it('should return 404 if application not found or not owned by user', async () => {
      setupAuth();
      mockRequest.params = { applicationId: '999' };
      
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10 }] }) // Get user
        .mockResolvedValueOnce({ rows: [] }); // No application found
      
      await applicationController.withdrawApplication(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Application not found or access denied' });
    });
  });

  describe('updateApplicationStatus', () => {
    it('should allow company to update application status', async () => {
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.params = { applicationId: '1' };
      mockRequest.body = { status: 'ACCEPTED' };
      
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // Get company
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'ACCEPTED' }] }); // Update application
      
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE devconnect.applications'),
        ['ACCEPTED', '1', 5]
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        application: expect.objectContaining({ status: 'ACCEPTED' }),
        message: 'Application status updated successfully'
      });
    });

    it('should return 400 if status is invalid', async () => {
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.params = { applicationId: '1' };
      mockRequest.body = { status: 'INVALID_STATUS' };
      
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid status value' });
    });

    it('should return 403 if user tries to update application status', async () => {
      setupAuth({ id: 1, type: 'User' });
      mockRequest.params = { applicationId: '1' };
      mockRequest.body = { status: 'ACCEPTED' };
      
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Only companies can update application status' });
    });
  });

  describe('getLatestJobs', () => {
    it('should return latest active jobs', async () => {
      const mockJobs = [
        { id: 1, title: 'Developer', company_name: 'Tech Corp' },
        { id: 2, title: 'Designer', company_name: 'Design Co' }
      ];
      
      db.query.mockResolvedValue({ rows: mockJobs });
      
      await applicationController.getLatestJobs(mockRequest, mockResponse);
      
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs
      });
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));
      
      await applicationController.getLatestJobs(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to fetch latest jobs' });
    });
  });
});

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

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let applicationController;
let db;
let jwt;

beforeAll(async () => {
  applicationController = await import('../../controllers/application.controller.js');
  db = (await import('../../db/index.js')).default;
  jwt = (await import('jsonwebtoken')).default;
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

  // Helper to set up database mocks
  const setupDbMocks = (mocks) => {
    mocks.forEach((mock, index) => {
      db.query.mockResolvedValueOnce(mock);
    });
  };

  describe('applyForJob', () => {
    it('should create a new application when valid request', async () => {
      // Setup
      setupAuth();
      mockRequest.params = { jobId: '123' };
      
      const userProfileMock = { rows: [{ id: 5 }] };
      const jobMock = { rows: [{ id: 123 }] };
      const existingAppMock = { rows: [] }; // No existing application
      const newAppMock = { 
        rows: [{ 
          id: 42, 
          job_id: 123, 
          user_id: 5, 
          status: 'UNDER_REVIEW', 
          applied_at: new Date()
        }]
      };
      
      setupDbMocks([userProfileMock, jobMock, existingAppMock, newAppMock]);

      // Execute
      await applicationController.applyForJob(mockRequest, mockResponse);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(4);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        application: newAppMock.rows[0]
      });
    });

    it('should return 401 if no token is provided', async () => {
      // No token setup
      await applicationController.applyForJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token' });
    });

    it('should return 403 if account is not a User', async () => {
      setupAuth({ id: 1, type: 'Company' });
      
      await applicationController.applyForJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Only users can apply for jobs' });
    });

    it('should return 404 if user profile is not found', async () => {
      setupAuth();
      setupDbMocks([{ rows: [] }]); // No user profile
      
      await applicationController.applyForJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User profile not found' });
    });

    it('should return 404 if job is not found or inactive', async () => {
      setupAuth();
      setupDbMocks([
        { rows: [{ id: 5 }] }, // User exists
        { rows: [] } // Job not found
      ]);
      mockRequest.params = { jobId: '999' };
      
      await applicationController.applyForJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Job not found or no longer active' });
    });

    it('should return 409 if already applied for the job', async () => {
      setupAuth();
      mockRequest.params = { jobId: '123' };
      
      setupDbMocks([
        { rows: [{ id: 5 }] }, // User exists
        { rows: [{ id: 123 }] }, // Job exists
        { rows: [{ id: 42 }] } // Already applied
      ]);
      
      await applicationController.applyForJob(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'You have already applied for this job' });
    });
  });

  describe('getUserApplications', () => {
    it('should return all applications for the current user', async () => {
      // Setup
      setupAuth();
      
      const userProfileMock = { rows: [{ id: 5 }] };
      const applicationsMock = { 
        rows: [
          { 
            id: 1, 
            job_id: 100, 
            status: 'UNDER_REVIEW', 
            job_title: 'Software Engineer',
            company_name: 'Tech Co'
          },
          { 
            id: 2, 
            job_id: 101, 
            status: 'SHORTLISTED', 
            job_title: 'Frontend Developer',
            company_name: 'Dev Inc'
          }
        ] 
      };
      
      setupDbMocks([userProfileMock, applicationsMock]);

      // Execute
      await applicationController.getUserApplications(mockRequest, mockResponse);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        applications: applicationsMock.rows
      });
    });

    it('should return 401 if no token is provided', async () => {
      await applicationController.getUserApplications(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token' });
    });

    it('should return 403 if account is not a User', async () => {
      setupAuth({ id: 1, type: 'Company' });
      
      await applicationController.getUserApplications(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access denied' });
    });

    it('should return 404 if user profile is not found', async () => {
      setupAuth();
      setupDbMocks([{ rows: [] }]); // No user profile
      
      await applicationController.getUserApplications(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User profile not found' });
    });
  });

  describe('getApplicationById', () => {
    it('should return application details for User when they own the application', async () => {
      // Setup
      setupAuth();
      mockRequest.params = { applicationId: '42' };
      
      const userProfileMock = { rows: [{ id: 5 }] };
      const applicationMock = { 
        rows: [{ 
          id: 42, 
          job_id: 123, 
          user_id: 5, 
          status: 'UNDER_REVIEW',
          job_title: 'Software Engineer',
          company_name: 'Tech Co' 
        }] 
      };
      
      setupDbMocks([userProfileMock, applicationMock]);

      // Execute
      await applicationController.getApplicationById(mockRequest, mockResponse);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        application: applicationMock.rows[0]
      });
    });

    it('should return application details for Company when they own the job', async () => {
      // Setup
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.params = { applicationId: '42' };
      
      const companyProfileMock = { rows: [{ id: 10 }] };
      const applicationMock = { 
        rows: [{ 
          id: 42, 
          job_id: 123, 
          user_id: 5, 
          status: 'UNDER_REVIEW',
          job_title: 'Software Engineer',
          company_name: 'Tech Co',
          applicant_name: 'John Doe' 
        }] 
      };
      
      setupDbMocks([companyProfileMock, applicationMock]);

      // Execute
      await applicationController.getApplicationById(mockRequest, mockResponse);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        application: applicationMock.rows[0]
      });
    });

    it('should return 401 if no token is provided', async () => {
      await applicationController.getApplicationById(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token' });
    });

    it('should return 403 if account type is invalid', async () => {
      setupAuth({ id: 1, type: 'Admin' }); // Invalid account type
      
      await applicationController.getApplicationById(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid account type' });
    });

    it('should return 404 if application is not found or access is denied', async () => {
      setupAuth();
      mockRequest.params = { applicationId: '999' };
      
      setupDbMocks([
        { rows: [{ id: 5 }] }, // User profile found
        { rows: [] } // No application or not authorized
      ]);
      
      await applicationController.getApplicationById(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Application not found or access denied' });
    });
  });

  describe('withdrawApplication', () => {
    it('should successfully withdraw an application', async () => {
      // Setup
      setupAuth();
      mockRequest.params = { applicationId: '42' };
      
      const userProfileMock = { rows: [{ id: 5 }] };
      const updatedAppMock = { 
        rows: [{ 
          id: 42, 
          status: 'WITHDRAWN', 
          updated_at: new Date() 
        }] 
      };
      
      setupDbMocks([userProfileMock, updatedAppMock]);

      // Execute
      await applicationController.withdrawApplication(mockRequest, mockResponse);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        application: updatedAppMock.rows[0],
        message: 'Application withdrawn successfully'
      });
    });

    it('should return 401 if no token is provided', async () => {
      await applicationController.withdrawApplication(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token' });
    });

    it('should return 403 if account is not a User', async () => {
      setupAuth({ id: 1, type: 'Company' });
      
      await applicationController.withdrawApplication(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Only users can withdraw applications' });
    });

    it('should return 404 if user profile is not found', async () => {
      setupAuth();
      setupDbMocks([{ rows: [] }]); // No user profile
      
      await applicationController.withdrawApplication(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User profile not found' });
    });

    it('should return 404 if application is not found or user does not own it', async () => {
      setupAuth();
      mockRequest.params = { applicationId: '999' };
      
      setupDbMocks([
        { rows: [{ id: 5 }] }, // User profile found
        { rows: [] } // No application or not owned by user
      ]);
      
      await applicationController.withdrawApplication(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Application not found or access denied' });
    });
  });

  describe('updateApplicationStatus', () => {
    it('should successfully update application status as a company', async () => {
      // Setup
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.params = { applicationId: '42' };
      mockRequest.body = { status: 'SHORTLISTED' };
      
      const companyProfileMock = { rows: [{ id: 10 }] };
      const updatedAppMock = { 
        rows: [{ 
          id: 42, 
          status: 'SHORTLISTED', 
          updated_at: new Date() 
        }] 
      };
      
      setupDbMocks([companyProfileMock, updatedAppMock]);

      // Execute
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);

      // Assert
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        application: updatedAppMock.rows[0],
        message: 'Application status updated successfully'
      });
    });

    it('should return 401 if no token is provided', async () => {
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized - No token' });
    });

    it('should return 403 if account is not a Company', async () => {
      setupAuth({ id: 1, type: 'User' });
      
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Only companies can update application status' });
    });

    it('should return 400 if status value is invalid', async () => {
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.body = { status: 'INVALID_STATUS' };
      
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid status value' });
    });

    it('should return 404 if company profile is not found', async () => {
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.body = { status: 'SHORTLISTED' };
      setupDbMocks([{ rows: [] }]); // No company profile
      
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Company profile not found' });
    });

    it('should return 404 if application is not found or not for company job', async () => {
      setupAuth({ id: 1, type: 'Company' });
      mockRequest.params = { applicationId: '999' };
      mockRequest.body = { status: 'SHORTLISTED' };
      
      setupDbMocks([
        { rows: [{ id: 10 }] }, // Company profile found
        { rows: [] } // No application or not for company job
      ]);
      
      await applicationController.updateApplicationStatus(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Application not found or access denied' });
    });
  });
});

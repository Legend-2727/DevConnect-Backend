import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../../db.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let userController;
let db;
let jwt;
let fs;

beforeAll(async () => {
  userController = await import('../../controllers/user.controller.js');
  db = (await import('../../db.js')).default;
  jwt = (await import('jsonwebtoken')).default;
  fs = (await import('fs')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('User Controller', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);

    mockRequest = {
      cookies: {},
      body: {},
      params: {},
      file: null,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  const setupAuth = (user = { id: 1, type: 'User' }) => {
    mockRequest.cookies.token = 'valid-token';
    jwt.verify.mockReturnValue(user);
  };

  // NEW: Test for getSignupMetadata
  describe('getSignupMetadata', () => {
    it('should return metadata for signup options', () => {
      userController.getSignupMetadata(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({
        educationLevels: expect.any(Array),
        experienceLevels: expect.any(Array),
        preferredRoles: expect.any(Array),
      });
    });
  });

  // NEW: Test for the legacy createUser
  describe('createUser', () => {
    it('should insert a new user and return the new user ID', async () => {
        mockRequest.body = { name: 'Legacy User', email: 'legacy@test.com', accountId: 99 };
        db.query.mockResolvedValue({ rows: [{ id: 150 }] });

        await userController.createUser(mockRequest, mockResponse);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO devconnect.users'), [99, 'Legacy User', 'legacy@test.com']);
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({ userId: 150 });
    });
    
    // Added test for error handling in createUser
    it('should handle database errors when creating a user', async () => {
      mockRequest.body = { name: 'Error User', email: 'error@test.com', accountId: 100 };
      db.query.mockRejectedValue(new Error('Database error'));
      
      await userController.createUser(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to create user' });
    });
  });

  describe('getUserProfile', () => {
    it('should return a user profile if one exists', async () => {
      setupAuth();
      const mockProfile = { account_id: 1, name: 'John Doe', cv_url: '/uploads/cvs/cv.pdf' };
      db.query.mockResolvedValue({ rows: [mockProfile] });

      await userController.getUserProfile(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        profile: expect.objectContaining({
          name: 'John Doe',
          cv_url: expect.stringContaining('http://localhost:4004/uploads/cvs/cv.pdf'),
        }),
      });
    });

    it('should return null if no profile exists', async () => {
      setupAuth();
      db.query.mockResolvedValue({ rows: [] });
      await userController.getUserProfile(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({ profile: null });
    });

    // RE-ADDED: Test for missing token
    it('should return 401 if no token is provided', async () => {
      await userController.getUserProfile(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
    
    // Added test for invalid token
    it('should handle invalid JWT token', async () => {
      mockRequest.cookies.token = 'invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await userController.getUserProfile(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
    
    // Added test for database error
    it('should handle database errors when fetching profile', async () => {
      setupAuth();
      db.query.mockRejectedValue(new Error('Database error'));
      
      await userController.getUserProfile(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
    
    // Added test for custom HTTP public IP replacement
    it('should use HTTP_PUBLIC_IP when environment variable is set', async () => {
      setupAuth();
      const originalEnv = process.env.HTTPPUBLICIP;
      process.env.HTTPPUBLICIP = 'http://example.com';
      
      const mockProfile = { account_id: 1, name: 'John Doe', cv_url: '/uploads/cvs/cv.pdf' };
      db.query.mockResolvedValue({ rows: [mockProfile] });
      
      await userController.getUserProfile(mockRequest, mockResponse);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        profile: expect.objectContaining({
          cv_url: expect.stringContaining('http://example.com:4004/uploads/cvs/cv.pdf'),
        }),
      });
      
      // Restore original env
      process.env.HTTPPUBLICIP = originalEnv;
    });
  });

  describe('createUserProfile', () => {
    it('should create a new profile if one does not exist', async () => {
      setupAuth();
      mockRequest.body = { name: 'Jane Doe' };
      const newProfile = { account_id: 1, name: 'Jane Doe' };
      
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newProfile] })
        .mockResolvedValueOnce({ rows: [{ email: 'jane@doe.com' }] });

      await userController.createUserProfile(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        profile: expect.objectContaining({ name: 'Jane Doe' }),
      });
    });

    it('should update an existing profile, including CV if provided', async () => {
        setupAuth();
        mockRequest.body = { name: 'Jane Doe Updated' };
        mockRequest.file = { filename: 'new-cv.pdf' };
        const updatedProfile = { account_id: 1, name: 'Jane Doe Updated' };
        
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [updatedProfile] })
          .mockResolvedValueOnce({ rows: [{ email: 'jane@doe.com' }] });
  
        await userController.createUserProfile(mockRequest, mockResponse);
  
        const updateQueryCall = db.query.mock.calls.find(call => call[0].includes('UPDATE'));
        expect(updateQueryCall[0]).toContain('cv_url');
        expect(updateQueryCall[1]).toEqual(expect.arrayContaining([expect.stringContaining('new-cv.pdf')]));
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          profile: expect.objectContaining({ name: 'Jane Doe Updated' }),
        });
    });
    

    
    // Added test for invalid preferred_roles string handling
    it('should handle invalid preferred_roles JSON string', async () => {
      setupAuth();
      mockRequest.body = { 
        name: 'Invalid Roles', 
        preferred_roles: '{"broken json' 
      };
      
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ name: 'Invalid Roles', preferred_roles: [] }] })
        .mockResolvedValueOnce({ rows: [{ email: 'invalid@example.com' }] });
      
      await userController.createUserProfile(mockRequest, mockResponse);
      
      const insertQueryCall = db.query.mock.calls.find(call => call[0].includes('INSERT INTO'));
      expect(insertQueryCall[1][4]).toEqual([]); // Should use empty array for invalid JSON
    });
    
    // Added test for non-array preferred_roles handling
    it('should convert non-array preferred_roles to an empty array', async () => {
      setupAuth();
      mockRequest.body = { 
        name: 'Non Array', 
        preferred_roles: 'not an array' 
      };
      
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ name: 'Non Array', preferred_roles: [] }] })
        .mockResolvedValueOnce({ rows: [{ email: 'nonarray@example.com' }] });
      
      await userController.createUserProfile(mockRequest, mockResponse);
      
      const insertQueryCall = db.query.mock.calls.find(call => call[0].includes('INSERT INTO'));
      expect(insertQueryCall[1][4]).toEqual([]);
    });
    
    // Added test for missing token
    it('should return 401 if no token is provided', async () => {
      mockRequest.body = { name: 'No Auth' };
      
      await userController.createUserProfile(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
    });
    
    // Added test for database error
    it('should handle database errors', async () => {
      setupAuth();
      mockRequest.body = { name: 'DB Error' };
      db.query.mockRejectedValue(new Error('Database connection error'));
      
      await userController.createUserProfile(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Server error' });
    });
  });
  
  // Added tests for getUser function
  describe('getUser', () => {
    it('should return a user by ID when found', async () => {
      mockRequest.params = { userId: '1' };
      const mockUser = { id: 1, name: 'John Doe', cv_url: '/uploads/cvs/cv.pdf', email: 'john@example.com' };
      db.query.mockResolvedValue({ rows: [mockUser] });
      
      await userController.getUser(mockRequest, mockResponse);
      
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT u.*, a.email'), ['1']);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUser);
    });
    
    it('should return 404 if user not found', async () => {
      mockRequest.params = { userId: '999' };
      db.query.mockResolvedValue({ rows: [] });
      
      await userController.getUser(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'User not found' });
    });
    

    
    it('should handle database errors', async () => {
      mockRequest.params = { userId: '1' };
      db.query.mockRejectedValue(new Error('Database error'));
      
      await userController.getUser(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to get user' });
    });
  });

  describe('handleCVUpload', () => {

    // RE-ADDED: Test for missing file
    it('should return 400 if no file is uploaded', async () => {
        setupAuth();
        await userController.handleCVUpload(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
    
    // Added test for database error
    it('should handle database errors', async () => {
      mockRequest.params = { userId: '1' };
      mockRequest.file = { filename: 'error.pdf' };
      db.query.mockRejectedValue(new Error('Database error'));
      
      await userController.handleCVUpload(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to upload CV' });
    });
    

  });
  
  // Added tests for handleCVUploadAuth function
  describe('handleCVUploadAuth', () => {
    it('should update authenticated user CV URL on successful upload', async () => {
      setupAuth();
      mockRequest.file = { filename: 'auth-cv.pdf' };
      db.query.mockResolvedValue({});
      
      await userController.handleCVUploadAuth(mockRequest, mockResponse);
      
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE devconnect.users SET cv_url'),
        [expect.stringContaining('/uploads/cvs/auth-cv.pdf'), 1]
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        cv_url: expect.stringContaining('http://localhost:4004/uploads/cvs/auth-cv.pdf'),
        message: 'CV uploaded successfully'
      });
    });
    
    it('should return 400 if no file is uploaded', async () => {
      setupAuth();
      await userController.handleCVUploadAuth(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    });
    
    it('should return 401 if no token is provided', async () => {
      mockRequest.file = { filename: 'unauthorized.pdf' };
      
      await userController.handleCVUploadAuth(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'No token provided' });
    });
    
    it('should handle database errors', async () => {
      setupAuth();
      mockRequest.file = { filename: 'db-error.pdf' };
      db.query.mockRejectedValue(new Error('Database error'));
      
      await userController.handleCVUploadAuth(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to upload CV' });
    });
    
    it('should handle invalid tokens', async () => {
      mockRequest.cookies.token = 'invalid-token';
      mockRequest.file = { filename: 'invalid-token.pdf' };
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      await userController.handleCVUploadAuth(mockRequest, mockResponse);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Failed to upload CV' });
    });
  });
});

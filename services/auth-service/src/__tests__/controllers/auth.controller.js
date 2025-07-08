import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES using the ESM-friendly API
// ==================================================================

const mockDbClient = {
  query: jest.fn(),
  release: jest.fn(),
};

// Mock the database module
jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    connect: jest.fn().mockResolvedValue(mockDbClient),
    query: jest.fn(),
  },
}));

// Mock the bcrypt library
jest.unstable_mockModule('bcrypt', () => ({
  default: {
    hash: jest.fn(),
    compare: jest.fn(),
  },
}));

// Mock the jsonwebtoken library
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: jest.fn(),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================

let authController;
let db;
let bcrypt;
let jwt;

beforeAll(async () => {
  // Dynamically import the modules to ensure the mocked versions are used
  authController = await import('../../controllers/auth.controller.js');
  db = (await import('../../db/index.js')).default;
  bcrypt = (await import('bcrypt')).default;
  jwt = (await import('jsonwebtoken')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbClient.query.mockReset();
  });

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  describe('loginOptions', () => {
    it('should return available account types', () => {
      const req = {};
      const res = mockResponse();
      authController.loginOptions(req, res);
      expect(res.json).toHaveBeenCalledWith({ accountTypes: ["User", "Company"] });
    });
  });

  describe('registerAccount', () => {
    it('should create a user and return a token on success', async () => {
      const req = { body: { accountType: 'User', email: 'test@example.com', password: 'password123' } };
      const res = mockResponse();

      // FIX: Mock the full transaction sequence
      mockDbClient.query
        .mockResolvedValueOnce({}) // 1. BEGIN
        .mockResolvedValueOnce({ rows: [] }) // 2. No duplicate found
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 3. Insert returns new ID
        .mockResolvedValueOnce({}); // 4. COMMIT

      bcrypt.hash.mockResolvedValue('hashedpassword');
      jwt.sign.mockReturnValue('fake.jwt.token');

      await authController.registerAccount(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(jwt.sign).toHaveBeenCalledWith({ id: 1, type: 'User' }, expect.any(String), { expiresIn: '7d' });
      expect(res.cookie).toHaveBeenCalledWith('token', 'fake.jwt.token', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, accountId: 1 }));
    });

    it('should return 409 if account already exists', async () => {
        const req = { body: { accountType: 'User', email: 'test@example.com', password: 'password123' } };
        const res = mockResponse();

        // FIX: Mock the full transaction sequence for a duplicate
        mockDbClient.query
          .mockResolvedValueOnce({}) // 1. BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 2. Duplicate found
          .mockResolvedValueOnce({}); // 3. ROLLBACK

        await authController.registerAccount(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Account already exists' });
      });
  });

  describe('validateLogin', () => {
    it('should return 200 and a token on successful login', async () => {
        const req = { body: { accountType: 'User', email: 'test@example.com', password: 'password123' } };
        const res = mockResponse();
        const mockAccount = { id: 1, email: 'test@example.com', password_hash: 'hashedpassword', account_type: 'User' };

        db.query
          .mockResolvedValueOnce({ rows: [mockAccount] }) // 1. Find account
          .mockResolvedValueOnce({ rows: [] }); // 2. Profile check (no profile)
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('fake.jwt.token');

        await authController.validateLogin(req, res);

        expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
        expect(res.cookie).toHaveBeenCalledWith('token', 'fake.jwt.token', expect.any(Object));
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, id: 1, redirectURL: '/user/profile' }));
      });

      it('should return 401 for an incorrect password', async () => {
        const req = { body: { accountType: 'User', email: 'test@example.com', password: 'wrongpassword' } };
        const res = mockResponse();
        const mockAccount = { id: 1, password_hash: 'hashedpassword' };
        db.query.mockResolvedValue({ rows: [mockAccount] });
        bcrypt.compare.mockResolvedValue(false);

        await authController.validateLogin(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid credentials' });
      });
  });

  describe('logoutUser', () => {
    it('should clear the token cookie and return 200', () => {
        const req = {};
        const res = mockResponse();
        authController.logoutUser(req, res);
        expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
        expect(res.status).toHaveBeenCalledWith(200);
      });
  });

  describe('getLoggedInUser', () => {
    it('should return user data from req.user', async () => {
        const req = { user: { id: 1 } };
        const res = mockResponse();
        const mockAccount = { id: 1, account_type: 'User' };
        db.query.mockResolvedValue({ rows: [mockAccount] });

        await authController.getLoggedInUser(req, res);

        expect(db.query).toHaveBeenCalledWith(expect.any(String), [1]);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockAccount);
      });
  });
});

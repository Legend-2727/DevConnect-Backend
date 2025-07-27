import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let authenticate;
let jwt;

beforeAll(async () => {
  authenticate = (await import('../../middlewares/auth.middleware.js')).authenticate;
  jwt = (await import('jsonwebtoken')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('Auth Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      cookies: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should call next() and attach user to req if token is valid', () => {
    const fakeToken = 'valid.token.here';
    const decodedUser = { id: 1, type: 'User' };
    mockRequest.cookies.token = fakeToken;
    jwt.verify.mockReturnValue(decodedUser);

    authenticate(mockRequest, mockResponse, nextFunction);

    expect(jwt.verify).toHaveBeenCalledWith(fakeToken, expect.any(String));
    expect(mockRequest.user).toEqual(decodedUser);
    expect(nextFunction).toHaveBeenCalledTimes(1);
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return 401 if no token is provided', () => {
    authenticate(mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 403 if token is invalid', () => {
    mockRequest.cookies.token = 'invalid.token';
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    authenticate(mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});

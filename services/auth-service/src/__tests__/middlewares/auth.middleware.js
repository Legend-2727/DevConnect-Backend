import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================

// Mock the jsonwebtoken library
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
  // Dynamically import the modules to ensure the mocked versions are used
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

  // Re-create fresh mock objects before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      cookies: {}, // Initialize cookies object
    };
    mockResponse = {
      status: jest.fn(() => mockResponse),
      json: jest.fn(),
    };
    nextFunction = jest.fn(); // This is the mock for the `next` function in middleware
  });

  it('should call next() and attach user to req if token is valid', () => {
    // Arrange
    const fakeToken = 'valid.token.here';
    const decodedUser = { id: 1, type: 'User' };
    mockRequest.cookies.token = fakeToken;

    // Configure the mock jwt.verify to successfully decode the token
    jwt.verify.mockReturnValue(decodedUser);

    // Act
    authenticate(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(jwt.verify).toHaveBeenCalledWith(fakeToken, expect.any(String));
    expect(mockRequest.user).toEqual(decodedUser); // Check that the user was attached
    expect(nextFunction).toHaveBeenCalledTimes(1); // Check that we moved to the next middleware/controller
    expect(mockResponse.status).not.toHaveBeenCalled(); // Ensure no error response was sent
  });

  it('should return 401 if no token is provided in cookies', () => {
    // Arrange: No token is set on mockRequest.cookies

    // Act
    authenticate(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication token missing',
    });
    expect(nextFunction).not.toHaveBeenCalled(); // Ensure we did not proceed
  });

  it('should return 403 if token is invalid or expired', () => {
    // Arrange
    const fakeToken = 'invalid.or.expired.token';
    mockRequest.cookies.token = fakeToken;

    // Configure the mock jwt.verify to throw an error, simulating an invalid token
    jwt.verify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    // Act
    authenticate(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid or expired token',
    });
    expect(nextFunction).not.toHaveBeenCalled(); // Ensure we did not proceed
  });
});

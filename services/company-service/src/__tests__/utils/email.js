import { describe, it, expect, jest, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
const mockSendMail = jest.fn();
jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let emailUtil;

beforeAll(async () => {
    emailUtil = await import('../../utils/email.js');
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('Email Utility', () => {
  it('sendShortlistMail should format and send an email correctly', async () => {
    // Arrange
    const mailData = {
      to: 'company@example.com',
      company: { name: 'Test Corp' },
      job: { title: 'Software Engineer' },
      shortlist: [
        { user_id: 1, score: 95, justification: 'Great experience' },
      ],
    };

    // Act
    await emailUtil.sendShortlistMail(mailData);

    // Assert
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'company@example.com',
        subject: expect.stringContaining('Short-list for "Software Engineer" is ready'),
        text: expect.stringContaining('User #1 – score 95 – Great experience'),
      })
    );
  });
});

// Mock SMS Service for testing
export const smsService = {
    sendSMS: jest.fn().mockResolvedValue({ success: true, message: 'SMS sent' }),
    sendBulkSMS: jest.fn().mockResolvedValue({ success: true, message: 'Bulk SMS sent' })
};

export default smsService;

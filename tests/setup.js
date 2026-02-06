import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Mock scheduled jobs
jest.mock('../utils/scheduledJobs.js', () => ({
    initializeScheduledJobs: jest.fn()
}));

// Mock Cloudinary
jest.mock('../utils/upload.js', () => ({
    default: (req, res, next) => next()
}));

// Increase test timeout
jest.setTimeout(10000);

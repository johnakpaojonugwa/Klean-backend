import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.test') });

// Set dummy Twilio credentials for testing (must start with AC)
if (!process.env.TWILIO_ACCOUNT_SID) {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest1234567890abcdef1234567890';
}
if (!process.env.TWILIO_AUTH_TOKEN) {
    process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
}



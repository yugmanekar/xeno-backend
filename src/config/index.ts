import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  channelServiceUrl: process.env.CHANNEL_SERVICE_URL || 'http://localhost:3002',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  dbPath: process.env.DB_PATH || './xeno.db',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

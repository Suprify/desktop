// pages/api/api.js
import Cors from 'cors';
import type { NextApiRequest, NextApiResponse } from 'next';

// Initialize the CORS middleware
const cors = Cors({
  methods: ['GET', 'POST'], // Allow only GET and POST requests
});

// Helper method to handle CORS
const runCors = (req: NextApiRequest, res: NextApiResponse) => new Promise((resolve, reject) => {
  cors(req, res, result => {
    if (result instanceof Error) {
      return reject(result);
    }
    return resolve(result);
  });
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Run the CORS middleware
  await runCors(req, res);

  // Your API logic goes here
  // For example, if you want to return a JSON response
  res.status(200).json({ message: 'API route is working!' });
}

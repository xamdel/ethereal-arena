import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
// import llmApiRoutes from './routes/llm-api'; // Removed unused import
import { initializeSocketServer } from './socket'; // Import the new initializer

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Define allowed origins
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000', // Original client URL
  'http://localhost:5173' // Vite dev server default
];

// Middleware
app.use(cors({
  origin: allowedOrigins, // Allow multiple origins for Express routes too
  credentials: true
}));
app.use(express.json());

// Routes - only keep the LLM API routes which are still needed (if any)
// app.use('/api/llm', llmApiRoutes); // Commented out - assuming LLM interactions are via socket/engine now

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Ethereal Arena Game Server (WebSocket Mode)' });
});

// Initialize Socket.IO using the new module
const io = initializeSocketServer(server);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Removed all Socket.IO event handlers and helper functions from this file
// They are now located in server/src/socket/

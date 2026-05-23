import 'dotenv/config';   // Must be first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';
import path from 'path';
import agentRouter from './routes/agent.js';

const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/db';
const pool = new pg.Pool({ connectionString: dbUrl });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/agent', limiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/sessions', async (_req, res) => {
  try {
    const sessions = await prisma.session.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Workspace File Tree Explorer Endpoints
function getFileTree(dirPath, relativeDir = '') {
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    const tree = [];

    for (const item of items) {
      const relPath = path.join(relativeDir, item.name).replace(/\\/g, '/');
      const fullPath = path.join(dirPath, item.name);
      
      if (['node_modules', '.git', '.db', '.prisma', 'dist', 'build', '.DS_Store', 'package-lock.json', 'dev.db', 'dev.db-journal', 'dev.db-wal', 'dev.db-shm'].includes(item.name)) {
        continue;
      }
      
      if (item.isDirectory()) {
        tree.push({
          name: item.name,
          path: relPath,
          type: 'directory',
          children: getFileTree(fullPath, relPath)
        });
      } else {
        tree.push({
          name: item.name,
          path: relPath,
          type: 'file'
        });
      }
    }
    
    return tree.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch (e) {
    return [];
  }
}

app.get('/api/workspace/files', (req, res) => {
  let workspaceRoot = req.query.root ? path.resolve(req.query.root) : path.resolve(path.join(process.cwd(), '..'));
  
  // Verify directory exists
  if (!fs.existsSync(workspaceRoot) || !fs.statSync(workspaceRoot).isDirectory()) {
    return res.status(400).json({ error: 'Directory does not exist or is not a folder' });
  }

  const tree = getFileTree(workspaceRoot);
  res.json({ workspaceRoot, tree });
});

app.get('/api/workspace/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'Path is required' });
  
  let workspaceRoot = req.query.root ? path.resolve(req.query.root) : path.resolve(path.join(process.cwd(), '..'));
  const fullPath = path.resolve(path.join(workspaceRoot, filePath));
  
  // Case-insensitive startsWith check for Windows paths
  if (!fullPath.toLowerCase().startsWith(workspaceRoot.toLowerCase())) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(500).json({ error: `Failed to read file: ${err.message}` });
  }
});

app.use('/api/agent', agentRouter);

const PORT = process.env.PORT || 5001;

app.post('/api/debug/log', express.json(), (req, res) => {
  console.log(`[BROWSER ${req.body.type.toUpperCase()}] ${req.body.msg}`);
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🤖 Groq AI Agent running on port ${PORT}`);
});

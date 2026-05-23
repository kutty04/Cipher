import express from 'express';
import { runAgentLoop, runAgentLoopStream, API_STATUS } from '../services/groq.js';
import { prisma } from '../server.js';

const router = express.Router();

// Helper: get-or-create session and save user message
async function setupSession(message, sessionId) {
  let session;
  if (sessionId) {
    session = await prisma.session.findUnique({ where: { id: sessionId } });
  }
  if (!session) {
    session = await prisma.session.create({
      data: { title: message.slice(0, 40).replace(/\n/g, ' ') + '...' }
    });
  }
  await prisma.message.create({
    data: { sessionId: session.id, role: 'user', content: message.trim() }
  });
  const pastMessages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    take: 10
  });
  return { session, pastMessages };
}

// Shared validation middleware
function validateRequest(req, res) {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required' });
    return false;
  }
  if (message.length > 10000) {
    res.status(400).json({ error: 'Message too long (max 10,000 chars)' });
    return false;
  }
  return true;
}

// GET /api/agent/status - Expose current API status monitor
router.get('/status', (req, res) => {
  res.json(API_STATUS);
});

// POST /api/agent/stream (SSE streaming endpoint with Connection-Abort support)
router.post('/stream', async (req, res) => {
  if (!validateRequest(req, res)) return;
  const { message, sessionId } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const controller = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      console.log('[Agent/Stream] Connection aborted by client. Cancelling backend generation...');
      controller.abort();
    }
  });

  try {
    console.log(`[Agent/Stream] Request: "${message.slice(0, 80)}..."`);
    const startTime = Date.now();
    const { session, pastMessages } = await setupSession(message, sessionId);

    // Emit session ID immediately
    send('session', { sessionId: session.id });

    let fullText = '';
    const thinking = [];
    let modelUsed = 'llama-3.3-70b-versatile';

    const response = await runAgentLoopStream(pastMessages, {
      signal: controller.signal,
      onThinkingStep: (step) => {
        thinking.push(step);
        send('thinking', step);
      },
      onToken: (token) => {
        fullText += token;
        send('token', { token });
      },
      onFallback: (event) => {
        send('fallback', event);
      }
    });

    const durationMs = Date.now() - startTime;
    modelUsed = response.model || modelUsed;

    if (!controller.signal.aborted) {
      await prisma.message.create({
        data: {
          sessionId: session.id,
          role: 'agent',
          content: fullText || response.result || '',
          model: modelUsed,
          thinking: thinking.length ? JSON.stringify(thinking) : null
        }
      });
      send('done', { durationMs, iterations: thinking.length, model: modelUsed });
      console.log(`[Agent/Stream] Stream finished in ${durationMs}ms`);
    }
  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      console.log('[Agent/Stream] Stream request cancelled successfully.');
    } else {
      console.error('[Agent/Stream] Error:', error);
      send('error', { message: error.message || 'Agent failed' });
    }
  } finally {
    res.end();
  }
});

export default router;

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Stream a message to the agent via SSE.
 * Calls onThinking(step), onToken(token), onDone(meta), onError(msg).
 * Returns a cancel function.
 */
export function streamToAgent(message, sessionId = null, { onSession, onThinking, onToken, onFallback, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/agent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
        signal: controller.signal
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        let currentEvent = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'session') onSession?.(data);
              else if (currentEvent === 'thinking') onThinking?.(data);
              else if (currentEvent === 'token') onToken?.(data.token);
              else if (currentEvent === 'fallback') onFallback?.(data);
              else if (currentEvent === 'done') onDone?.(data);
              else if (currentEvent === 'error') onError?.(data.message);
            } catch (e) {
              // malformed JSON - skip
            }
            currentEvent = null;
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.(err.message || 'Stream failed');
      }
    }
  })();

  return () => controller.abort();
}

/**
 * Check if the backend is alive.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getSessions() {
  const res = await fetch(`${API_URL}/api/sessions`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function getSessionMessages(id) {
  const res = await fetch(`${API_URL}/api/sessions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch session');
  return res.json();
}

import OpenAI from 'openai';
import crypto from 'crypto';
import { tools } from '../tools/definitions.js';
import { executeCode } from '../tools/executor.js';
import { prisma } from '../server.js';

const SYSTEM_PROMPT = `You are a Senior AI Software Engineer. Help users debug, explain, and fix code.

ALWAYS structure responses like this:

🛠️ ROOT CAUSE: One sentence explaining why it failed.
💡 HOW IT WORKS (ELI5): Simple real-world analogy.
✅ THE FIX: Use the <compare> tag:
<compare>
<old>
// broken code here
</old>
<new>
// fixed code here
</new>
</compare>
🎓 PRO-TIP: One sentence of expert advice.

End with 2 follow-up options for the user.`;

// Unified Fallback Provider Chain
const PROVIDERS = [
  { id: 'groq', model: 'llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1', key: process.env.AGENT_GROQ_API_KEY },
  { id: 'gemini', model: 'gemini-2.5-flash', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', key: process.env.GEMINI_API_KEY },
  { id: 'mistral', model: 'codestral-latest', baseURL: 'https://api.mistral.ai/v1', key: process.env.MISTRAL_API_KEY }
].filter(p => !!p.key);

// Global API Status Tracker
export const API_STATUS = {
  providers: {
    groq: { name: 'Groq', model: 'llama-3.3-70b-versatile', status: process.env.AGENT_GROQ_API_KEY ? 'online' : 'disabled', queries: 0, errors: 0, lastUsed: null },
    gemini: { name: 'Gemini', model: 'gemini-2.5-flash', status: process.env.GEMINI_API_KEY ? 'online' : 'disabled', queries: 0, errors: 0, lastUsed: null },
    mistral: { name: 'Mistral', model: 'codestral-latest', status: process.env.MISTRAL_API_KEY ? 'online' : 'disabled', queries: 0, errors: 0, lastUsed: null }
  },
  fallbacks: [],
  cacheHits: { prompt: 0, search: 0 }
};

function sanitize(text) {
  if (!text) return '';
  return text.replace(/<function=[^>]*>[\s\S]*?<\/function>/g, '').replace(/<function=[^>]*>/g, '').trim();
}

function getCacheKey(pastMessages) {
  const serialized = JSON.stringify(pastMessages.map(m => ({ role: m.role, content: m.content })));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

async function streamCacheResult(cachedText, onToken, signal) {
  const words = cachedText.split(/(?<=\s)/);
  for (const word of words) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    onToken(word);
    await new Promise(r => setTimeout(r, 6)); // Fast typing effect
  }
}

// [Path C] Context Compression
function compressMessages(pastMessages) {
  if (pastMessages.length <= 8) return pastMessages;
  const sys = pastMessages.find(m => m.role === 'system');
  const userMessages = pastMessages.filter(m => m.role !== 'system');
  if (userMessages.length <= 6) return pastMessages;
  
  const firstUser = userMessages[0];
  const tail = userMessages.slice(-6);
  
  const result = [];
  if (sys) result.push(sys);
  if (firstUser) result.push(firstUser);
  result.push({ role: 'system', content: '[System Note: Older messages have been truncated to save context window.]' });
  result.push(...tail);
  return result;
}

// [Path B] API Fallback Wrappers
async function attemptLLM(callFn, onFallback = null) {
  for (let i = 0; i < PROVIDERS.length; i++) {
    const provider = PROVIDERS[i];
    const client = new OpenAI({ apiKey: provider.key, baseURL: provider.baseURL });
    
    // Set status to active
    if (API_STATUS.providers[provider.id]) {
      API_STATUS.providers[provider.id].status = 'active';
      API_STATUS.providers[provider.id].queries++;
      API_STATUS.providers[provider.id].lastUsed = new Date().toISOString();
    }

    // Retry loop for 429 rate-limit errors (up to 2 retries with backoff)
    let lastError = null;
    let succeeded = false;
    let successResult = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await callFn(client, provider.model);
        if (API_STATUS.providers[provider.id]) {
          API_STATUS.providers[provider.id].status = 'online';
        }
        succeeded = true;
        successResult = { result, modelUsed: provider.id };
        break;
      } catch (retryErr) {
        lastError = retryErr;
        const is429 = retryErr?.status === 429 || retryErr?.error?.code === 429 || (retryErr.message && retryErr.message.includes('429'));
        if (is429 && attempt < 2) {
          const waitMs = (attempt + 1) * 3000;
          console.log('[Retry] ' + provider.id + ' got 429, waiting ' + waitMs + 'ms before retry ' + (attempt + 2) + '/3');
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        break;
      }
    }

    if (succeeded) return successResult;

    // All retries for this provider failed — fallback to next
    const e = lastError;
    console.warn(`[Fallback] Provider ${provider.id} failed:`, e.message);
    if (API_STATUS.providers[provider.id]) {
      API_STATUS.providers[provider.id].status = 'error';
      API_STATUS.providers[provider.id].errors++;
    }
    
    if (e.name === 'AbortError') throw e;

    if (i < PROVIDERS.length - 1) {
      const nextProvider = PROVIDERS[i + 1];
      const event = {
        time: new Date().toISOString(),
        from: provider.id,
        to: nextProvider.id,
        reason: e.message || 'Rate limit or connection issue'
      };
      API_STATUS.fallbacks.push(event);
      if (onFallback) {
        onFallback(event);
      }
    }
    if (i === PROVIDERS.length - 1) throw e;
  }
}

async function callWithoutToolsStream(messages, onToken, signal, onFallback = null) {
  return attemptLLM(async (client, model) => {
    const stream = await client.chat.completions.create({
      model, max_tokens: 4096, temperature: 0.3, stream: true, messages
    }, { signal });
    
    let full = '';
    for await (const chunk of stream) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        full += token;
        onToken(token);
      }
    }
    return sanitize(full);
  }, onFallback);
}

async function executeTool(toolName, toolInput, thinkingSteps, iterations) {
  const step = { iteration: iterations, tool: toolName, input: toolInput, timestamp: new Date().toISOString() };
  let result;
  switch (toolName) {
    case 'run_code':
      result = await executeCode(toolInput.code, toolInput.description);
      step.result_summary = result.success ? `Output: ${(result.output||'').slice(0,120)}` : `Error: ${(result.error||'').slice(0,120)}`;
      break;
    case 'analyze_error':
      result = { received: true, error_message: toolInput.error_message };
      step.result_summary = 'Error analysis initiated';
      break;
    case 'explain_code':
      result = { received: true, code_length: toolInput.code?.length || 0 };
      step.result_summary = 'Code explanation initiated';
      break;
    case 'generate_fix':
      result = { received: true, problem: toolInput.problem_description };
      step.result_summary = 'Fix generation initiated';
      break;
    case 'search_docs':
      result = await searchDocsTavily(toolInput.query);
      step.result_summary = `Searched: ${toolInput.query}`;
      break;
    default:
      result = { error: `Unknown tool: ${toolName}` };
      step.result_summary = 'Unknown tool';
  }
  step.result = result;
  thinkingSteps.push(step);
  return { step, result };
}

//  Real Tavily Web Search (with Cache lookup) 
async function searchDocsTavily(query) {
  const normQuery = query.trim().toLowerCase();
  try {
    const cachedSearch = await prisma.searchCache.findUnique({ where: { query: normQuery } });
    if (cachedSearch) {
      API_STATUS.cacheHits.search++;
      return JSON.parse(cachedSearch.results);
    }
  } catch (err) {}

  try {
    if (!process.env.TAVILY_API_KEY) return { error: 'TAVILY_API_KEY missing.' };
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, search_depth: 'basic', include_answer: true, max_results: 3 })
    });
    if (!resp.ok) throw new Error(`Tavily ${resp.status}`);
    const data = await resp.json();
    const formatted = {
      query, answer: data.answer || null,
      results: data.results?.map(r => ({ title: r.title, url: r.url, snippet: r.content })) || [],
      source: 'Tavily Web Search'
    };
    try {
      await prisma.searchCache.create({ data: { query: normQuery, results: JSON.stringify(formatted) }});
    } catch (err) {}
    return formatted;
  } catch (err) {
    return { query, error: err.message };
  }
}

export async function runAgentLoop(pastMessages) {
  throw new Error("runAgentLoop (classic) is deprecated. Use runAgentLoopStream.");
}

export async function runAgentLoopStream(pastMessagesRaw, { signal, onThinkingStep, onToken, onFallback }) {
  const cacheKey = getCacheKey(pastMessagesRaw);

  try {
    const cached = await prisma.responseCache.findUnique({ where: { prompt: cacheKey } });
    if (cached) {
      console.log(`[Cache Hit/Stream] Streaming response for hash: ${cacheKey}`);
      API_STATUS.cacheHits.prompt++;
      if (cached.thinking) {
        const steps = JSON.parse(cached.thinking);
        for (const step of steps) onThinkingStep(step);
      }
      await streamCacheResult(cached.response, onToken, signal);
      return { thinking: cached.thinking ? JSON.parse(cached.thinking) : [], iterations: 0, model: `cached`, result: cached.response };
    }
  } catch (err) {}

  // Apply Context Compression
  const pastMessages = compressMessages(pastMessagesRaw);
  
  const baseMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...pastMessages.map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }))
  ];
  const messages = [...baseMessages];

  const thinkingSteps = [];
  const MAX_ITERATIONS = 8;
  let iterations = 0;
  let finalResult = '';
  let modelUsed = PROVIDERS[0].id;

  while (iterations < MAX_ITERATIONS) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    iterations++;

    // Probe with fallback wrapper
    let probeResponse;
    try {
      probeResponse = await attemptLLM(async (client, model) => {
        const resp = await client.chat.completions.create({
          model, max_tokens: 4096, temperature: 0.3, tools, tool_choice: 'auto', messages
        }, { signal });
        return { resp, model };
      }, onFallback);
      modelUsed = probeResponse.modelUsed;
    } catch (e) {
      if (e.name === 'AbortError' || signal?.aborted) throw e;
      
      const fallbackStream = await callWithoutToolsStream(baseMessages, onToken, signal, onFallback);
      modelUsed = fallbackStream.modelUsed;
      finalResult = fallbackStream.result;
      try { await prisma.responseCache.create({ data: { prompt: cacheKey, response: finalResult, thinking: JSON.stringify(thinkingSteps) } }); } catch (_) {}
      return { thinking: thinkingSteps, iterations, model: modelUsed, result: finalResult };
    }

    const choice = probeResponse.result.resp.choices[0];
    const assistantMessage = choice.message;

    if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
      messages.push(assistantMessage);
      for (const toolCall of assistantMessage.tool_calls) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const toolInput = JSON.parse(toolCall.function.arguments);
        const { step, result } = await executeTool(toolCall.function.name, toolInput, thinkingSteps, iterations);
        onThinkingStep(step);
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
      }
    } else {
      const streamMessages = [...baseMessages];
      if (thinkingSteps.length > 0) {
        const summary = thinkingSteps.map(s => `${s.tool}: ${s.result_summary || 'done'}`).join('; ');
        streamMessages.push({ role: 'user', content: `[Context: ${summary}] Now answer the original question.` });
      }
      
      const streamResult = await callWithoutToolsStream(streamMessages, onToken, signal, onFallback);
      finalResult = streamResult.result;
      modelUsed = streamResult.modelUsed;
      
      try { await prisma.responseCache.create({ data: { prompt: cacheKey, response: finalResult, thinking: thinkingSteps.length ? JSON.stringify(thinkingSteps) : null } }); } catch (_) {}
      return { thinking: thinkingSteps, iterations, model: modelUsed, result: finalResult };
    }
  }

  return { thinking: thinkingSteps, iterations, model: modelUsed, result: '' };
}

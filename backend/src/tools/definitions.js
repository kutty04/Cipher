/**
 * Tool definitions for the Groq agent.
 * 
 * IMPORTANT: Groq uses OpenAI-compatible format:
 *   { type: "function", function: { name, description, parameters } }
 * 
 * This is DIFFERENT from Anthropic's format:
 *   { name, description, input_schema }
 */
export const tools = [
  {
    type: 'function',
    function: {
      name: 'run_code',
      description: 'Execute JavaScript code in a safe sandbox and return the output or error. Use this to test code snippets, debug logic, verify calculations, or confirm fixes work.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Valid JavaScript code to execute'
          },
          description: {
            type: 'string',
            description: 'What this code does and why you are running it'
          }
        },
        required: ['code', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_error',
      description: 'Deep-analyze an error message to identify the root cause, affected code patterns, and suggest specific targeted fixes.',
      parameters: {
        type: 'object',
        properties: {
          error_message: {
            type: 'string',
            description: 'The full error message or stack trace'
          },
          code_context: {
            type: 'string',
            description: 'The code surrounding where the error occurred'
          },
          language: {
            type: 'string',
            description: 'Programming language (e.g. javascript, python, typescript)'
          }
        },
        required: ['error_message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'explain_code',
      description: 'Break down a piece of code and explain what each part does in plain English. Great for understanding unfamiliar code.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The code to explain'
          },
          detail_level: {
            type: 'string',
            enum: ['brief', 'detailed', 'line_by_line'],
            description: 'How detailed the explanation should be'
          }
        },
        required: ['code']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_fix',
      description: 'Generate a corrected version of buggy code with a clear explanation of exactly what was changed and why.',
      parameters: {
        type: 'object',
        properties: {
          buggy_code: {
            type: 'string',
            description: 'The broken code that needs fixing'
          },
          problem_description: {
            type: 'string',
            description: 'A description of what is wrong with the code'
          }
        },
        required: ['buggy_code', 'problem_description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_docs',
      description: 'Search programming documentation and best practices for a specific topic, library method, or error type.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to look up (e.g. "React useEffect dependencies", "Python asyncio errors", "Array.map vs forEach")'
          }
        },
        required: ['query']
      }
    }
  }
];

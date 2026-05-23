import vm from 'vm';

/**
 * Safely execute JavaScript code in a sandboxed environment.
 * Returns stdout output, return value, or error details.
 * 
 * Uses Node's built-in `vm` module — no external dependencies.
 * Timeout: 5 seconds. No file system or network access inside sandbox.
 */
export async function executeCode(code, description = '') {
  const logs = [];
  const errors = [];

  // Create a sandboxed console that captures output
  const sandboxConsole = {
    log: (...args) => logs.push(args.map(a => formatValue(a)).join(' ')),
    error: (...args) => errors.push(args.map(a => formatValue(a)).join(' ')),
    warn: (...args) => logs.push('[WARN] ' + args.map(a => formatValue(a)).join(' ')),
    info: (...args) => logs.push('[INFO] ' + args.map(a => formatValue(a)).join(' ')),
    table: (data) => logs.push('[TABLE]\n' + JSON.stringify(data, null, 2)),
  };

  // Sandbox — only expose safe globals, NO require/process/fs
  const sandbox = {
    console: sandboxConsole,
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    RegExp,
    Error,
    Promise,
    setTimeout: () => {},   // No-op — can't truly async in vm
    clearTimeout: () => {},
  };

  try {
    // Wrap code to capture any thrown errors gracefully
    const wrappedCode = `
      (function() {
        try {
          ${code}
        } catch(e) {
          console.error('Runtime error: ' + e.message);
        }
      })();
    `;

    vm.runInNewContext(wrappedCode, sandbox, {
      timeout: 5000,       // 5 second hard limit
      displayErrors: true
    });

    return {
      success: true,
      output: logs.join('\n') || '(no console output)',
      errors: errors.length > 0 ? errors.join('\n') : null,
      description
    };

  } catch (error) {
    // VM-level errors: syntax errors, timeout exceeded, etc.
    return {
      success: false,
      output: null,
      error: error.message,
      errorType: error.constructor.name,
      description
    };
  }
}

function formatValue(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

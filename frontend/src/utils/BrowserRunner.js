/**
 * Executes JavaScript code safely in an isolated, sandboxed iframe.
 * Captures all console logs and errors, returning the final output.
 */
export function runCodeClientSide(code) {
  return new Promise((resolve) => {
    const logs = [];
    const iframe = document.createElement('iframe');
    
    // Sandbox restriction: allow-scripts but NO access to parent cookies/DOM
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // Channel to receive console logs from the iframe
    const channelName = `runner_${Math.random().toString(36).substr(2, 9)}`;
    window[channelName] = (type, message) => {
      logs.push(`[${type.toUpperCase()}] ${message}`);
    };

    const runnerHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          const parentLog = window.parent['${channelName}'];
          
          // Override console outputs
          const capture = (type) => (...args) => {
            const msg = args.map(arg => {
              if (typeof arg === 'object') {
                try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
              }
              return String(arg);
            }).join(' ');
            parentLog(type, msg);
          };
          
          console.log = capture('log');
          console.error = capture('error');
          console.warn = capture('warn');
          console.info = capture('info');
          
          window.onerror = (message, source, lineno, colno, error) => {
            parentLog('error', \`Runtime error: \${message} (line \${lineno})\`);
            return true;
          };
        </script>
      </head>
      <body>
        <script>
          (async () => {
            try {
              // Wrap code in async IIFE to support top-level await
              const result = await eval(\`(async () => { 
                ${code} 
              })()\`);
              if (result !== undefined) {
                console.log('Returned:', result);
              }
            } catch (err) {
              console.error(err.message);
            }
          })();
        </script>
      </body>
      </html>
    `;

    iframe.srcdoc = runnerHTML;

    // Hard timeout of 3 seconds to prevent infinite loops from locking the main tab
    const timeoutId = setTimeout(() => {
      cleanup('Timeout exceeded (3s limit). Possible infinite loop detected.');
    }, 3000);

    function cleanup(errorMsg = null) {
      clearTimeout(timeoutId);
      if (errorMsg) {
        logs.push(`[ERROR] ${errorMsg}`);
      }
      try {
        document.body.removeChild(iframe);
      } catch (e) {}
      delete window[channelName];
      resolve(logs.join('\n') || '(no outputs)');
    }

    // Give iframe a moment to mount and run
    iframe.onload = () => {
      setTimeout(() => cleanup(), 50);
    };
  });
}

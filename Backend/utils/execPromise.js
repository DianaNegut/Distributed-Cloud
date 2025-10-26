const { exec } = require('child_process');

function execPromise(command, options = {}) {
  return new Promise((resolve, reject) => {
    const execOptions = {
      ...options,
      shell: true,
      windowsHide: true,
      env: { ...process.env, ...options.env }
    };

    console.log(`[EXEC] Executare: ${command}`);
    exec(command, execOptions, (error, stdout, stderr) => {
      if (error) {
        console.error(`[EXEC]  Eroare la: ${command}`);
        console.error(stderr);
        reject({ error: error.message, stderr });
      } else {
        console.log(`[EXEC]  Succes: ${command}`);
        resolve({ stdout, stderr });
      }
    });
  });
}

module.exports = { execPromise };

/**
 * Claude Code'u gerçek terminal penceresinde çalıştırır.
 * Çıktı hem terminale yazdırılır hem de bittiğinde API'ye gönderilir (run kaydı güncelleme).
 * Kullanım: node scripts/run-in-terminal.js --runId=1 --taskId=1 --promptPath=... --cwd=... --model=... --apiUrl=http://localhost:3999
 */

const { spawn } = require("child_process");

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const key = eq > 0 ? arg.slice(2, eq) : arg.slice(2);
      let val = eq > 0 ? arg.slice(eq + 1) : "";
      if (val.length >= 2 && (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      args[key] = val;
    }
  }
  return args;
}

const {
  runId,
  taskId,
  promptPath,
  cwd,
  model,
  apiUrl,
  cliBin: cliBinArg
} = parseArgs();

if (!runId || !promptPath || !cwd || !model || !apiUrl) {
  console.error("Eksik argüman: runId, promptPath, cwd, model, apiUrl zorunlu.");
  process.exit(1);
}

const cliBin = cliBinArg || process.env.CLAUDE_CLI_BIN || process.env.CLAUDE_CODE_BIN || "claude";

const child = spawn(cliBin, ["run", "--model", model, "--file", promptPath, "--cwd", cwd], {
  cwd,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"]
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  const s = chunk.toString();
  stdout += s;
  process.stdout.write(s);
});

child.stderr.on("data", (chunk) => {
  const s = chunk.toString();
  stderr += s;
  process.stderr.write(s);
});

child.on("close", (code) => {
  const exitCode = code !== null && code !== undefined ? code : -1;
  const baseUrl = apiUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/run/finished`;

  const body = JSON.stringify({
    runId: Number(runId),
    taskId: taskId ? Number(taskId) : undefined,
    exitCode,
    stdout,
    stderr
  });

  const http = require("http");
  const urlObj = new URL(url);
  const req = http.request(
    {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body, "utf8")
      }
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          console.error("\n[API] run/finished hatası:", res.statusCode, data);
        }
      });
    }
  );
  req.on("error", (err) => {
    console.error("\n[API] run/finished isteği gönderilemedi:", err.message);
  });
  req.write(body);
  req.end();
});

child.on("error", (err) => {
  console.error("Claude CLI çalıştırılamadı:", err.message);
  process.exit(1);
});

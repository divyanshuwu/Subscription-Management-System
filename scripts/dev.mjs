import { spawn } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  writeFileSync(
    ".env",
    readFileSync(".env", "utf8").replace(
      "replace-with-a-random-secret-at-least-32-characters-long",
      randomBytes(48).toString("hex"),
    ),
  );
}
const seed = spawn(process.execPath, ["backend/seed.mjs"], {
  stdio: "inherit",
});
seed.on("exit", (code) => {
  if (code) process.exit(code);
  const api = spawn(process.execPath, ["backend/server.mjs"], {
    stdio: "inherit",
  });
  const ui = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    stdio: "inherit",
  });
  for (const sig of ["SIGINT", "SIGTERM"])
    process.on(sig, () => {
      api.kill(sig);
      ui.kill(sig);
    });
});

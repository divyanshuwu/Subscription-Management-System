import { spawnSync } from "node:child_process";
const build = spawnSync("npx", ["vite", "build", "--outDir", "dist-api"], {
  stdio: "inherit",
  env: { ...process.env, VITE_API_URL: "http://127.0.0.1:4098/api" },
});
if (build.status) process.exit(build.status);
const test = spawnSync(process.execPath, ["scripts/local_ui_test.mjs"], {
  stdio: "inherit",
});
process.exit(test.status || 0);

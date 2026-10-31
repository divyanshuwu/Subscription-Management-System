import { spawnSync } from "node:child_process";
// Demo suite must not inherit a developer's API-connected .env configuration.
const build = spawnSync(
  "npx",
  ["vite", "build", "--outDir", "artifacts/demo-web"],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", VITE_API_URL: "" },
  },
);
if (build.status) process.exit(build.status);
const result = spawnSync(process.execPath, ["scripts/ui_test.mjs"], {
  stdio: "inherit",
  env: { ...process.env, UI_TEST_ROOT: "artifacts/demo-web" },
});
process.exit(result.status || 0);

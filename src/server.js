import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const { ensureE2ETestUser } = await import("./e2e-test-user.js");
try {
  const result = await ensureE2ETestUser();
  if (result.enabled) console.log(`E2E test account: ${result.created ? "created" : "verified"}`);
} catch (error) {
  console.error(`E2E test account setup failed: ${error.message}`);
}

const { createApp } = await import("./app.js");
const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => {
  const dataConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
  console.log(`Atlas Harbor is running at http://localhost:${port}`);
  console.log(`Account data: ${dataConfigured ? "configured" : "not configured"}`);
  console.log('Admin storage uses the existing authenticated game_progress data store.');
});

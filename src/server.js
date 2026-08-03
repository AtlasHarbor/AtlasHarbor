import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => {
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
  console.log(`Atlas Harbor is running at http://localhost:${port}`);
  console.log(`Supabase: ${supabaseConfigured ? "configured" : "not configured"}`);
});

# AI account settings

Atlas Harbor supports OpenRouter by default and other OpenAI-compatible chat-completions endpoints.

## Database migration

Run both files in the Supabase SQL editor:

1. `supabase/schema.sql`
2. `supabase/ai-settings.sql`

The second migration adds the user-selected provider, base URL, free-form model ID, and the result/time/error from the latest connection test. It is safe to rerun.

API keys are deliberately not stored in Supabase. They remain in the user's browser local storage.

## Account workflow

At `/account`, a signed-in user can:

- paste any model identifier manually;
- keep the default `https://openrouter.ai/api/v1` endpoint;
- enter another OpenAI-compatible API base URL;
- search the endpoint's `/models` catalog when it is available to browser requests;
- view OpenRouter input/output prices converted from per-token values to USD per million tokens;
- save settings and automatically send a minimal `hello` test request;
- see whether the latest test succeeded, when it ran, and the last provider error.

OpenRouter's model catalog returns pricing in USD per token. Atlas Harbor multiplies prompt and completion prices by 1,000,000 for display. Custom model catalogs may omit pricing.

## Custom endpoint behavior

For OpenRouter, Atlas Harbor uses its authenticated server proxy. For other endpoints, the browser sends an OpenAI-compatible request to `<base URL>/chat/completions`. The endpoint must permit browser CORS requests. The key is sent only to the endpoint selected by the user.

A custom endpoint should accept a request shaped like:

```json
{
  "model": "your-model-id",
  "messages": [{"role": "user", "content": "Hello"}],
  "temperature": 0.3
}
```

and return text at `choices[0].message.content`.

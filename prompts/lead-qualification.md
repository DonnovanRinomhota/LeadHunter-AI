# Lead qualification prompt

The prompt is in `src/server/qualification/prompt.ts`, so the app and its tests use one copy. Change `PROMPT_VERSION` whenever you change the wording.

Run `npm run eval:live` after any change. It calls Claude for every lead in `evals/sample-leads.json`, so it costs money. It needs `QUALIFICATION_MODE=live`, `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in `.env.local`.

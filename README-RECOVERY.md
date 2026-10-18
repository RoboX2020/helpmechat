# Recovered deployed source (v0.3.3)

This branch contains the true running source of HelpMeChat, recovered on 2026-10-17
from the published Chrome Web Store package and the live Cloudflare worker
(the repo's main branch was stale from June).

- extension/ - the exact 0.3.3 package submitted to the Chrome Web Store
  (manifest v3, minified build output as deployed).
- worker.js - the exact deployed Cloudflare worker source (helpmechat-api-prep,
  version public-preview-v2): endpoints /v1/status, /v1/session, /v1/generate,
  budget-capped ($4 total via MAX_CENTS=400), 50 generations per session,
  6 generations and 3 signups per network per day, OpenAI key as encrypted secret.
- Privacy page module (fc9c9cb03fecf90629dbe233db41a38abe373646-privacy.html)
  is served by the worker as the landing page; the deployed copy is embedded in
  the worker's module bundle.

---
name: material-hub-ima-sync
description: Inspect configuration and explicitly synchronize local material-hub cards with the fixed IMA knowledge base. Use when the user asks to push material cards to IMA, pull or inventory IMA knowledge, reconcile local and IMA records, or perform bidirectional knowledge-base synchronization.
---

# Material Hub IMA Sync

Work from `E:\Project\hotspot-collector`. Use the global `ima-skill` for official IMA OpenAPI operations.

Run only on explicit sync requests. Collection, Digest generation, and card production remain local by default.
Browser collection, BiliSum notes, and material-card generation must finish before IMA sync begins.

1. Run `npm.cmd run material:config-status` without displaying secrets.
2. Require the fixed `knowledgeBaseId`, Client ID, and API key.
3. Read the relevant `ima-skill` knowledge-base instructions before API operations.
4. Push approved material-card Markdown unchanged and preserve its filename.
5. Pull/inventory the fixed knowledge base and report `linked`, `missing-in-ima`, `ima-only`, `duplicate-title`, or `needs-resync`.
6. For bidirectional sync, inventory both sides first. Never overwrite ambiguous duplicates automatically.

- Do not upload Bilibili/YouTube URLs or video files through IMA OpenAPI; upload generated documents instead.
- Preserve UTF-8 and original filenames.
- Do not print credentials or mark success before IMA returns an identifier.

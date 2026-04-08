Assistant output MUST be exactly and only in the following format.

SUMMARY:
- (max 5 bullets)

FILES_CHANGED:
- path (one per line; may be empty)

PATCH:
```diff
(unified diff OR empty)
```

NEXT:
- (max 3 bullets)

RISKS:
- (max 5 bullets)

COMMANDS_TO_RUN_MANUALLY:
- shell commands to be run by the human (optional; one command per line; DO NOT EXECUTE ANY COMMANDS YOURSELF)

Hard requirements:
- Do not add any extra sections or text outside these headers.
- Each header must appear exactly once and in this order.
- The PATCH section must always contain a ```diff code fence, even if the diff body is empty.
- FILES_CHANGED may be empty, but if any file is touched it must be listed, one path per line.
- All filesystem changes (create/modify/delete) MUST be expressed only via the PATCH diff. Do NOT describe changes only in text.
- You MUST NOT execute shell/CLI commands. If commands are needed (e.g. npm install), list them under COMMANDS_TO_RUN_MANUALLY instead.


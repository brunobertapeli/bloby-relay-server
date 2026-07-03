---
title: "File Saving"
---

The file saver (`supervisor/file-saver.ts`) handles persistence of attachments
(images, documents) and voice clips sent through the Morphy chat interface.

### 8.1 Directory Structure

Three directories are created under `workspace/files/` by `ensureFileDirs()`:

```
workspace/
  files/
    audio/      -> paths.filesAudio
    images/     -> paths.filesImages
    documents/  -> paths.filesDocuments
```

Paths are defined in `shared/paths.ts`.

### 8.2 Attachment Saving

The `saveAttachment()` function processes a single attachment:

**Input**: An object with `type` (`'image'` | `'file'`), `name`, `mediaType`, and
`data` (base64-encoded content).

**Size limits**: Each file is capped at `MAX_ATTACHMENT_BYTES` (12 MB of decoded
bytes). Callers additionally bound each message to `MAX_ATTACHMENTS_PER_MESSAGE`
(12 files) and `MAX_TOTAL_ATTACHMENT_BYTES` (48 MB total).

**Content sniffing**: `sniffMediaType()` inspects magic bytes (PNG, JPEG, GIF,
WebP, PDF, ZIP). When it recognizes the content, the sniffed type overrides the
client-claimed `mediaType` and decides both the images/documents category and the
extension, so a client cannot mislabel a PDF as `image/png` or vice versa.

**Filename generation**: `stampPrefix()` combines a timestamp (YYYYMMDD_HHMMSS
format) and 6 random hex characters; the extension is appended:

```
20260303_143022_a1b2c3.png
```

The extension is resolved from (in priority order):

1. The `EXT_FROM_MIME` lookup table, keyed by the effective (sniffed-or-claimed)
   media type. It covers common image, document, and archive types.
2. A sanitized extension taken from the client filename.
3. Fallback: `'bin'`. The raw client name is never used for the on-disk path.

**Output**: A `SavedFile` object containing:

- `type`: `'image'` or `'document'`
- `name`: Original filename, sanitized by `sanitizeName()` (display only)
- `mediaType`: Effective MIME type
- `relPath`: Path relative to `workspace/files/` (e.g., `images/20260303_143022_a1b2c3.png`),
  served back to the chat at `/api/files/<relPath>`
- `absPath`: Absolute filesystem path

The decoded content is written synchronously:

```typescript
// file-saver.ts
fs.writeFileSync(absPath, buf);
```

A companion `saveAudio()` persists voice clips to `files/audio/` and returns their
`relPath`, which rides on the message as `meta.audio_data` so the chat can replay
the clip after a refresh.

### 8.3 Integration with Chat

In the supervisor's chat handlers (both the chat WebSocket path and the workspace
chat HTTP route in `supervisor/index.ts`), attachments are saved before the agent
query begins. The saved file metadata is included in the user message persisted
to the database:

```typescript
// supervisor/index.ts
if (savedFiles.length) {
  meta.attachments = JSON.stringify(savedFiles.map((f) => ({
    type: f.type, name: f.name, mediaType: f.mediaType, filePath: f.relPath,
  })));
}
```

Only the attachments that actually saved within the caps are handed to the agent
harness, so the model sees exactly what was persisted and shown in chat.

---
title: "File Saving"
---

The file saver handles persistence of attachments (images, documents) sent through
the Bloby chat interface.

### 8.1 Directory Structure

Three directories are created under `workspace/files/` by `ensureFileDirs()` (lines
13-17):

```
workspace/
  files/
    audio/      -> paths.filesAudio
    images/     -> paths.filesImages
    documents/  -> paths.filesDocuments
```

Paths are defined in `shared/paths.ts` (lines 16-19).

### 8.2 Attachment Saving

The `saveAttachment()` function (lines 19-50) processes a single attachment:

**Input**: An object with `type` (`'image'` | `'file'`), `name`, `mediaType`, and
`data` (base64-encoded content).

**Filename generation** (lines 23-35): Combines a timestamp (YYYYMMDD_HHMMSS format),
6 random hex characters, and the file extension:

```
20260303_143022_a1b2c3.png
```

The extension is resolved from (in priority order):

1. The original filename's extension.
2. A MIME-type-to-extension lookup table (supports png, jpg, gif, webp, pdf, txt, csv).
3. Fallback: `'bin'`.

**Output**: A `SavedFile` object containing:

- `type`: `'image'` or `'document'`
- `name`: Original filename
- `mediaType`: MIME type
- `relPath`: Relative path from workspace root (e.g., `files/images/20260303_143022_a1b2c3.png`)
- `absPath`: Absolute filesystem path

The file content is decoded from base64 and written synchronously (line 41):

```typescript
// file-saver.ts, line 41
fs.writeFileSync(absPath, Buffer.from(att.data, 'base64'));
```

### 8.3 Integration with Chat

In the supervisor's chat handler (lines 449-459), attachments are saved before the
AI query begins. The saved file metadata is included in the user message persisted
to the database:

```typescript
// supervisor/index.ts, lines 484-489
if (savedFiles.length) {
  meta.attachments = JSON.stringify(savedFiles.map((f) => ({
    type: f.type, name: f.name, mediaType: f.mediaType, filePath: f.relPath,
  })));
}
```

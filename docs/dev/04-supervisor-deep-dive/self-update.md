---
title: "Self-Update"
---

The `runDeferredUpdate()` function (lines 683-711) spawns a detached `bloby update`
process that survives the supervisor's own restart. Platform-specific strategies:

- **Linux**: Uses `sudo systemd-run` to create a transient systemd unit
  (`bloby-update`) that persists even when the daemon restarts:

  ```typescript
  cpSpawn('sudo', ['systemd-run', '--quiet', '--unit=bloby-update',
    '--uid=' + user, ...env_flags,
    process.execPath, cliPath, 'update'], { detached: true, stdio: 'ignore' });
  ```

- **macOS / other**: Uses a standard detached child process with `child.unref()`:

  ```typescript
  cpSpawn(process.execPath, [cliPath, 'update'], {
    detached: true, stdio: 'ignore', env: { ...process.env },
  });
  ```

The update can be triggered by creating a `.update` file in the workspace directory,
or deferred if an agent query is active (`pendingUpdate` flag, lines 768-777).

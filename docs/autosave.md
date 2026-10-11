# Autosave

Autosave writes a backup when project data or the overview camera changes.
It runs after edits rather than on a timer. Normal **Save** still updates the
project file; autosave writes a separate CSV.

### Storage locations

| Project | Backup |
| --- | --- |
| Saved or opened from a file | `autosave.csv` in the same folder. |
| Not saved yet | `autosave.csv` in the app's user-data folder. |
| Opened from `autosave.csv` | `autosave-backup.csv` in the same folder. |

The same rules apply on Windows and macOS. The app gets its user-data folder
from Electron's `app.getPath("userData")`.

`autosave-location.json` in that folder records the latest backup and original
project paths. Projects in the same folder share one `autosave.csv`, so later
edits can replace another project's backup. There is no backup history.
After **Save As…**, autosave follows the new project path. Old backups are left
in place.

### Recovery

On Home, click the entry under **Autosave** to restore the latest backup.
If there is no backup, the section shows **No autosaved project**.
After restoring, use **Save** to update the original file or **Save As…** to
keep a separate copy.

Choosing **Don't save** when leaving keeps the latest backup, but leaves the
project file unchanged. Opening or starting a project does not immediately
replace the backup; editing it does.

### Recovery limits and errors

Autosave uses the same project CSV serializer as normal **Save**, including
individuals, groups, display settings, grave dimensions, named graves, outlines,
grave assignments, photographs, camera state and the Height/RL preference with
its floor RL value. Changes to these fields trigger autosave. Camera changes
trigger autosave when navigation ends. Recovery parses the full backup CSV.

Changes to `jointDetails` also trigger autosave, but that object is not written
to the backup CSV.

If autosave fails, an error appears in the app. Save manually before continuing.
Missing backups are treated as normal; corrupt files and permission errors are
reported. Moving or deleting the backup can prevent recovery.

### Code and tests

`App.jsx` sends changed snapshots through the preload API and waits for pending
autosave before leaving a project. `main.js` handles the IPC calls and flushes
pending writes before closing.

`src/autosave.js` queues writes, writes each file to a `.tmp` path, then renames
it. Recovery reads the recorded backup path and checks the CSV with
`csvToProject()`. Older version-1 `autosave.json` files can still be recovered
when the CSV is missing.

The `ENOENT` checks distinguish missing files from other failures. Removing
these checks would either report missing backups as errors or hide real failures.

Run the theme and autosave tests with:

```bash
node --test tests/theme/theme.test.mjs tests/autosave/autosave.test.mjs
```

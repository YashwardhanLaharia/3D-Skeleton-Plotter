import fs from "node:fs/promises";
import path from "node:path";
import { csvToProject } from "./csvImport.js";

export function createAutosaveStore(directory) {
  const fallback = path.join(directory, "autosave.csv");
  const locationFile = path.join(directory, "autosave-location.json");
  let pending = Promise.resolve();
  return {
    save(snapshot) {
      const text = snapshot.payload;
      const filePath = snapshot.filePath || null;
      let target = filePath ? path.join(path.dirname(filePath), "autosave.csv") : fallback;
      // Opening the backup itself must not make autosave overwrite the open project.
      if (filePath && path.resolve(target) === path.resolve(filePath)) {
        target = path.join(path.dirname(filePath), "autosave-backup.csv");
      }
      const write = pending.then(async () => {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(`${target}.tmp`, text, "utf8");
        await fs.rename(`${target}.tmp`, target);
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(`${locationFile}.tmp`, JSON.stringify({ target, filePath }), "utf8");
        await fs.rename(`${locationFile}.tmp`, locationFile);
      });
      pending = write.catch(() => {});
      return write;
    },
    async read() {
      await pending;
      let target = fallback;
      let filePath = null;
      try {
        const location = JSON.parse(await fs.readFile(locationFile, "utf8"));
        target = location.target;
        filePath = location.filePath;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      try {
        const payload = await fs.readFile(target, "utf8");
        const project = csvToProject(payload);
        if (!project.ok) throw new Error(project.error || "Invalid autosaved project");
        return { payload, filePath };
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      // Recover backups created before autosave used the project file format.
      try {
        const snapshot = JSON.parse(await fs.readFile(path.join(directory, "autosave.json"), "utf8"));
        if (snapshot.version !== 1 || typeof snapshot.payload !== "string") {
          throw new Error("Not autosave format");
        }
        return snapshot;
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    flush() { return pending; },
  };
}

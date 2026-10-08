import { JOINTS } from "./joints.js";
import { validateImageOverlay } from "./overlayAsset.js";
import { validateProjectView } from "./projectView.js";
import {
  validateContour,
  validateContourReference,
} from "./graveContourData.js";
import { DEFAULT_VERTICAL, VERTICAL_CONVENTIONS } from "./sceneSpace.js";

export const CSV_COLUMNS = [
  "individual_id",
  "joint_id",
  "x",
  "y",
  "z",
  "x_inferior",
  "y_inferior",
  "z_inferior",
  "label",
];

export const APPLICATION_ID = "application";
export const APPLICATION_LABEL = "3d_skeleton_plotter";
export const DEFAULT_GRAVE_DIMENSIONS = [1, 1, 1];

// How the recorded z is read (see sceneSpace.js). Written only for RL
// projects, with the convention in `label` and the grave-floor RL in `z`,
// since it is a z value itself. A file without it is a height project, which
// is every file saved before the setting existed.
export const VERTICAL_ROW_ID = "vertical_reference";

const META_JOINT_IDS = new Set(["colour", "group", "group_label", "grave"]);
const KNOWN_JOINTS = new Set(JOINTS.map(({ id }) => id));

function parseCsvRecords(csvText) {
  const records = [];
  let record = [];
  let value = "";
  let quoted = false;
  const text = csvText.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(value.trim());
      value = "";
    } else if ((character === "\r" || character === "\n") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(value.trim());
      if (record.some((cell) => cell !== "")) records.push(record);
      record = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value !== "" || record.length > 0) {
    record.push(value.trim());
    if (record.some((cell) => cell !== "")) records.push(record);
  }

  return records;
}

export function parseCsv(csvText) {
  const records = parseCsvRecords(csvText);

  if (records.length === 0) return { columns: [], rows: [] };

  const columns = records[0];
  const rows = records.slice(1).map((values) => {
    return Object.fromEntries(
      columns.map((column, index) => [column, values[index] ?? ""]),
    );
  });

  return { columns, rows };
}

function makeBlankCoords() {
  return Object.fromEntries(
    JOINTS.map(({ id }) => [id, { x: "", y: "", z: "" }]),
  );
}

function ensureIndividual(grouped, sourceId) {
  if (!grouped.has(sourceId)) {
    grouped.set(sourceId, {
      coords: makeBlankCoords(),
      label: "",
      colour: null,
      groupId: null,
      seenJoints: new Set(),
    });
  }
  return grouped.get(sourceId);
}

function parseCoordinateTriple(row, keys, rowNumber) {
  const values = keys.map((key) => String(row[key] ?? "").trim());
  if (values.some((value) => value !== "" && !Number.isFinite(Number(value)))) {
    return { ok: false, error: `Row ${rowNumber} has invalid coordinates` };
  }
  return { ok: true, values };
}

function normaliseGraveDimensions(raw) {
  if (!Array.isArray(raw) || raw.length !== 3) {
    return [...DEFAULT_GRAVE_DIMENSIONS];
  }

  return raw.map((value, index) => {
    const size = Number(value);
    return Number.isFinite(size) && size > 0
      ? size
      : DEFAULT_GRAVE_DIMENSIONS[index];
  });
}

function parseVerticalReference(row, rowNumber) {
  const convention = row.label.trim().toLowerCase();
  if (!VERTICAL_CONVENTIONS.includes(convention)) {
    return {
      ok: false,
      error: `Row ${rowNumber} has an unknown vertical reference: ${row.label.trim() || "(blank)"}`,
    };
  }

  if (convention === "height") {
    return { ok: true, vertical: { ...DEFAULT_VERTICAL } };
  }

  const floorRL = Number(row.z.trim());
  if (row.z.trim() === "" || !Number.isFinite(floorRL)) {
    return {
      ok: false,
      error: `Row ${rowNumber} needs the grave floor RL in the z column`,
    };
  }

  return { ok: true, vertical: { convention, floorRL } };
}

function buildProjectFromRows(columns, rows) {
  const missingColumns = CSV_COLUMNS.filter(
    (required) => !columns.includes(required),
  );

  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: `Missing CSV columns: ${missingColumns.join(", ")}`,
    };
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: "CSV file is missing the application identity row",
    };
  }

  const first = rows[0];
  if (
    first.individual_id.trim() !== APPLICATION_ID ||
    first.label.trim() !== APPLICATION_LABEL
  ) {
    return {
      ok: false,
      error:
        'CSV file must start with individual_id "application" and label "3d_skeleton_plotter"',
    };
  }

  const grouped = new Map();
  const groupNames = new Map();
  let graveDimensions = [...DEFAULT_GRAVE_DIMENSIONS];
  let imageOverlay = null;
  const graveOutline = {
    top: [],
    bottom: [],
  };
  const graveRecords = new Map();
  const graveDefinitions = new Set();
  let view = null;
  let vertical = { ...DEFAULT_VERTICAL };
  function contourFor(id) {
    if (!id) return graveOutline;
    if (!graveRecords.has(id))
      graveRecords.set(id, { id, top: [], bottom: [] });
    return graveRecords.get(id);
  }

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const sourceId = row.individual_id.trim();
    const jointId = row.joint_id.trim();

    if (!sourceId) {
      return { ok: false, error: `Row ${rowNumber} has no individual_id` };
    }

    if (sourceId === APPLICATION_ID) {
      return {
        ok: false,
        error: `Row ${rowNumber} repeats the application identity row`,
      };
    }

    if (sourceId === "image_overlay") {
      if (imageOverlay)
        return {
          ok: false,
          error: `Row ${rowNumber} repeats the image overlay`,
        };
      try {
        imageOverlay = validateImageOverlay(JSON.parse(row.label));
      } catch (error) {
        return { ok: false, error: `Row ${rowNumber}: ${error.message}` };
      }
      continue;
    }

    if (sourceId === "grave_dimensions") {
      const parsed = parseCoordinateTriple(row, ["x", "y", "z"], rowNumber);
      if (!parsed.ok) return parsed;
      graveDimensions = normaliseGraveDimensions(parsed.values);
      continue;
    }

    if (sourceId === VERTICAL_ROW_ID) {
      const parsed = parseVerticalReference(row, rowNumber);
      if (!parsed.ok) return parsed;
      vertical = parsed.vertical;
      continue;
    }

    if (sourceId === "project_view") {
      try {
        if (view) throw new Error("Duplicate saved camera view");
        view = validateProjectView(JSON.parse(row.label));
      } catch (error) {
        return { ok: false, error: `Row ${rowNumber}: ${error.message}` };
      }
      continue;
    }

    if (sourceId === "grave") {
      try {
        if (!jointId || graveDefinitions.has(jointId))
          throw new Error("Invalid or duplicate grave ID");
        const info = JSON.parse(row.label);
        if (
          !info ||
          typeof info.name !== "string" ||
          !info.name.trim() ||
          (info.colour && !/^#[\da-f]{6}$/i.test(info.colour)) ||
          (info.cutsInto != null && typeof info.cutsInto !== "string") ||
          (info.notes != null && typeof info.notes !== "string")
        )
          throw new Error("Invalid grave details");
        Object.assign(contourFor(jointId), {
          name: info.name,
          colour: info.colour || "#495057",
          cutsInto: info.cutsInto || null,
          notes: info.notes || "",
        });
        graveDefinitions.add(jointId);
      } catch (error) {
        return { ok: false, error: `Row ${rowNumber}: ${error.message}` };
      }
      continue;
    }

    if (sourceId === "grave_outline_reference") {
      let info;
      try {
        info = JSON.parse(row.label);
      } catch {
        return {
          ok: false,
          error: `Row ${rowNumber} has invalid contour reference JSON`,
        };
      }
      if (
        info?.graveId != null &&
        (typeof info.graveId !== "string" || !info.graveId.trim())
      )
        return { ok: false, error: `Row ${rowNumber} has invalid grave ID` };
      const contour = contourFor(info?.graveId || "");
      if (
        !["top", "bottom"].includes(jointId) ||
        contour.references?.[jointId]
      ) {
        return {
          ok: false,
          error: `Row ${rowNumber} has an invalid or duplicate contour reference`,
        };
      }
      try {
        const reference = validateContourReference(info);
        contour.references ??= {};
        contour.references[jointId] = reference;
      } catch (error) {
        return { ok: false, error: `Row ${rowNumber}: ${error.message}` };
      }
      continue;
    }

    if (sourceId === "grave_outline") {
      if (jointId !== "top" && jointId !== "bottom") {
        return {
          ok: false,
          error: `Row ${rowNumber} has invalid grave outline level: ${jointId}`,
        };
      }

      const parsed = parseCoordinateTriple(row, ["x", "y", "z"], rowNumber);
      if (!parsed.ok) return parsed;
      if (parsed.values.some((value) => value === "")) {
        return {
          ok: false,
          error: `Row ${rowNumber} needs complete grave outline coordinates`,
        };
      }

      contourFor(row.label.trim())[jointId].push({
        x: parsed.values[0],
        y: parsed.values[1],
        z: parsed.values[2],
      });
      continue;
    }

    if (META_JOINT_IDS.has(jointId)) {
      const individual = ensureIndividual(grouped, sourceId);
      const value = row.label.trim();

      if (jointId === "colour") {
        if (value) individual.colour = value;
        continue;
      }
      if (jointId === "grave") {
        if (individual.graveId !== undefined)
          return {
            ok: false,
            error: `Row ${rowNumber} repeats grave membership`,
          };
        individual.graveId = value || null;
        continue;
      }

      if (jointId === "group") {
        individual.groupId = value || null;
        if (value && !groupNames.has(value)) groupNames.set(value, "");
        continue;
      }

      // group_label
      if (individual.groupId) {
        groupNames.set(individual.groupId, value);
      }
      continue;
    }

    if (!KNOWN_JOINTS.has(jointId)) {
      return {
        ok: false,
        error: `Row ${rowNumber} has unknown joint_id: ${jointId}`,
      };
    }

    const superior = parseCoordinateTriple(row, ["x", "y", "z"], rowNumber);
    if (!superior.ok) return superior;

    const inferior = parseCoordinateTriple(
      row,
      ["x_inferior", "y_inferior", "z_inferior"],
      rowNumber,
    );
    if (!inferior.ok) return inferior;

    const individual = ensureIndividual(grouped, sourceId);
    const label = row.label.trim();

    if (label && individual.label && label !== individual.label) {
      return {
        ok: false,
        error: `Row ${rowNumber} gives ${sourceId} a different label`,
      };
    }
    if (label) individual.label = label;

    const { coords, seenJoints } = individual;
    if (seenJoints.has(jointId)) {
      return {
        ok: false,
        error: `Row ${rowNumber} repeats ${jointId} for ${sourceId}`,
      };
    }
    seenJoints.add(jointId);

    coords[jointId] = {
      x: superior.values[0],
      y: superior.values[1],
      z: superior.values[2],
    };

    if (inferior.values.some((value) => value !== "")) {
      coords[jointId].split = true;
      coords[jointId].inferior = {
        x: inferior.values[0],
        y: inferior.values[1],
        z: inferior.values[2],
      };
    }
  }

  try {
    for (const id of graveRecords.keys())
      if (!graveDefinitions.has(id)) throw new Error(`Unknown grave ID: ${id}`);
    if (
      graveRecords.size &&
      (graveOutline.top.length ||
        graveOutline.bottom.length ||
        graveOutline.references)
    )
      throw new Error(
        "Named graves cannot mix with unassigned legacy contour rows",
      );
    for (const grave of [graveOutline, ...graveRecords.values()]) {
      for (const level of ["top", "bottom"]) {
        grave[level] = validateContour(grave[level], `${level} outline`);
        if (grave.references?.[level] && !grave[level].length)
          throw new Error(`${level} reference has no contour`);
      }
      if (
        grave.cutsInto &&
        (!graveDefinitions.has(grave.cutsInto) || grave.cutsInto === grave.id)
      )
        throw new Error(`Invalid cuts-into relation for ${grave.name}`);
      const visited = new Set([grave.id]);
      let next = grave.cutsInto;
      while (next) {
        if (visited.has(next))
          throw new Error("Grave cutting relationships contain a cycle");
        visited.add(next);
        next = graveRecords.get(next)?.cutsInto;
      }
    }
    for (const individual of grouped.values())
      if (individual.graveId && !graveDefinitions.has(individual.graveId))
        throw new Error(
          `Individual refers to unknown grave: ${individual.graveId}`,
        );
  } catch (error) {
    return { ok: false, error: error.message };
  }

  for (const imported of grouped.values()) {
    if (imported.groupId && !groupNames.has(imported.groupId)) {
      groupNames.set(imported.groupId, "");
    }
  }

  const groups = [...groupNames].map(([id, name]) => ({ id, name }));
  const groupIds = new Set(groups.map((group) => group.id));

  const individuals = [...grouped].map(([sourceId, imported], index) => ({
    id: sourceId,
    label: imported.label || `Skeleton ${index + 1}`,
    colour: imported.colour,
    groupId:
      imported.groupId && groupIds.has(imported.groupId)
        ? imported.groupId
        : null,
    coords: imported.coords,
    ...(imported.graveId ? { graveId: imported.graveId } : {}),
  }));

  const graves = graveRecords.size
    ? [...graveRecords.values()]
    : graveOutline.top.length || graveOutline.bottom.length
      ? [
          {
            id: "grave-1",
            name: "Grave 1",
            colour: "#495057",
            cutsInto: null,
            notes: "",
            ...graveOutline,
          },
        ]
      : [];
  const firstOutline = graveRecords.size
    ? {
        top: graves[0].top,
        bottom: graves[0].bottom,
        ...(graves[0].references ? { references: graves[0].references } : {}),
      }
    : graveOutline;
  return {
    ok: true,
    graveDimensions,
    imageOverlay,
    graveOutline: firstOutline,
    graves,
    view,
    vertical,
    groups,
    individuals,
  };
}

/** Open a project file: full replace payload including grave dimensions. */
export function csvToProject(csvText) {
  const { columns, rows } = parseCsv(csvText);
  const project = buildProjectFromRows(columns, rows);
  if (!project.ok) return project;

  return {
    ...project,
    individuals: project.individuals.map((individual) => ({
      ...individual,
      colour: individual.colour || "#E69F00",
    })),
  };
}

function freshId(prefix, usedIds, sourceIds, counter) {
  let id;
  do {
    id = `${prefix}${counter.current}`;
    counter.current += 1;
  } while (usedIds.has(id) || sourceIds.has(id));
  return id;
}

/**
 * Additive Import: same CSV shape, remaps colliding individual/group IDs.
 * Does not apply grave dimensions from the file.
 */
export function rowsToIndividuals(
  columns,
  rows,
  existingIds = [],
  colourPalette = ["#E69F00"],
  existingGroupIds = [],
) {
  const project = buildProjectFromRows(columns, rows);
  if (!project.ok) return project;

  const usedIds = new Set(existingIds);
  const sourceIds = new Set(project.individuals.map(({ id }) => id));
  const nextIndividual = { current: 1 };

  const usedGroupIds = new Set(existingGroupIds);
  const sourceGroupIds = new Set(project.groups.map(({ id }) => id));
  const nextGroup = { current: 1 };
  const groupIdMap = new Map();

  for (const group of project.groups) {
    if (usedGroupIds.has(group.id)) {
      const remapped = freshId("grp-", usedGroupIds, sourceGroupIds, nextGroup);
      groupIdMap.set(group.id, remapped);
      usedGroupIds.add(remapped);
    } else {
      groupIdMap.set(group.id, group.id);
      usedGroupIds.add(group.id);
    }
  }

  const groups = project.groups.map((group) => ({
    id: groupIdMap.get(group.id),
    name: group.name,
  }));

  const individuals = project.individuals.map((imported, index) => {
    const id = usedIds.has(imported.id)
      ? freshId("ind-", usedIds, sourceIds, nextIndividual)
      : imported.id;
    usedIds.add(id);

    return {
      id,
      label: imported.label,
      colour:
        imported.colour ??
        colourPalette[(existingIds.length + index) % colourPalette.length] ??
        "#E69F00",
      groupId: imported.groupId
        ? (groupIdMap.get(imported.groupId) ?? null)
        : null,
      hidePelvis: Boolean(imported.hidePelvis),
      hideRibcage: Boolean(imported.hideRibcage),
      hideScapulae: Boolean(imported.hideScapulae),
      coords: imported.coords,
    };
  });

  // Returned so the caller can warn when it differs from the open project's.
  return { ok: true, individuals, groups, vertical: project.vertical };
}

export async function importCsv() {
  const result = await window.electronAPI.importCsv();
  if (!result.ok) return result;

  return {
    ...result,
    ...parseCsv(result.text),
  };
}

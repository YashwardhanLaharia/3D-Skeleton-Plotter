import { JOINTS } from "./joints.js";

export const CSV_COLUMNS = [
  "individual_id",
  "joint_id",
  "x",
  "y",
  "z",
  "label",
];

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

export function rowsToIndividuals(
  columns,
  rows,
  existingIds = [],
  colourPalette = ["#E69F00"],
) {
  const missingColumns = CSV_COLUMNS.filter(
    (required) => !columns.includes(required),
  );

  if (missingColumns.length > 0) {
    return {
      ok: false,
      error: `Missing CSV columns: ${missingColumns.join(", ")}`,
    };
  }

  const knownJoints = new Set(JOINTS.map(({ id }) => id));
  const grouped = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const sourceId = row.individual_id.trim();
    const jointId = row.joint_id.trim();

    if (!sourceId) {
      return { ok: false, error: `Row ${rowNumber} has no individual_id` };
    }
    if (!knownJoints.has(jointId)) {
      return { ok: false, error: `Row ${rowNumber} has unknown joint_id: ${jointId}` };
    }
    const coordinateValues = [row.x, row.y, row.z].map((value) => value.trim());
    if (
      coordinateValues.some(
        (value) => value !== "" && !Number.isFinite(Number(value)),
      )
    ) {
      return { ok: false, error: `Row ${rowNumber} has invalid coordinates` };
    }

    if (!grouped.has(sourceId)) {
      grouped.set(sourceId, {
        coords: makeBlankCoords(),
        label: "",
        seenJoints: new Set(),
      });
    }
    const individual = grouped.get(sourceId);
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
      x: coordinateValues[0],
      y: coordinateValues[1],
      z: coordinateValues[2],
    };
  }

  const usedIds = new Set(existingIds);
  const sourceIds = new Set(grouped.keys());
  let nextNumber = 1;

  function freshId() {
    let id;
    do {
      id = `ind-${nextNumber}`;
      nextNumber += 1;
    } while (usedIds.has(id) || sourceIds.has(id));
    return id;
  }

  const individuals = [...grouped].map(([sourceId, imported], index) => {
    const id = usedIds.has(sourceId) ? freshId() : sourceId;
    usedIds.add(id);
    return {
      id,
      label: imported.label || `Skeleton ${index + 1}`,
      colour:
        colourPalette[(existingIds.length + index) % colourPalette.length] ??
        "#E69F00",
      coords: imported.coords,
    };
  });

  return { ok: true, individuals };
}

export async function importCsv() {
  const result = await window.electronAPI.importCsv();
  if (!result.ok) return result;

  return {
    ...result,
    ...parseCsv(result.text),
  };
}

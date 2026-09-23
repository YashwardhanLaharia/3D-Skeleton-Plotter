import { JOINTS } from "./joints.js";
import { CSV_COLUMNS } from "./csvimport.js";

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(individuals) {
  const lines = [CSV_COLUMNS.join(",")];

  individuals.forEach((individual, individualIndex) => {
    const label = individual.label?.trim() || `Skeleton ${individualIndex + 1}`;

    JOINTS.forEach((joint, index) => {
      const coordinates = individual.coords?.[joint.id] ?? {};
      const row = [
        individual.id,
        joint.id,
        coordinates.x,
        coordinates.y,
        coordinates.z,
        index === 0 ? label : "",
      ];
      lines.push(row.map(escapeCsvCell).join(","));
    });
  });

  return `${lines.join("\r\n")}\r\n`;
}

export async function exportCsv(individuals) {
  return window.electronAPI.exportCsv(createCsv(individuals));
}

import { JOINTS } from "./joints.js";
import {
  APPLICATION_ID,
  APPLICATION_LABEL,
  CSV_COLUMNS,
  VERTICAL_ROW_ID,
} from "./csvImport.js";
import { DEFAULT_VERTICAL } from "./sceneSpace.js";

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(
  individuals,
  projectGraveDimensions,
  groups = [],
  vertical = DEFAULT_VERTICAL,
) {
  const lines = [CSV_COLUMNS.join(",")];

  lines.push(
    [APPLICATION_ID, "", "", "", "", "", "", "", APPLICATION_LABEL]
      .map(escapeCsvCell)
      .join(","),
  );

  lines.push(
    [
      "grave_dimensions",
      "",
      projectGraveDimensions[0],
      projectGraveDimensions[1],
      projectGraveDimensions[2],
      "",
      "",
      "",
      "",
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  // Height projects are written exactly as before the setting existed.
  if (vertical?.convention === "rl") {
    lines.push(
      [VERTICAL_ROW_ID, "", "", "", vertical.floorRL, "", "", "", "rl"]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  individuals.forEach((individual, individualIndex) => {
    const label = individual.label?.trim() || `Skeleton ${individualIndex + 1}`;

    lines.push(
      [individual.id, "colour", "", "", "", "", "", "", individual.colour ?? ""]
        .map(escapeCsvCell)
        .join(","),
    );

    lines.push(
      [
        individual.id,
        "group",
        "",
        "",
        "",
        "",
        "",
        "",
        individual.groupId ?? "",
      ]
        .map(escapeCsvCell)
        .join(","),
    );

    const groupName =
      groups.find((group) => group.id === individual.groupId)?.name ?? "";
    lines.push(
      [individual.id, "group_label", "", "", "", "", "", "", groupName]
        .map(escapeCsvCell)
        .join(","),
    );

    JOINTS.forEach((joint, index) => {
      const coordinates = individual.coords?.[joint.id] ?? {};
      const inferiorCoordinates = coordinates.inferior ?? {};
      const row = [
        individual.id,
        joint.id,
        coordinates.x ?? "",
        coordinates.y ?? "",
        coordinates.z ?? "",
        inferiorCoordinates.x ?? "",
        inferiorCoordinates.y ?? "",
        inferiorCoordinates.z ?? "",
        index === 0 ? label : "",
      ];
      lines.push(row.map(escapeCsvCell).join(","));
    });
  });

  return `${lines.join("\r\n")}\r\n`;
}

export async function exportCsv(
  individuals,
  projectGraveDimensions,
  groups,
  hidden,
  vertical = DEFAULT_VERTICAL,
) {
  console.log(hidden);
  const visibleIndividuals = individuals.filter((individual) => !hidden.includes(individual.id));

  return window.electronAPI.exportCsv(
    createCsv(visibleIndividuals, projectGraveDimensions, groups, vertical),
  );
}

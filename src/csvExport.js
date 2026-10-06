import { JOINTS } from "./joints.js";
import {
  APPLICATION_ID,
  APPLICATION_LABEL,
  CSV_COLUMNS,
} from "./csvImport.js";

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsv(
  individuals,
  projectGraveDimensions,
  groups = [],
  graveOutline = { top: [], bottom: [] },
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

  ["top", "bottom"].forEach((level) => {
    const points = graveOutline?.[level] ?? [];

    points.forEach((point) => {
      lines.push(
        [
          "grave_outline",
          level,
          point.x ?? "",
          point.y ?? "",
          point.z ?? "",
          "",
          "",
          "",
          "",
        ]
          .map(escapeCsvCell)
          .join(","),
      );
    });
  });

  individuals.forEach((individual, individualIndex) => {
    const label =
      individual.label?.trim() || `Skeleton ${individualIndex + 1}`;

    lines.push(
      [
        individual.id,
        "colour",
        "",
        "",
        "",
        "",
        "",
        "",
        individual.colour ?? "",
      ]
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
      [
        individual.id,
        "group_label",
        "",
        "",
        "",
        "",
        "",
        "",
        groupName,
      ]
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
) {
  console.log(hidden);

  const visibleIndividuals = individuals.filter(
    (individual) => !hidden.includes(individual.id),
  );

  return window.electronAPI.exportCsv(
    createCsv(visibleIndividuals, projectGraveDimensions, groups),
  );
}

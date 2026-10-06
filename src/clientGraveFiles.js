import { inflateRawSync } from "node:zlib";
import { validateContour } from "./graveContourData.js";

const MAX_XML = 8 * 1024 * 1024;

// Read only the XML members needed for the client's XLSX layout. No archive
// contents are extracted to disk and decompression has a fixed output limit.
function xlsxMembers(buffer) {
  let end = -1;
  for (
    let index = buffer.length - 22;
    index >= Math.max(0, buffer.length - 65557);
    index--
  ) {
    if (
      buffer.readUInt32LE(index) === 0x06054b50 &&
      index + 22 + buffer.readUInt16LE(index + 20) === buffer.length
    ) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("This file is not a supported XLSX workbook");
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6))
    throw new Error("Multipart workbooks are unsupported");
  let cursor = buffer.readUInt32LE(end + 16);
  const count = buffer.readUInt16LE(end + 10);
  if (count === 65535 || count > 1000)
    throw new Error("Workbook has too many archive members");
  const members = new Map();
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new Error("Invalid XLSX archive directory");
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const packed = buffer.readUInt32LE(cursor + 20);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const next =
      cursor +
      46 +
      nameLength +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32);
    if (next > end) throw new Error("Invalid XLSX archive member");
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    const offset = buffer.readUInt32LE(cursor + 42);
    cursor = next;
    if (
      name !== "xl/sharedStrings.xml" &&
      !/^xl\/worksheets\/sheet\d+\.xml$/.test(name)
    )
      continue;
    total += size;
    if (
      flags & 1 ||
      size > MAX_XML ||
      total > MAX_XML ||
      offset + 30 > buffer.length ||
      buffer.readUInt32LE(offset) !== 0x04034b50
    )
      throw new Error("Encrypted, oversized or invalid workbook");
    const start =
      offset +
      30 +
      buffer.readUInt16LE(offset + 26) +
      buffer.readUInt16LE(offset + 28);
    if (start + packed > buffer.length) throw new Error("Truncated workbook");
    const compressed = buffer.subarray(start, start + packed);
    const data =
      method === 0
        ? compressed
        : method === 8
          ? inflateRawSync(compressed, { maxOutputLength: MAX_XML })
          : null;
    if (!data || data.length !== size)
      throw new Error("Unsupported workbook compression");
    if (members.has(name)) throw new Error("Duplicate workbook archive member");
    members.set(name, data.toString("utf8"));
  }
  return members;
}

function xmlText(text) {
  return text.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, entity) => {
      if (entity[0] === "#")
        return String.fromCodePoint(
          parseInt(
            entity.slice(entity[1].toLowerCase() === "x" ? 2 : 1),
            entity[1].toLowerCase() === "x" ? 16 : 10,
          ),
        );
      return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[
        entity.toLowerCase()
      ];
    },
  );
}

function texts(xml) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => xmlText(match[1]))
    .join("");
}

function sheetCells(xml, strings) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("Unsupported workbook XML");
  const cells = new Map();
  for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const address = match[1].match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!address) continue;
    const type = match[1].match(/\bt="([^"]+)"/)?.[1];
    const body = match[2] ?? "";
    const value = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1] ?? "";
    cells.set(address, {
      value:
        type === "s"
          ? (strings[Number(value)] ?? "")
          : type === "inlineStr"
            ? texts(body)
            : xmlText(value),
      formula: /<f[\s/>]/.test(body),
    });
  }
  return cells;
}

export function parseClientXlsx(buffer) {
  const members = xlsxMembers(buffer);
  const stringsXml = members.get("xl/sharedStrings.xml") ?? "";
  if (/<!DOCTYPE|<!ENTITY/i.test(stringsXml))
    throw new Error("Unsupported workbook XML");
  const strings = [
    ...stringsXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g),
  ].map((match) => texts(match[1]));
  const matches = [];
  for (const [name, xml] of members) {
    if (!name.startsWith("xl/worksheets/")) continue;
    const cells = sheetCells(xml, strings);
    const value = (address) => cells.get(address)?.value ?? "";
    if (value("E1").trim().toLowerCase() !== "fossa grave top outline")
      continue;
    if (["E2", "F2", "G2"].map(value).join(",").toUpperCase() !== "X,Z,Y")
      throw new Error("Expected X, Z, Y headers for the grave outline");
    const rows = [
      ...new Set(
        [...cells.keys()]
          .filter((key) => /^[EFG]\d+$/.test(key))
          .map((key) => Number(key.match(/\d+$/)[0])),
      ),
    ]
      .filter((row) => row >= 3)
      .sort((a, b) => a - b);
    const points = [];
    for (const row of rows) {
      const addresses = ["E", "F", "G"].map((column) => `${column}${row}`);
      const values = addresses.map(value);
      if (values.every((cell) => cell === "")) continue;
      if (addresses.some((address) => cells.get(address)?.formula))
        throw new Error(
          `Outline row ${row} contains a formula; supply measured numeric values`,
        );
      points.push({ x: values[0], y: values[2], z: values[1] });
    }
    matches.push(validateContour(points, "LN24 top outline"));
  }
  if (matches.length !== 1 || matches[0].length === 0)
    throw new Error(
      "Expected one Fossa Grave top outline block in columns E:G with X, Z, Y headers",
    );
  return {
    points: matches[0],
    level: "top",
    description: "LN24 top outline; surface levels excluded",
  };
}

export function parseClientRot(text) {
  const sections = [];
  let points = null;
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      if (/^#LN19 BP135 Grave Cut XZY$/i.test(line)) {
        points = [];
        sections.push(points);
      } else if (points) points = null;
      continue;
    }
    if (!points || !line) continue;
    const fields = line.split(/\s+/);
    if (fields.length !== 4 || !["0", "6"].includes(fields[3]))
      throw new Error(`Unsupported grave-cut drawing row ${index + 1}`);
    if (
      (!points.length && fields[3] !== "0") ||
      (points.length && fields[3] !== "6")
    )
      throw new Error("Grave cut must be one ordered drawing loop");
    points.push({ x: fields[0], y: fields[2], z: fields[1] });
  }
  if (sections.length !== 1)
    throw new Error("Expected one LN19 BP135 Grave Cut XZY section");
  const contour = validateContour(sections[0], "LN19 grave cut");
  if (!contour.length) throw new Error("The grave-cut section is empty");
  return {
    points: contour,
    level: null,
    description: "LN19 BP135 grave cut; top/base classification required",
  };
}

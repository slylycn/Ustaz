import "server-only";
import mammoth from "mammoth";
import { DOCX_MIME, SUBMISSION_LIMITS, type SubmissionMime } from "@/lib/constants";

/**
 * Identifies the real file type from its first bytes, so a renamed file can't pretend to be
 * something else. DOCX files are ZIP archives ("PK"), and the declared type must agree.
 */
export function sniffMime(bytes: Uint8Array, declared: string): SubmissionMime | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46)) return declared === "application/pdf" ? "application/pdf" : null; // %PDF
  if (starts(0x89, 0x50, 0x4e, 0x47)) return declared === "image/png" ? "image/png" : null;
  if (starts(0xff, 0xd8, 0xff)) return declared === "image/jpeg" ? "image/jpeg" : null;
  if (starts(0x50, 0x4b, 0x03, 0x04)) return declared === DOCX_MIME ? DOCX_MIME : null; // PK.. (zip)
  return null;
}

/** Plain text from a .docx (server-side, with mammoth). Throws on unreadable files. */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, SUBMISSION_LIMITS.text + 1); // one extra char lets the caller detect "too long"
}

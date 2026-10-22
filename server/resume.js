// Resume files land in data/artifacts under their content hash. The original
// filename is metadata only and never becomes a path.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { attachResume } from './profile.js';

export const MAX_RESUME_BYTES = 8 * 1024 * 1024;

const TYPES = new Map([
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
]);

const PDF_MAGIC = Buffer.from('%PDF-');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

export function cleanFilename(raw, fallback = 'resume.pdf') {
  const text = String(raw ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = text.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= 120) return cleaned;
  const ext = path.extname(cleaned).slice(0, 10);
  return cleaned.slice(0, 120 - ext.length) + ext;
}

function startsWith(buffer, magic) {
  return buffer.length >= magic.length && buffer.subarray(0, magic.length).equals(magic);
}

export function inspectResume(buffer, filename) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, error: 'the file is empty' };
  }
  if (buffer.length > MAX_RESUME_BYTES) {
    return { ok: false, error: 'the file is larger than 8 MB' };
  }
  const ext = path.extname(filename).toLowerCase();
  const contentType = TYPES.get(ext);
  if (!contentType) {
    return { ok: false, error: 'only PDF, DOC or DOCX resumes are accepted' };
  }
  if (ext === '.pdf' && !startsWith(buffer, PDF_MAGIC)) {
    return { ok: false, error: 'this does not look like a PDF file' };
  }
  if (ext === '.docx' && !startsWith(buffer, ZIP_MAGIC)) {
    return { ok: false, error: 'this does not look like a DOCX file' };
  }
  if (ext === '.doc' && !startsWith(buffer, OLE_MAGIC) && !startsWith(buffer, ZIP_MAGIC)) {
    return { ok: false, error: 'this does not look like a DOC file' };
  }
  return { ok: true, ext, contentType };
}

export function storeResume(db, { buffer, filename, artifactsDir, host } = {}) {
  const name = cleanFilename(filename);
  const checked = inspectResume(buffer, name);
  if (!checked.ok) return { status: 'invalid', error: checked.error };

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const dir = path.resolve(artifactsDir);
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${sha256}${checked.ext}`);
  if (!filePath.startsWith(dir + path.sep)) {
    return { status: 'invalid', error: 'invalid file name' };
  }
  if (!existsSync(filePath)) writeFileSync(filePath, buffer);

  const storedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO artifacts (sha256, kind, filename, bytes, content_type, stored_at, path)
     VALUES (?, 'resume', ?, ?, ?, ?, ?)
     ON CONFLICT (sha256) DO NOTHING`,
  ).run(sha256, name, buffer.length, checked.contentType, storedAt, filePath);

  const resume = {
    sha256,
    filename: name,
    bytes: buffer.length,
    contentType: checked.contentType,
    storedAt,
  };
  const result = attachResume(db, resume, { host });
  return { ...result, resume, artifactPath: filePath };
}

export function resumeFile(db, sha256) {
  if (!/^[a-f0-9]{64}$/.test(sha256)) return null;
  return db.prepare('SELECT * FROM artifacts WHERE sha256 = ?').get(sha256) ?? null;
}

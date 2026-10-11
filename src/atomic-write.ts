import fs from 'node:fs';
import path from 'node:path';

// Write through a sibling `<file>.tmp` and rename it into place, so an interrupted process leaves
// either the previous content or the complete new content, never a truncated file. The fixed
// sibling name is part of the contract: callers that guard managed destinations validate it.
function writeFileAtomic(file: string, data: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  try {
    fs.writeFileSync(temporary, data, 'utf8');
    fs.renameSync(temporary, file);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

export { writeFileAtomic };

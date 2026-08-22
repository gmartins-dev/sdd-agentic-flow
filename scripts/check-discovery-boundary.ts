import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const failures: string[] = [];

if (!/discovery-only[\s\S]*not a spec package/i.test(read('shared/references/spec-lifecycle.md')))
  failures.push('spec lifecycle must define discovery-only workspaces as non-packages');

const brainstorm = read('skills/saf-brainstorm/SKILL.md');
if (!/resum|durable mode/i.test(brainstorm) || !/never normative requirements/i.test(brainstorm))
  failures.push('saf-brainstorm must define durable resume and non-normative discovery');

for (const skill of ['saf-create-prompts', 'saf-implement', 'saf-check-task', 'saf-validate']) {
  const content = read(`skills/${skill}/SKILL.md`);
  if (!/discovery-only|discovery\.md/i.test(content) || !/spec package/i.test(content))
    failures.push(`${skill} must reject discovery-only workspaces as spec packages`);
}

if (
  !/discovery-state:[\s\S]*not a spec package/i.test(
    read('shared/references/artifact-contracts.md'),
  )
)
  failures.push('artifact contracts must classify discovery-state as non-normative');

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('PASS discovery boundary');

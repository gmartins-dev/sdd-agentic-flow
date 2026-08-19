import fs from 'node:fs';
import path from 'node:path';

type Finding = { file: string; message: string };

const required: Record<string, string[]> = {
  'docs/engineering-model.md': [
    'Agentic Workflow Harness',
    'Spec-Driven Agentic Workflow Harness',
    'Spec-Driven Coding-Agent Workflow Harness',
    'repository-native engineering control plane',
  ],
  'README.md': ['Spec-Driven Agentic Workflow Harness'],
  'README.pt-BR.md': ['Spec-Driven Agentic Workflow Harness'],
  'package.json': ['Spec-Driven Agentic Workflow Harness'],
};

const forbidden = [
  'Mental model (4 layers + SDD)',
  'Modelo mental (4 camadas + SDD)',
  'Prompt → Context → Harness → Loop + SDD',
  'Skills are the execution layer',
  'As skills são a camada de execução',
];

function read(root: string, file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function checkProductPositioning(root = process.cwd()): Finding[] {
  const findings: Finding[] = [];
  for (const [file, phrases] of Object.entries(required)) {
    let content: string;
    try {
      content = read(root, file);
    } catch {
      findings.push({ file, message: 'missing active surface' });
      continue;
    }
    for (const phrase of phrases) {
      if (!content.includes(phrase))
        findings.push({ file, message: `missing required phrase: ${phrase}` });
    }
  }
  const activeDocs = [
    'README.md',
    'README.pt-BR.md',
    'docs/engineering-model.md',
    'docs/sdd-agentic-flow-model.md',
    'docs/why-this-exists.md',
  ];
  for (const file of activeDocs) {
    let content = '';
    try {
      content = read(root, file);
    } catch {
      continue;
    }
    for (const phrase of forbidden) {
      if (content.includes(phrase)) findings.push({ file, message: `retired phrase: ${phrase}` });
    }
  }
  return findings;
}

export { checkProductPositioning, type Finding };

if (process.argv[1]?.endsWith('check-product-positioning.ts')) {
  const findings = checkProductPositioning();
  for (const finding of findings) process.stderr.write(`${finding.file}: ${finding.message}\n`);
  process.exitCode = findings.length ? 1 : 0;
}

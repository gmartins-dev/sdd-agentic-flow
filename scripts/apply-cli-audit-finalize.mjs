import fs from 'node:fs';

function patchFile(file, patches) {
  let source = fs.readFileSync(file, 'utf8');
  for (const [label, from, to] of patches) {
    if (from instanceof RegExp) {
      if (!from.test(source)) throw new Error(`${file}: target not found: ${label}`);
      source = source.replace(from, to);
    } else {
      if (!source.includes(from)) throw new Error(`${file}: target not found: ${label}`);
      source = source.replace(from, to);
    }
  }
  fs.writeFileSync(file, source, 'utf8');
}

patchFile('src/install.ts', [
  [
    'persist user adoption with final intent',
    `  if (scope === 'user') {\n    config.user.targets = targets;\n    if (leavingTeamProject && git.ok) delete config.projects[git.context.adoptionKey];\n  } else {`,
    `  if (scope === 'user') {\n    config.user.targets = targets;\n    if (adoptionMode && git.ok) {\n      config.projects[git.context.adoptionKey] = {\n        git_common_dir: git.context.gitCommonDir,\n        project_relative_path: git.context.projectRelativePath,\n        adoption_mode: adoptionMode,\n      };\n    }\n  } else {`,
  ],
]);

patchFile('src/setup.ts', [
  [
    'localized current setup',
    /function printCurrentSetup\([\s\S]*?\n}\n\nasync function applySetup/,
    `function printCurrentSetup(cwd: string, locale: string, homeDir = os.homedir()) {\n  const config = readConfig(sddJoin(cwd, 'config.yml'));\n  const saved = savedSetupProfile(cwd, homeDir);\n  const state = inspectSetupState(cwd, homeDir);\n  const profile = saved?.profile;\n  const adoption =\n    profile && typeof profile === 'object' && 'adoption_mode' in profile\n      ? String(profile.adoption_mode)\n      : null;\n  const targets =\n    profile && typeof profile === 'object' && 'targets' in profile && Array.isArray(profile.targets)\n      ? profile.targets\n      : [];\n  const targetLabels = (targets as string[]).map((target) =>\n    target === 'agents'\n      ? t(locale, 'install.targetShared')\n      : target === 'cursor'\n        ? 'Cursor'\n        : target === 'claude'\n          ? t(locale, 'install.targetClaude')\n          : target === 'copilot'\n            ? t(locale, 'install.targetCopilot')\n            : target,\n  );\n  const mode = resolveMode();\n  const statusLabel =\n    state.state === 'Ready'\n      ? t(locale, 'setup.ready')\n      : state.state === 'Attention'\n        ? t(locale, 'setup.attention')\n        : state.state === 'Incomplete'\n          ? t(locale, 'setup.partial')\n          : state.state === 'Fresh'\n            ? t(locale, 'setup.missing')\n            : t(locale, 'setup.attention');\n  const rows: Array<[string, string]> = [\n    ['Status', statusLabel],\n  ];\n  if (adoption)\n    rows.push([\n      locale === 'pt-BR' ? 'Compartilhamento' : 'Sharing',\n      adoption === 'personal'\n        ? t(locale, 'install.adoptionPersonal')\n        : adoption === 'team'\n          ? t(locale, 'install.adoptionTeam')\n          : t(locale, 'install.adoptionSpecsShared'),\n    ]);\n  if (targetLabels.length)\n    rows.push([locale === 'pt-BR' ? 'Agentes' : 'Coding agents', targetLabels.join(', ')]);\n  if (config.ok) {\n    rows.push([t(locale, 'menu.workflow'), policyReviewTitle(policyFromConfig(config, locale), locale)]);\n    rows.push([\n      t(locale, 'menu.language'),\n      config.languageProfile === 'pt-BR' ? 'Português (Brasil)' : 'English',\n    ]);\n  }\n  process.stdout.write(\`\\n\${t(locale, 'setup.current')}\\n\\n\`);\n  for (const [key, value] of rows)\n    process.stdout.write(\`  \${renderKeyValue(key, value, mode).join('\\n  ')}\\n\`);\n}\n\nasync function applySetup`,
  ],
  [
    'localized settings workflow options',
    `        const workflow = await choose(t(locale, 'menu.workflow'), [\n          { value: 'supervised', label: 'Supervised' },\n          { value: 'manual', label: 'Manual' },\n          { value: 'autonomous', label: 'Autonomous' },`,
    `        const workflow = await choose(t(locale, 'menu.workflow'), [\n          {\n            value: 'supervised',\n            label: t(locale, 'setup.policySupervised').replace(/\\s+[—-]\\s+.*$/, ''),\n          },\n          { value: 'manual', label: t(locale, 'setup.policyManual') },\n          { value: 'autonomous', label: t(locale, 'setup.policyAutonomous') },`,
  ],
]);

patchFile('.github/workflows/ci.yml', [
  [
    'add CLI certification job',
    `  check-platforms:\n    strategy:\n      matrix:\n        os: [macos-latest, windows-latest]\n    runs-on: \${{ matrix.os }}\n    steps:\n      - uses: actions/checkout@v7\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 22\n      - run: npm ci\n      - run: npm run check\n      - run: npm run pack:dry\n`,
    `  check-platforms:\n    strategy:\n      matrix:\n        os: [macos-latest, windows-latest]\n    runs-on: \${{ matrix.os }}\n    steps:\n      - uses: actions/checkout@v7\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 22\n      - run: npm ci\n      - run: npm run check\n      - run: npm run pack:dry\n\n  cli-certification:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 24\n      - run: npm ci\n      - run: npm run cli:human-audit\n      - run: npm run cli:exhaustive\n      - run: npm run cli:certify\n      - run: npm run cli:certify:packed\n`,
  ],
]);

patchFile('docs/cli-interaction.md', [
  [
    'ready menu ordering',
    `state-aware welcome; ready and attention states offer **Exit**, **Change settings**,\n**Check for updates**, **Validate setup**, and **Advanced options**. Nested flows expose`,
    `state-aware welcome; ready and attention states offer **Change settings**,\n**Check for updates**, **Validate setup**, **Advanced options**, and **Exit** in that order.\nExit is always the final menu action. Nested flows expose`,
  ],
  [
    'guided setup contract',
    `Guided setup is an inline CLI flow, not a full-screen TUI. It has one recommended path and an\noptional customization path, including an operating-policy step (Supervised recommended), then a\nsingle review before the first write. It derives first-use, partial, and ready state from\nconfiguration, installation intent, context, and \`doctor\`; it does not store a separate onboarding\nmarker. Before apply, **Back** only changes in-memory choices. After apply, **Workflow** runs\n\`config policy\`; **Sharing and coding agents** runs \`config installation\` — each is a deliberate\nchange, not a rollback. A handled failure keeps the human in the flow with retry, validation,\nchange, or exit.\n\nThe first-use journey records four decisions: sharing mode, explicitly selected coding-agent\nhosts, workflow mode (including a custom execution/autonomy pair), and language profile. Feature`,
    `Guided setup is an inline screen-oriented CLI flow, not a full-screen TUI. Fresh bare TTY\nstartup resolves the session language first, then collects sharing mode, coding-agent hosts, and\nworkflow. The final review is the only mutation boundary and exposes **Install and configure**,\n**Back**, and **Cancel**. No installation intent or adoption state is persisted before that Apply.\nThe reviewed Apply reconciles skills and adoption first, persists final installation intent,\ninitializes workspace/context, and validates the observed result. A blocked installation plan never\nshows an Apply action. Pending or partial durable state is classified as incomplete/blocked rather\nthan Fresh, and **Change choices** always re-opens all setup decisions using saved values only as\ndefaults.\n\nEscape navigates back on nested non-mutating screens and cancels a pending mutation review;\nCtrl-C exits the human shell cleanly with code 0. After Apply begins, failures report observed state\ntruthfully and never claim that no durable change occurred without evidence. After setup,\n**Workflow** runs \`config policy\`; **Sharing and coding agents** runs \`config installation\`.\n\nThe first-use journey resolves language for the session, then records three setup decisions:\nsharing mode, explicitly selected coding-agent hosts, and workflow mode (including a custom\nexecution/autonomy pair). Feature`,
  ],
]);

patchFile('scripts/check-cli-human-input.ts', [
  [
    'detect hardcoded canonical setup prompts',
    `const allowlistedFiles = new Set(['selector.ts']);`,
    `const allowlistedFiles = new Set(['selector.ts']);\nconst canonicalSetupLiteral = /(?:await choose|select)\\(\\s*['\"](?:Sharing|Workflow|Coding agents|Language)['\"]/;`,
  ],
  [
    'record hardcoded prompt finding',
    `      if (\n        directQuestion.test(line) &&\n        !allowlistedFiles.has(path.basename(file)) &&\n        !content.includes('human-input-allowlist: free-form')\n      )\n        findings.push(\`\${relative}:\${index + 1}: unclassified direct input\`);`,
    `      if (\n        directQuestion.test(line) &&\n        !allowlistedFiles.has(path.basename(file)) &&\n        !content.includes('human-input-allowlist: free-form')\n      )\n        findings.push(\`\${relative}:\${index + 1}: unclassified direct input\`);\n      if (canonicalSetupLiteral.test(line))\n        findings.push(\`\${relative}:\${index + 1}: hardcoded canonical setup prompt\`);`,
  ],
]);

console.log('PASS final CLI audit corrections applied');

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AUTONOMY_LEVELS, configValue, EXECUTION_MODES } from './config-domain';
import { parseContractArray, validateContractReferences } from './contract-graph';
import { unknownContractKinds } from './contract-kinds';
import { buildDoctorView, type DoctorCheck, formatEvidenceGraph } from './doctor-view';
import { collectEvidenceGraph, type EvidenceGraphResult } from './evidence-graph';
import { renderEvidenceGraphHtml } from './evidence-graph-html';
import { harnessReadinessChecks } from './harness-readiness';
import type { PlanForInstallProfileInput } from './install';
import { readInstallConfig, repositoryKey, USER_TARGETS } from './install-domain';
import { type InstallPlan, isPlanEmpty } from './install-preflight';
import { resolveLocale, t, translateText } from './messages';
import {
  autonomyComboValid,
  detectShellInfo,
  filesystemWritable,
  gitAvailable,
  KNOWN_AGENTS,
  LANGUAGE_PROFILES,
  LEGACY_SDD_ROOT,
  legacySddJoin,
  OPTIONAL_CONTRACT_FIELDS,
  PACKAGE_ROOT,
  PACKS_DIR,
  PRIVATE_PATTERNS,
  REQUIRED_CONTRACT_FIELDS,
  SDD_PATHS,
  SDD_ROOT,
  sddJoin,
  userSkillsDirsFor,
  VERSION,
} from './paths';
import { gitInfo, parseProvenance, readLoopState } from './project-context';
import { isLegacySkillName, isOfficialSkill, OFFICIAL_SKILLS } from './skill-identity';
import { styleStatus } from './ui';
import { checkForUpdate } from './update-check';
import { readInstallProvenance } from './upgrade';
import { satisfiesRange } from './version-compat';

type InternalDoctorCheck = DoctorCheck & { section?: string };

type DoctorCommandOptions = {
  verbose?: boolean | undefined;
  json?: boolean | undefined;
  ascii?: boolean | undefined;
  smoke?: boolean | undefined;
  contracts?: boolean | undefined;
  autonomy?: boolean | undefined;
  checkUpdates?: boolean | undefined;
  evidenceGraph?: string | undefined;
  evidenceGraphHtml?: boolean | undefined;
  output?: string | undefined;
  harness?: boolean | undefined;
  locale?: string | undefined;
};

type SmokeCheckDeps = {
  init: (cwd: string, options: { profile?: string; quiet?: boolean }) => boolean | undefined;
  install: (
    pack: string,
    cwd: string,
    options: { scope?: string; quiet?: boolean; homeDir?: string },
  ) => unknown;
};

let resolveInstallProfilePlan: ((input: PlanForInstallProfileInput) => InstallPlan) | null = null;
let smokeCheckDeps: SmokeCheckDeps | null = null;

function setDoctorInstallPlanResolver(
  resolver: (input: PlanForInstallProfileInput) => InstallPlan,
): void {
  resolveInstallProfilePlan = resolver;
}

function setDoctorSmokeDeps(deps: SmokeCheckDeps): void {
  smokeCheckDeps = deps;
}

function defaultConfigYaml(): string {
  return `schema: saf-config/v2

project:
  name: example-project
  default_branch: main

agent:
  target: generic

language:
  profile: en-US
  human_outputs: en-US
  technical_tokens: canonical
  bilingual_mode: technical-canonical

specs:
  root: .specs/features
  files:
    - context.md
    - spec.md
    - design.md
    - tasks.md

source:
  type: local-files
  snapshots_dir: .sdd-agentic-flow/snapshots

workflow:
  default_flow: single
  feature_profile: medium_feature
  allow_multi_worktree: false
  allow_stacked_prs: false
  commit_policy: manual
  execution_mode: guided
  autonomy_level: manual

  autonomy_budget:
    max_iterations: 50
    max_tokens: 500000
    max_runtime_hours: 4
    pause_on_warning: true

quality:
  tlc_baseline_required: true
  require_tdd: true
  require_independent_check: true
  require_evidence_before_completion: true

safety:
  no_commit_by_default: true
  no_push_by_default: true
  no_merge_or_deploy: true
`;
}

function resolveConfiguredAgent(cwd: string): string | null {
  const configPath = sddJoin(cwd, 'config.yml');
  if (!fs.existsSync(configPath)) return null;
  const target = configValue(fs.readFileSync(configPath, 'utf8'), 'target');
  return target && KNOWN_AGENTS.includes(target) ? target : null;
}

function hasOfficialSkillsAt(root: string): boolean {
  return OFFICIAL_SKILLS.some((skill: string) => fs.existsSync(path.join(root, skill, 'SKILL.md')));
}

function resolveSkillsRoot(cwd: string): string {
  const projectRoot = path.join(cwd, '.agents', 'skills');
  if (hasOfficialSkillsAt(projectRoot)) return projectRoot;
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd)) ?? [])
    if (hasOfficialSkillsAt(dir)) return dir;
  return projectRoot;
}

function languageProfilePath(cwd: string, profile: string, isPackage: boolean): string {
  return isPackage
    ? path.join(PACKAGE_ROOT, 'shared', 'language-profiles', `${profile}.md`)
    : path.join(
        resolveSkillsRoot(cwd),
        'sdd-agentic-flow-shared',
        'language-profiles',
        `${profile}.md`,
      );
}

function languageReport(cwd: string) {
  const configPath = sddJoin(cwd, 'config.yml');
  const isPackage = (() => {
    try {
      return (
        JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name ===
        'sdd-agentic-flow'
      );
    } catch {
      return false;
    }
  })();
  const content = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : isPackage
      ? defaultConfigYaml()
      : null;
  if (!content) {
    return {
      status: 'WARN',
      profile: null,
      human_outputs: null,
      technical_tokens: null,
      bilingual_mode: null,
      message: 'language profile is not configured',
    };
  }
  const profile = configValue(content, 'profile');
  const humanOutputs = configValue(content, 'human_outputs');
  const technicalTokens = configValue(content, 'technical_tokens');
  const bilingualMode = configValue(content, 'bilingual_mode');
  if (!profile) {
    return {
      status: 'WARN',
      profile: null,
      human_outputs: humanOutputs,
      technical_tokens: technicalTokens,
      bilingual_mode: bilingualMode,
      message: 'language.profile is missing; using legacy language settings',
    };
  }
  const valid =
    LANGUAGE_PROFILES.includes(profile) &&
    humanOutputs === profile &&
    technicalTokens === 'canonical' &&
    bilingualMode === 'technical-canonical';
  const profileFile = languageProfilePath(cwd, profile, isPackage);
  const installed = fs.existsSync(profileFile);
  const status = valid && installed ? 'PASS' : valid ? 'WARN' : 'FAIL';
  return {
    status,
    profile,
    human_outputs: humanOutputs,
    technical_tokens: technicalTokens,
    bilingual_mode: bilingualMode,
    message: !valid
      ? 'language profile values are invalid'
      : installed
        ? 'language profile is valid'
        : 'language profile is configured but not installed',
  };
}

function installationStatus(target: string): boolean {
  if (!fs.existsSync(target)) return false;
  return (
    OFFICIAL_SKILLS.some((name: string) => fs.existsSync(path.join(target, name, 'SKILL.md'))) ||
    fs.existsSync(path.join(target, 'sdd-agentic-flow-shared', 'references', 'tlc-baseline.md'))
  );
}

function officialSkillsPresence(root: string) {
  const present: string[] = OFFICIAL_SKILLS.filter((skill: string) =>
    fs.existsSync(path.join(root, skill, 'SKILL.md')),
  );
  return {
    present,
    missing: present.length ? [] : [...OFFICIAL_SKILLS],
  };
}

function filesIn(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(target) : [target];
  });
}

function hasPrivateContext(paths: string[]): boolean {
  return paths.flatMap(filesIn).some((file: string) => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      return PRIVATE_PATTERNS.some((pattern: string) => content.includes(pattern));
    } catch {
      return false;
    }
  });
}

function severity(checks: DoctorCheck[]): 'PASS' | 'WARN' | 'FAIL' {
  if (checks.some((check: DoctorCheck) => check.status === 'FAIL')) return 'FAIL';
  if (checks.some((check: DoctorCheck) => check.status === 'WARN')) return 'WARN';
  return 'PASS';
}

function doctorChecks(cwd: string, options: { harness?: boolean } = {}): InternalDoctorCheck[] {
  const checks: InternalDoctorCheck[] = [];
  const add = (name: string, status: DoctorCheck['status'], message: string, section?: string) =>
    checks.push({ name, status, message, ...(section ? { section } : {}) });
  const isPackage =
    fs.existsSync(path.join(cwd, 'package.json')) &&
    (() => {
      try {
        return (
          JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name ===
          'sdd-agentic-flow'
        );
      } catch {
        return false;
      }
    })();
  (() => {
    const roots = [path.join(cwd, '.agents', 'skills')];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const provenance = readInstallProvenance(root);
      const legacy =
        Boolean(
          provenance?.package === 'sdd-agentic-flow' &&
            provenance.schema !== 'saf-install-provenance/v2',
        ) ||
        fs
          .readdirSync(root)
          .some((name: string) => name !== 'sdd-agentic-flow-shared' && isLegacySkillName(name));
      if (legacy) {
        add(
          'legacy_installation',
          'WARN',
          'legacy installation detected (< 3.0); remove it manually, then reinstall',
          'Installation',
        );
      }
    }
  })();
  const configPath = sddJoin(cwd, 'config.yml');
  const safetyConfig = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : defaultConfigYaml();
  const specsRoot = configValue(safetyConfig, 'root');
  const language = languageReport(cwd);
  const skillsRoot = isPackage ? '' : resolveSkillsRoot(cwd);
  const tddBaseline = isPackage
    ? path.join(cwd, 'shared', 'references', 'tdd-baseline.md')
    : path.join(skillsRoot, 'sdd-agentic-flow-shared', 'references', 'tdd-baseline.md');

  if (isPackage) {
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const packageOk =
      (fs.existsSync(path.join(cwd, 'dist/sdd-agentic-flow.js')) ||
        fs.existsSync(path.join(cwd, 'src/sdd-agentic-flow.ts'))) &&
      Object.keys(manifest.dependencies || {}).length === 0;
    add(
      'package_integrity',
      packageOk ? 'PASS' : 'FAIL',
      packageOk
        ? 'CLI present and no runtime dependencies'
        : 'CLI missing or runtime dependencies found',
      'Package integrity',
    );
    add(
      'private_context',
      !hasPrivateContext([
        path.join(cwd, 'dist'),
        path.join(cwd, 'src'),
        path.join(cwd, 'skills'),
        path.join(cwd, 'shared'),
        path.join(cwd, 'packs'),
        path.join(cwd, 'examples'),
        path.join(cwd, 'docs'),
      ])
        ? 'PASS'
        : 'FAIL',
      'publishable content has no blocked private context',
      'Safety',
    );
    add(
      'licensing',
      fs.existsSync(path.join(cwd, 'NOTICE')) && fs.existsSync(path.join(cwd, 'LICENSING.md'))
        ? 'PASS'
        : 'FAIL',
      'NOTICE and licensing map present',
      'Licensing',
    );
    add('packs', fs.existsSync(PACKS_DIR) ? 'PASS' : 'FAIL', 'installable packs present', 'Packs');
    add(
      'agent_compatibility',
      fs.existsSync(path.join(cwd, 'docs', 'agent-compatibility.md')) ? 'PASS' : 'FAIL',
      'agent compatibility documentation present',
      'Agent compatibility',
    );
    add(
      'postinstall',
      !Object.hasOwn(manifest.scripts || {}, 'postinstall') ? 'PASS' : 'FAIL',
      'no postinstall script',
      'Safety',
    );
  } else {
    add(
      'config',
      fs.existsSync(configPath) ? 'PASS' : 'WARN',
      fs.existsSync(configPath) ? `${SDD_PATHS.config} found` : `${SDD_PATHS.config} not found`,
      'Config',
    );
    (() => {
      const legacyPath = legacySddJoin(cwd);
      const newRootPath = path.join(cwd, SDD_ROOT);
      if (fs.existsSync(legacyPath) && !fs.existsSync(newRootPath)) {
        add(
          'legacy_sdd_root',
          'WARN',
          `${LEGACY_SDD_ROOT}/ found without ${SDD_ROOT}/ — rename ${LEGACY_SDD_ROOT}/ to ${SDD_ROOT}/ yourself`,
          'Config',
        );
      } else if (fs.existsSync(legacyPath) && fs.existsSync(newRootPath)) {
        add(
          'legacy_sdd_root',
          'WARN',
          `both ${LEGACY_SDD_ROOT}/ and ${SDD_ROOT}/ exist — remove or merge ${LEGACY_SDD_ROOT}/ manually`,
          'Config',
        );
      }
    })();
    (() => {
      const installConfig = readInstallConfig(os.homedir());
      const key = repositoryKey(cwd);
      const profile = installConfig?.projects[key] || installConfig?.user;
      const scope = installConfig?.projects[key] ? 'project' : 'user';
      if (!profile?.packs?.length || !resolveInstallProfilePlan) return;
      const plan = resolveInstallProfilePlan({ cwd, homeDir: os.homedir(), scope, profile });
      const status = plan.blocked || !isPlanEmpty(plan) ? 'WARN' : 'PASS';
      add(
        'installation_intent',
        status,
        isPlanEmpty(plan)
          ? `installation intent is synchronized (${profile.packs.join(', ')})`
          : `installation intent has pending reconciliation (${profile.packs.join(', ')})`,
        'Installation',
      );
    })();
    (() => {
      const presence = officialSkillsPresence(skillsRoot);
      const skillsMessage =
        presence.missing.length === 0
          ? `installed skills present (${presence.present.length})`
          : 'no official skills installed';
      add('skills', presence.missing.length === 0 ? 'PASS' : 'WARN', skillsMessage, 'Skills');
    })();
    add(
      'shared_layer',
      fs.existsSync(
        path.join(skillsRoot, 'sdd-agentic-flow-shared', 'references', 'tlc-baseline.md'),
      )
        ? 'PASS'
        : 'WARN',
      fs.existsSync(path.join(skillsRoot, 'sdd-agentic-flow-shared'))
        ? 'shared layer installed'
        : 'shared layer not installed',
      'Shared layer',
    );
    add(
      'project_readiness',
      fs.existsSync(configPath) && hasOfficialSkillsAt(skillsRoot) ? 'PASS' : 'WARN',
      'project readiness is based on config and selected official skills',
      'Project readiness',
    );
    {
      const contextArtifactPath = sddJoin(cwd, 'context', 'project-context.md');
      const contextArtifactExists = fs.existsSync(contextArtifactPath);
      let contextMessage = contextArtifactExists
        ? `${SDD_PATHS.projectContext} found`
        : `${SDD_PATHS.projectContext} not found; run \`context refresh\``;
      if (contextArtifactExists) {
        const provenance = parseProvenance(fs.readFileSync(contextArtifactPath, 'utf8'));
        const current = gitInfo(cwd);
        if (provenance?.revision && current.revision && provenance.revision !== current.revision) {
          contextMessage +=
            ' (repository has changed since generation; consider `sdd-agentic-flow context refresh`)';
        }
      }
      add(
        'project_context',
        contextArtifactExists ? 'PASS' : 'WARN',
        contextMessage,
        'Project context',
      );
    }
  }
  if (options.harness) {
    add(
      'project_instructions',
      'INFO',
      ['AGENTS.md', 'CLAUDE.md', '.cursor/rules'].some((candidate) =>
        fs.existsSync(path.join(cwd, candidate)),
      )
        ? 'project instruction files detected'
        : 'no project instruction files detected (not required)',
      'Project instructions',
    );
    add(
      'specs_root',
      specsRoot && !fs.existsSync(path.resolve(cwd, specsRoot)) ? 'WARN' : 'PASS',
      specsRoot && !fs.existsSync(path.resolve(cwd, specsRoot))
        ? `configured specs root is missing: ${specsRoot}`
        : `configured specs root is valid: ${specsRoot ?? '.specs/features'}`,
      'Project readiness',
    );
    add(
      'ci_present',
      'INFO',
      fs.existsSync(path.join(cwd, '.github', 'workflows'))
        ? 'CI workflow directory detected'
        : 'no CI workflow directory detected (not required)',
      'Project readiness',
    );
  }
  add(
    'tdd-baseline',
    fs.existsSync(tddBaseline) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(tddBaseline)
      ? 'shared/references/tdd-baseline.md found'
      : 'shared/references/tdd-baseline.md not found',
    'TDD baseline',
  );
  const sharedRef = (name: string) =>
    isPackage
      ? path.join(cwd, 'shared', 'references', name)
      : path.join(skillsRoot, 'sdd-agentic-flow-shared', 'references', name);
  const tlcBaseline = sharedRef('tlc-baseline.md');
  add(
    'baseline-tlc',
    fs.existsSync(tlcBaseline) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(tlcBaseline)
      ? 'TLC baseline preserved'
      : 'shared/references/tlc-baseline.md not found',
    'Baseline compliance',
  );
  const featureProfilesRef = sharedRef('feature-profiles.md');
  const declaresFeatureProfile = /feature_profile:\s*\S+/.test(safetyConfig);
  add(
    'adaptive-sizing',
    fs.existsSync(featureProfilesRef)
      ? declaresFeatureProfile
        ? 'PASS'
        : 'WARN'
      : isPackage
        ? 'FAIL'
        : 'WARN',
    fs.existsSync(featureProfilesRef)
      ? declaresFeatureProfile
        ? 'adaptive sizing guidance present and configured'
        : 'adaptive sizing guidance present; workflow.feature_profile not set in config'
      : 'shared/references/feature-profiles.md not found',
    'Baseline compliance',
  );
  const taskSlicingRef = sharedRef('task-slicing.md');
  add(
    'traceability',
    fs.existsSync(taskSlicingRef) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(taskSlicingRef)
      ? 'traceability guidance present'
      : 'shared/references/task-slicing.md not found',
    'Baseline compliance',
  );
  const artifactContractsRef = sharedRef('artifact-contracts.md');
  add(
    'artifact-contracts',
    fs.existsSync(artifactContractsRef) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(artifactContractsRef)
      ? 'artifact contracts guidance present'
      : 'shared/references/artifact-contracts.md not found',
    'Baseline compliance',
  );
  const requiresEvidence = /require_evidence_before_completion:\s*true/.test(safetyConfig);
  add(
    'evidence-first',
    requiresEvidence ? 'PASS' : 'WARN',
    requiresEvidence
      ? 'evidence-first policy required'
      : 'quality.require_evidence_before_completion is not set to true',
    'Baseline compliance',
  );
  add(
    'language_profile',
    language.status as DoctorCheck['status'],
    language.message ?? '',
    'Language',
  );
  const safe =
    /no_commit_by_default:\s*true/.test(safetyConfig) &&
    /no_push_by_default:\s*true/.test(safetyConfig) &&
    /no_merge_or_deploy:\s*true/.test(safetyConfig);
  add(
    'safety',
    safe ? 'PASS' : 'FAIL',
    safe ? 'offline, no-commit safety is the default' : 'required safety defaults are missing',
    'Safety',
  );
  {
    add('platform_os', 'PASS', `OS: ${process.platform}, Node ${process.version}`, 'Platform');
    const writable = filesystemWritable();
    add(
      'platform_filesystem',
      writable ? 'PASS' : 'FAIL',
      writable ? 'Filesystem writable' : 'Filesystem not writable',
      'Platform',
    );
    add('platform_shell', 'INFO', `Shell: ${detectShellInfo()}`, 'Platform');
    const git = gitAvailable();
    add(
      'platform_git',
      git ? 'PASS' : 'INFO',
      git ? 'Git: available' : 'Git: not available',
      'Platform',
    );
  }
  {
    const projectTarget = path.join(cwd, '.agents', 'skills');
    const projectInstalled = installationStatus(projectTarget);
    add(
      'installation_project',
      projectInstalled ? 'PASS' : 'INFO',
      projectInstalled
        ? `project-scope installation found at ${path.relative(cwd, projectTarget) || '.'}`
        : 'no project-scope installation found (opt in with `install <pack> --scope project`)',
      'Installation',
    );
    for (const [targetId, segments] of Object.entries(USER_TARGETS)) {
      const target = path.join(os.homedir(), ...segments);
      const installed = installationStatus(target);
      add(
        `installation_user_${targetId}`,
        installed ? 'PASS' : 'INFO',
        installed
          ? `user-scope installation found at ${target}`
          : `no user-scope installation found at ${target}`,
        'Installation',
      );
    }
    if (!projectInstalled)
      add(
        'installation_no_project_footprint',
        'PASS',
        'No project files created by installation',
        'Installation',
      );
    if (!isPackage && skillsRoot) {
      const provenance = readInstallProvenance(skillsRoot);
      if (provenance?.packageVersion) {
        const stale = provenance.packageVersion !== VERSION;
        add(
          'installation_provenance',
          stale ? 'WARN' : 'PASS',
          stale
            ? `skills provenance ${provenance.packageVersion} (running CLI ${VERSION}) — run \`sdd-agentic-flow upgrade --skills-only\` after upgrading the CLI`
            : `skills provenance ${provenance.packageVersion} matches running CLI`,
          'Installation',
        );
      }
    }
  }
  return checks;
}

function frontmatterOf(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match?.[1] ?? null;
}

function installedSkillDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'sdd-agentic-flow-shared')
    .map((entry) => entry.name);
}

function parseScalarField(frontmatter: string, field: string): string | null {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(\\S+)\\s*$`, 'm'));
  if (!match?.[1] || match[1] === 'null') return null;
  return match[1].replace(/^['"]|['"]$/g, '');
}

function contractsCheck(cwd: string): InternalDoctorCheck {
  const root = resolveSkillsRoot(cwd);
  const skills = installedSkillDirs(root);
  if (!skills.length) {
    return {
      name: 'capability_contracts',
      status: 'WARN',
      message: 'no installed skills found under .agents/skills to validate',
      section: 'Capability contracts',
    };
  }
  const failures: string[] = [];
  const warnings: string[] = [];
  const parsed: Array<{ name: string; frontmatter: string }> = [];
  for (const skill of skills) {
    const skillPath = path.join(root, skill, 'SKILL.md');
    const content = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : null;
    const frontmatter = content ? frontmatterOf(content) : null;
    if (!frontmatter) {
      failures.push(`${skill}: SKILL.md missing or has no frontmatter`);
      continue;
    }
    for (const field of REQUIRED_CONTRACT_FIELDS)
      if (!new RegExp(`^${field}:`, 'm').test(frontmatter))
        failures.push(`${skill}: missing required field '${field}'`);
    for (const field of OPTIONAL_CONTRACT_FIELDS)
      if (!new RegExp(`^${field}:`, 'm').test(frontmatter))
        warnings.push(`${skill}: optional field '${field}' absent`);
    parsed.push({ name: skill, frontmatter });
  }
  if (parsed.length) {
    const registryPath = path.join(root, 'sdd-agentic-flow-shared', 'baselines', 'registry.yml');
    const knownBaselineIds = fs.existsSync(registryPath)
      ? [...fs.readFileSync(registryPath, 'utf8').matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)]
          .map((match) => match[1])
          .filter((id): id is string => typeof id === 'string')
      : null;
    if (knownBaselineIds === null)
      warnings.push(
        'could not read sdd-agentic-flow-shared/baselines/registry.yml to validate baseline references',
      );

    const { failures: refFailures, cycles } = validateContractReferences(parsed, {
      knownBaselineIds,
    });
    failures.push(...refFailures);
    for (const cycle of cycles) failures.push(`contract cycle detected: ${cycle.join(' -> ')}`);

    const installedSet = new Set(parsed.map((skill) => skill.name));
    for (const { name, frontmatter } of parsed) {
      for (const target of parseContractArray(frontmatter, 'conflicts') || []) {
        if (!(OFFICIAL_SKILLS as readonly string[]).includes(target))
          failures.push(`${name}: conflicts references unknown skill '${target}'`);
        else if (installedSet.has(target))
          failures.push(`${name} and ${target} declare a conflict but are both installed`);
      }
    }

    for (const { name, frontmatter } of parsed) {
      if (!isOfficialSkill(name)) continue;
      for (const { field, value } of unknownContractKinds({
        requires: parseContractArray(frontmatter, 'requires') ?? [],
        consumes: parseContractArray(frontmatter, 'consumes') ?? [],
        produces: parseContractArray(frontmatter, 'produces') ?? [],
      }))
        failures.push(`${name}: unknown ${field} contract kind '${value}'`);
    }

    for (const { name, frontmatter } of parsed) {
      const requiresCli = parseScalarField(frontmatter, 'requires_cli');
      if (requiresCli && !satisfiesRange(VERSION, requiresCli))
        failures.push(`${name}: requires CLI ${requiresCli}, installed CLI is ${VERSION}`);
    }
  }
  if (failures.length)
    return {
      name: 'capability_contracts',
      status: 'FAIL',
      message: `contract corruption: ${failures.join('; ')}`,
      section: 'Capability contracts',
    };
  if (warnings.length)
    return {
      name: 'capability_contracts',
      status: 'WARN',
      message: `optional fields absent: ${warnings.join('; ')}`,
      section: 'Capability contracts',
    };
  return {
    name: 'capability_contracts',
    status: 'PASS',
    message: `capability contracts valid for ${skills.length} installed skill(s)`,
    section: 'Capability contracts',
  };
}

const AUTONOMY_GUARDRAILS = [
  [
    'guardrail_1_completion',
    'Outcome classification — positive results advance and recoverable results route to repair',
  ],
  [
    'guardrail_2_evidence',
    'Evidence validation — every autonomy_profile.evidence_required artifact exists',
  ],
  ['guardrail_3_verification', "Verification gates — the skill's own required checks all pass"],
  [
    'guardrail_4_scope',
    'Scope boundary — semantic scope stays bounded while evidence may expand touchpoints',
  ],
  [
    'guardrail_5_transition',
    'Skill transition validity — next skill is on the authorized workflow path',
  ],
  ['guardrail_6_resources', 'Resource sufficiency — workflow.autonomy_budget is not exhausted'],
  ['guardrail_7_human_gate', 'Human override gate — no pause/stop recorded in loop-state.md'],
] as const;

function skillOverrideLevel(content: string, skill: string): string | null {
  if (!content) return null;
  const match = content.match(new RegExp(`${skill}:\\s*\\n\\s*autonomy_level:\\s*(\\S+)`));
  return match?.[1]?.trim() ?? null;
}

function autonomyLoopStateCoherence(loopState: NonNullable<ReturnType<typeof readLoopState>>): {
  status: DoctorCheck['status'];
  message: string;
} {
  const missing = ['skill', 'status', 'next', 'guardrails'].filter(
    (field) => !loopState[field as keyof typeof loopState],
  );
  if (missing.length)
    return {
      status: 'WARN',
      message: `loop state is incomplete; missing ${missing.join(', ')}`,
    };

  const guardrails = loopState.guardrails?.trim() ?? '';
  if (/^FAIL(?:\s|$)/i.test(guardrails))
    return {
      status: 'FAIL',
      message: `loop state claims Guardrails: FAIL at skill '${loopState.skill}' without pause=true or stop=true`,
    };

  const next = loopState.next?.trim() ?? '';
  if (next !== 'human' && next !== 'none' && !isOfficialSkill(next))
    return {
      status: 'FAIL',
      message: `loop state names unknown next skill '${next}'`,
    };

  return {
    status: 'PASS',
    message: `last recorded skill '${loopState.skill}' → ${loopState.status}; next: ${next}`,
  };
}

function autonomyCheck(cwd: string, options: DoctorCommandOptions = {}): InternalDoctorCheck[] {
  const checks: InternalDoctorCheck[] = [];
  const add = (
    name: string,
    status: DoctorCheck['status'],
    message: string,
    section = 'Autonomy',
  ) => checks.push({ name, status, message, section });

  const configPath = sddJoin(cwd, 'config.yml');
  const configExists = fs.existsSync(configPath);
  const content = configExists ? fs.readFileSync(configPath, 'utf8') : null;
  const executionMode = content ? configValue(content, 'execution_mode') : null;
  const autonomyLevel = content ? configValue(content, 'autonomy_level') : null;

  let explicitlyInvalid = false;
  if (!configExists) {
    add(
      'autonomy_config',
      'WARN',
      `${SDD_PATHS.config} not found; run \`init\` to set workflow.execution_mode/autonomy_level`,
    );
  } else if (!executionMode || !autonomyLevel) {
    add(
      'autonomy_config',
      'WARN',
      `workflow.execution_mode/autonomy_level not set in ${SDD_PATHS.config}; run init to recreate the current v6 configuration`,
    );
  } else if (
    !(EXECUTION_MODES as readonly string[]).includes(executionMode) ||
    !(AUTONOMY_LEVELS as readonly string[]).includes(autonomyLevel)
  ) {
    explicitlyInvalid = true;
    add(
      'autonomy_config',
      'FAIL',
      `workflow.execution_mode/autonomy_level has an invalid value (execution_mode=${executionMode}, autonomy_level=${autonomyLevel})`,
    );
  } else {
    add(
      'autonomy_config',
      'PASS',
      `execution_mode=${executionMode}, autonomy_level=${autonomyLevel}`,
    );
  }

  const effectiveExecutionMode =
    executionMode && (EXECUTION_MODES as readonly string[]).includes(executionMode)
      ? executionMode
      : 'guided';
  const effectiveAutonomyLevel =
    autonomyLevel && (AUTONOMY_LEVELS as readonly string[]).includes(autonomyLevel)
      ? autonomyLevel
      : 'manual';
  if (explicitlyInvalid) {
    add(
      'autonomy_combo',
      'FAIL',
      'not evaluated — workflow.execution_mode/autonomy_level has an invalid value, fix autonomy_config first',
    );
  } else if (!autonomyComboValid(effectiveExecutionMode, effectiveAutonomyLevel)) {
    add(
      'autonomy_combo',
      'FAIL',
      `execution_mode=${effectiveExecutionMode} cannot combine with autonomy_level=${effectiveAutonomyLevel} (see docs/autonomy-levels.md)`,
    );
  } else {
    add('autonomy_combo', 'PASS', 'execution_mode × autonomy_level combination is valid');
  }

  const root = resolveSkillsRoot(cwd);
  const skills = installedSkillDirs(root);
  if (!skills.length) {
    add('autonomy_skills', 'WARN', 'no installed skills found under .agents/skills to validate');
  } else {
    const missingProfile: string[] = [];
    const unsupported: string[] = [];
    for (const skill of skills) {
      const skillPath = path.join(root, skill, 'SKILL.md');
      const skillContent = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : null;
      const frontmatter = skillContent ? frontmatterOf(skillContent) : null;
      if (!frontmatter || !/^autonomy_profile:/m.test(frontmatter)) {
        missingProfile.push(skill);
        continue;
      }
      const supportedLevels = parseContractArray(frontmatter, 'supported_levels') || [];
      const overrideLevel = skillOverrideLevel(content ?? '', skill);
      const levelForSkill =
        overrideLevel && (AUTONOMY_LEVELS as readonly string[]).includes(overrideLevel)
          ? overrideLevel
          : effectiveAutonomyLevel;
      if (levelForSkill !== 'manual' && !supportedLevels.includes(levelForSkill))
        unsupported.push(
          overrideLevel ? `${skill} (workflow.skill_overrides: ${levelForSkill})` : skill,
        );
    }
    if (missingProfile.length) {
      add(
        'autonomy_skills',
        'FAIL',
        `skill(s) missing autonomy_profile: ${missingProfile.join(', ')}`,
      );
    } else if (unsupported.length) {
      add(
        'autonomy_skills',
        'WARN',
        `skill(s) do not support their effective autonomy_level (workflow default: ${effectiveAutonomyLevel}): ${unsupported.join(', ')} — set workflow.skill_overrides or keep them at manual/supervised`,
      );
    } else {
      add(
        'autonomy_skills',
        'PASS',
        `all ${skills.length} installed skill(s) support autonomy_level=${effectiveAutonomyLevel}`,
      );
    }
  }

  if (content) {
    const maxIterations = configValue(content, 'max_iterations');
    if (effectiveAutonomyLevel === 'autonomous' && !maxIterations) {
      add(
        'autonomy_budget',
        'WARN',
        'workflow.autonomy_budget not set; an autonomous run has no resource guardrail (guardrail 6)',
      );
    } else if (maxIterations) {
      add(
        'autonomy_budget',
        'PASS',
        `budget: max_iterations=${maxIterations}, max_tokens=${configValue(content, 'max_tokens')}, max_runtime_hours=${configValue(content, 'max_runtime_hours')}`,
      );
    } else {
      add(
        'autonomy_budget',
        'INFO',
        'workflow.autonomy_budget not set (not required outside autonomous mode)',
      );
    }
  }

  const loopState = readLoopState(cwd);
  if (!loopState) {
    add(
      'autonomy_loop_state',
      'INFO',
      `no ${SDD_PATHS.loopState} yet; an agent creates it the first time it runs a supervised/autonomous workflow`,
    );
  } else if (loopState.stop) {
    add(
      'autonomy_loop_state',
      'WARN',
      `loop state recorded stop=true at skill '${loopState.skill}'; resolve the blocker, then run \`autonomous-resume\``,
    );
  } else if (loopState.pause) {
    add(
      'autonomy_loop_state',
      'WARN',
      `loop state recorded pause=true at skill '${loopState.skill}'; run \`autonomous-resume\` to continue`,
    );
  } else {
    const coherence = autonomyLoopStateCoherence(loopState);
    add('autonomy_loop_state', coherence.status, coherence.message);
  }

  if (options.verbose)
    for (const [name, message] of AUTONOMY_GUARDRAILS)
      add(name, 'INFO', message, 'Autonomy guardrails');

  return checks;
}

function doctorLog(status: string, message: string, locale: string): void {
  process.stdout.write(
    `${styleStatus(status, process.stdout)} ${translateText(locale, message)}\n`,
  );
}

function renderDoctor(checks: DoctorCheck[], options: DoctorCommandOptions = {}): void {
  const locale = options.locale || 'en-US';
  const view = buildDoctorView(checks, {
    verbose: Boolean(options.verbose),
    locale,
  });
  process.stdout.write(
    `\n${view.title}${view.hasProblems ? '' : ` — ${t(locale, 'doctor.passed')}`}\n`,
  );
  process.stdout.write(
    `${t(locale, 'doctor.summary', {
      pass: view.counts.PASS,
      info: view.counts.INFO,
      warn: view.counts.WARN,
      fail: view.counts.FAIL,
    })}\n`,
  );
  if (view.primaryFix)
    process.stdout.write(`\n${t(locale, 'doctor.primaryFix')}\n  ${view.primaryFix}\n`);
  if (view.shown.length) {
    process.stdout.write(
      `\n${view.hasProblems ? t(locale, 'doctor.related') : t(locale, 'doctor.checks')}\n`,
    );
    for (const check of view.shown) doctorLog(check.status, check.message ?? '', locale);
  }
  if (!view.hasProblems)
    process.stdout.write(`\n${t(locale, 'doctor.next')}\n  ${t(locale, 'ready.next')}\n`);
}

function smokeCheck(): InternalDoctorCheck {
  if (!smokeCheckDeps) {
    return {
      name: 'smoke',
      status: 'FAIL',
      message: 'smoke check dependencies are not registered',
      section: 'Project readiness',
    };
  }
  const { init, install } = smokeCheckDeps;
  let temporary: string | undefined;
  try {
    for (const profile of LANGUAGE_PROFILES) {
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-smoke-'));
      const originalHome = process.env.HOME;
      process.env.HOME = temporary;
      try {
        init(temporary, { profile, quiet: true });
        install('full', temporary, { scope: 'project', quiet: true, homeDir: temporary });
        init(temporary, { profile, quiet: true });
        install('full', temporary, { scope: 'project', quiet: true, homeDir: temporary });
        const required = [
          SDD_PATHS.config,
          SDD_PATHS.projectContext,
          '.agents/skills',
          '.agents/skills/sdd-agentic-flow-shared',
          `.agents/skills/sdd-agentic-flow-shared/language-profiles/${profile}.md`,
          '.specs/features',
        ].every((relative) => temporary && fs.existsSync(path.join(temporary, relative)));
        const state = severity(doctorChecks(temporary));
        if (!required || state === 'FAIL' || languageReport(temporary).profile !== profile)
          throw new Error(`expected ${profile} files or project checks are missing`);
      } finally {
        if (originalHome === undefined) delete process.env.HOME;
        else process.env.HOME = originalHome;
      }
      fs.rmSync(temporary, { recursive: true, force: true });
      temporary = undefined;
    }
    return {
      name: 'smoke',
      status: 'PASS',
      message: 'isolated init, install, preservation, and doctor checks passed',
      section: 'Project readiness',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: 'smoke',
      status: 'FAIL',
      message: `smoke failed; preserved for debugging: ${temporary} (${message})`,
      section: 'Project readiness',
    };
  }
}

async function doctor(cwd: string, options: DoctorCommandOptions = {}) {
  if (options.evidenceGraph) {
    return evidenceGraphDoctor(cwd, options.evidenceGraph, {
      json: options.json,
      html: options.evidenceGraphHtml,
      output: options.output,
    });
  }
  const checks: InternalDoctorCheck[] = doctorChecks(cwd, {
    ...(options.harness === undefined ? {} : { harness: options.harness }),
  });
  if (options.smoke) checks.push(smokeCheck());
  if (options.contracts) checks.push(contractsCheck(cwd));
  if (options.autonomy) checks.push(...autonomyCheck(cwd, { verbose: options.verbose }));
  if (options.checkUpdates) checks.push(await checkForUpdate({ currentVersion: VERSION }));
  const projectedChecks: InternalDoctorCheck[] = options.harness
    ? harnessReadinessChecks(checks)
    : checks;
  const result = {
    status: severity(projectedChecks),
    version: VERSION,
    checks: projectedChecks.map(({ section: _section, ...check }) => check),
    language: languageReport(cwd),
  };
  if (options.json)
    process.stdout.write(
      `${JSON.stringify({ schema_version: 1, cli_version: VERSION, command: 'doctor', ok: true, data: result })}\n`,
    );
  else
    renderDoctor(projectedChecks, {
      verbose: options.verbose,
      locale: resolveLocale({ configured: languageReport(cwd).profile ?? undefined }),
    });
  if (result.status === 'FAIL') process.exitCode = 1;
  return result;
}

function evidenceGraphExitCode(result: EvidenceGraphResult): number {
  if (result.errors.some((error) => error.startsWith('feature not found'))) return 2;
  if (!result.v4Compatible) return 1;
  if (result.requirements.some((node) => node.status !== 'current')) return 1;
  return 0;
}

function evidenceGraphDoctor(
  cwd: string,
  featureSlug: string,
  options: {
    json?: boolean | undefined;
    html?: boolean | undefined;
    output?: string | undefined;
  } = {},
) {
  const result = collectEvidenceGraph(cwd, featureSlug);
  const exitCode = evidenceGraphExitCode(result);
  if (options.html && (result.requirements.length || !result.errors.length)) {
    const html = renderEvidenceGraphHtml(result);
    if (options.output) {
      const output = path.resolve(cwd, options.output);
      fs.writeFileSync(output, html);
      process.stdout.write(`${output}\n`);
    } else process.stdout.write(html);
  } else if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ schema_version: 1, cli_version: VERSION, command: 'doctor --evidence-graph', ok: exitCode === 0, data: { ...result, exitCode } })}\n`,
    );
  } else {
    process.stdout.write(`${formatEvidenceGraph(result)}\n`);
  }
  if (exitCode) process.exitCode = exitCode;
  return result;
}

export type { InternalDoctorCheck };
export {
  doctor,
  doctorChecks,
  hasOfficialSkillsAt,
  installationStatus,
  languageReport,
  officialSkillsPresence,
  resolveConfiguredAgent,
  resolveSkillsRoot,
  setDoctorInstallPlanResolver,
  setDoctorSmokeDeps,
  severity,
};

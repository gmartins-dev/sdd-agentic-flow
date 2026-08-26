type Scalar = string | null;
type ContractValue = Scalar | string[] | Record<string, Scalar | string[]>;
type SkillContract = Record<string, ContractValue>;

const ROOT_KEYS = new Set([
  'schema',
  'extends',
  'requires',
  'consumes',
  'produces',
  'baseline',
  'depends_on',
  'conflicts',
  'requires_cli',
  'autonomy_profile',
]);
const AUTONOMY_KEYS = new Set([
  'supported_levels',
  'auto_continue_condition',
  'blocking_conditions',
  'evidence_required',
]);

function parseScalar(raw: string): Scalar | string[] {
  const value = raw.trim();
  if (value === 'null') return null;
  if (value.startsWith('[') && value.endsWith(']')) {
    const body = value.slice(1, -1).trim();
    return body ? body.split(',').map((item) => item.trim()) : [];
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[A-Za-z0-9_.+/-]+$/.test(value)) return value;
  throw new Error(`unsupported scalar: ${value}`);
}

function parseSkillContract(content: string): SkillContract {
  if (/\t|^---\s*$|^\.\.\.\s*$|(^|\s)[&*!][A-Za-z0-9_-]+|^\s*<<:|^\s*\?/m.test(content)) {
    throw new Error('unsupported YAML construct');
  }
  const result: SkillContract = {};
  let nested: Record<string, Scalar | string[]> | null = null;
  for (const [index, raw] of content.split(/\r?\n/).entries()) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const match = raw.match(/^( {2})?([a-z_]+):(?:\s*(.*))?$/);
    if (!match) throw new Error(`invalid line ${index + 1}`);
    const [, indent, key = '', value = ''] = match;
    if (indent) {
      if (!nested || !AUTONOMY_KEYS.has(key)) throw new Error(`invalid nested key: ${key}`);
      if (Object.hasOwn(nested, key)) throw new Error(`duplicate key: ${key}`);
      nested[key] = parseScalar(value);
      continue;
    }
    nested = null;
    if (!ROOT_KEYS.has(key)) throw new Error(`unknown key: ${key}`);
    if (Object.hasOwn(result, key)) throw new Error(`duplicate key: ${key}`);
    if (key === 'autonomy_profile') {
      if (value) throw new Error('autonomy_profile must be a map');
      nested = {};
      result[key] = nested;
    } else {
      if (!value) throw new Error(`missing value: ${key}`);
      result[key] = parseScalar(value);
    }
  }
  if (result.schema !== 'saf-skill-contract/v1') throw new Error('unsupported contract schema');
  return result;
}

export type { SkillContract };
export { parseSkillContract };

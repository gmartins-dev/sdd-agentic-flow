import fs from 'node:fs';

const file = 'src/setup.ts';
let source = fs.readFileSync(file, 'utf8');
const helper = /\nfunction printSetupStages\([\s\S]*?\n}\n\nfunction resolvePolicyFromCommandOptions/;
if (!helper.test(source)) throw new Error('printSetupStages helper not found');
source = source.replace(helper, '\nfunction resolvePolicyFromCommandOptions');
fs.writeFileSync(file, source, 'utf8');
console.log('PASS removed obsolete setup-stage renderer');

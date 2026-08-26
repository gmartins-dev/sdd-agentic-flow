# Effective defaults

When `.sdd-agentic-flow/config.yml` is absent, SAF skills use this policy
projection. Invalid, unreadable, unsupported, or future configuration does not
fall back to these values.

```yaml effective-defaults
execution_mode: apply
autonomy_level: supervised
feature_profile: medium_feature
specs_root: .specs/features
source_type: local-files
language_profile: en-US
tlc_baseline_required: true
require_tdd: true
require_independent_check: true
require_evidence_before_completion: true
no_commit_by_default: true
no_push_by_default: true
no_merge_or_deploy: true
```

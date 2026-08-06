# Publishing

Run locally before publication:

```bash
npm whoami
npm pack --dry-run
npm publish --dry-run --access public
npm publish --access public
```

Automated provenance and release automation are future work.

Review the dry-run file list before publishing. The package never runs these commands
itself and does not create a Git remote, tag, or release.

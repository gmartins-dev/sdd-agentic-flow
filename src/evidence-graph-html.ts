import type { EvidenceGraphResult } from './evidence-graph';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function renderEvidenceGraphHtml(result: EvidenceGraphResult): string {
  const errors = [...result.errors]
    .sort()
    .map((error) => `<li>${escapeHtml(error)}</li>`)
    .join('');
  const requirements = [...result.requirements]
    .sort((left, right) => left.reqId.localeCompare(right.reqId))
    .map(
      (node) =>
        `<tr><th>${escapeHtml(node.reqId)}</th><td>${escapeHtml(node.status)}</td><td>${escapeHtml(node.taskIds.join(', ') || '—')}</td><td>${escapeHtml(node.checkReports.join(', ') || '—')}</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Evidence graph — ${escapeHtml(result.featureSlug)}</title>
<style>body{font:16px system-ui,sans-serif;margin:2rem;line-height:1.5}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:.5rem;text-align:left;vertical-align:top}th{background:#f3f3f3}.errors{color:#8b0000}</style>
</head>
<body>
<main>
<h1>Evidence graph — ${escapeHtml(result.featureSlug)}</h1>
<p>v4 compatible: ${result.v4Compatible ? 'yes' : 'no'}</p>
${errors ? `<section class="errors"><h2>Errors</h2><ul>${errors}</ul></section>` : ''}
<table><thead><tr><th>Requirement</th><th>Status</th><th>Tasks</th><th>Checks</th></tr></thead><tbody>${requirements}</tbody></table>
</main>
</body>
</html>
`;
}

export { escapeHtml, renderEvidenceGraphHtml };

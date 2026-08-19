import assert from 'node:assert/strict';
import test from 'node:test';

import { renderEvidenceGraphHtml } from '../src/evidence-graph-html';

test('Evidence Graph HTML escapes artifact content and has no active markup', () => {
  const result = {
    featureSlug: '<img src=x>',
    v4Compatible: true,
    errors: ['<script>alert(1)</script> https://example.test'],
    requirements: [
      {
        reqId: 'REQ-2',
        status: 'stale' as const,
        taskIds: ['T2'],
        checkReports: ['<a href=https://example.test>report</a>'],
      },
      { reqId: 'REQ-1', status: 'current' as const, taskIds: [], checkReports: [] },
    ],
  };
  const html = renderEvidenceGraphHtml(result);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; https:\/\/example\.test/);
  assert.doesNotMatch(html, /<script\b|<img\b|<a\b|<link\b|<iframe\b|<object\b|<form\b/);
  assert.ok(html.indexOf('REQ-1') < html.indexOf('REQ-2'));
  assert.equal(renderEvidenceGraphHtml(result), html);
});

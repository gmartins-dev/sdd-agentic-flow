function renderCliCommand(...parts: string[]): string {
  return ['npx', 'sdd-agentic-flow', ...parts].filter(Boolean).join(' ');
}

export { renderCliCommand };

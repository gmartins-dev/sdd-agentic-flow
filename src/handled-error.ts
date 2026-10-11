// An expected, user-actionable refusal (missing Git metadata, unsupported or interrupted
// installation state, unsafe provenance). The CLI reports it as a handled failure (exit 1);
// any other thrown error remains an unexpected internal error (exit 2).
class HandledError extends Error {
  override name = 'HandledError';
}

export { HandledError };

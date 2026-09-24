export function errorMessage(error: unknown, fallback = 'Server error') {
  return error instanceof Error && error.message ? error.message : fallback;
}

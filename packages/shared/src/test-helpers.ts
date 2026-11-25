/**
 * Strips branded types (e.g. `Cents`) from a value for assertions, so tests can
 * compare against the plain numeric/JSON shape a client would actually see.
 * Runtime identity function — never use it in product code.
 */
export function plain(value: unknown): unknown {
	return value;
}

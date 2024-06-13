/**
 * Assert Not Null
 * @template T
 * @param {T | null} v
 * @returns {T}
 */
export function notnull(v) {
	if (v != null) return v;
	else throw new TypeError("Unexpected null");
}

/**
 *
 * @param {string} filename
 * @returns {string} sanitized filename
 */
export function sanitize_filename(filename) {
	return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
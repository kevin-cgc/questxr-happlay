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

export function get_random_order(iter) {
	const arr_copy = [...iter];
	for (let i = arr_copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr_copy[i], arr_copy[j]] = [arr_copy[j], arr_copy[i]];
	}
	return arr_copy;
}
export const SAMPLE_RATE = 8000;

const hash_params = new URLSearchParams(location.hash.slice(1));
export const WORKSHOP_MODE = hash_params.has("workshop");
export const USE_API_PROMPT_UI = hash_params.has("apipromptui");



const search_params = new URLSearchParams(location.search);
// if (search_params.has("workshop")) {
// 	location.hash = "workshop";
// 	location.reload();
// }
if (search_params.size > 0) {
	console.warn("Ignoring search params (please use hash params e.g., `#workshop=true`)");
}
export const SAMPLE_RATE = 8000;

// const hash_params = new URLSearchParams(location.hash.slice(1));



const search_params = new URLSearchParams(location.search);
// if (search_params.has("workshop")) {
// 	location.hash = "workshop";
// 	location.reload();
// }
// if (search_params.size > 0) {
// 	console.warn("Ignoring search params (please use hash params e.g., `#workshop=true`)");
// }

export const VIDEO_PLAYBACK = search_params.has("video");
export const VIDEO_RATING_MODE = search_params.has("videorating");

export const FLIP_AB_MODELS = search_params.has("FLIP");
export const ALT_WSS_HOST = search_params.get("wsshost") ?? null;

export const WORKSHOP_MODE = search_params.has("workshop");
// export const USE_API_PROMPT_UI = search_params.has("apipromptui");
export const USE_GRADIO_PROMPT_UI = search_params.has("gradiopromptui");

export const CAPTION_RATING_MODE = search_params.has("caption");

document.body.classList.toggle("captionmode", CAPTION_RATING_MODE);
document.body.classList.toggle("videoratingmode", VIDEO_RATING_MODE);
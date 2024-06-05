import { USE_API_PROMPT_UI } from "./appmode.mjs";
import { notnull } from "./util.mjs";

const genmodelpromptcont_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector(".genmodelpromptcont")));
const duration_range_input = /** @type {HTMLInputElement} */ (notnull(genmodelpromptcont_div.querySelector("input[type=range]")));
const duration_number_input = /** @type {HTMLInputElement} */ (notnull(genmodelpromptcont_div.querySelector("input[type=number]")));
const apiprompt_div = /** @type {HTMLDivElement} */ (notnull(genmodelpromptcont_div.querySelector(".apiprompt")));
const gradio_app = /** @type {HTMLElement} */ (notnull(document.querySelector("gradio-app")));

for (const input of [duration_range_input, duration_number_input]) {
	input.addEventListener("input", () => {
		const value = parseFloat(input.value);
		if (isNaN(value)) return;
		if (input === duration_range_input) duration_number_input.value = value.toString();
		else duration_range_input.value = value.toString();
	});
}

if (USE_API_PROMPT_UI) {
	console.error("TODO: prompting API not yet implemented");
	//todo
	apiprompt_div.style.display = "";
	gradio_app.style.display = "none";
} else {
	apiprompt_div.style.display = "none";
	gradio_app.style.display = "";
	gradio_app.addEventListener("render", () => {
		const cont_div = /** @type {HTMLDivElement} */ (notnull(gradio_app.querySelector(".gradio-container")));
		// cont_div.attributeStyleMap.set("margin", CSS.px(0)); // doesnt work with svelte ig
		// cont_div.attributeStyleMap.set("min-height", CSS.percent(100));
		cont_div.style.margin = "0px";
		cont_div.style.minHeight = "100%";
	});
}
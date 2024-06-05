import { notnull } from "./util.mjs";

const genmodelpromptcont_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector(".genmodelpromptcont")));
const duration_range_input = /** @type {HTMLInputElement} */ (notnull(genmodelpromptcont_div.querySelector("input[type=range]")));
const duration_number_input = /** @type {HTMLInputElement} */ (notnull(genmodelpromptcont_div.querySelector("input[type=number]")));


for (const input of [duration_range_input, duration_number_input]) {
	input.addEventListener("input", () => {
		const value = parseFloat(input.value);
		if (isNaN(value)) return;
		if (input === duration_range_input) duration_number_input.value = value.toString();
		else duration_range_input.value = value.toString();
	});
}


console.error("TODO: prompting API not yet implemented");
import { USE_API_PROMPT_UI } from "./appmode.mjs";
import { save_signal_blob_to_file } from "./folderfilepicker.mjs";
import { notnull, sanitize_filename } from "./util.mjs";

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

		try {
			// search under gradio_app for button that contains text "submit"
			const submit_button = /** @type {HTMLButtonElement} */ (notnull([...gradio_app.querySelectorAll("button")].find(b => b.textContent?.toLowerCase().includes("submit"))));
			const textarea = /** @type {HTMLTextAreaElement} */ (notnull(gradio_app.querySelector("textarea")));
			const on_submit_fn = async () => {
				console.log("submit on gradio app");
				const prompt = textarea.value;
				const model = [...gradio_app.querySelectorAll("span")].find(s => s.textContent?.toLowerCase().includes("model"))?.closest("div")?.querySelector("input")?.value ?? "unknown";
				const result_container = /** @type {HTMLDivElement} */ (notnull([...gradio_app.querySelectorAll("label")].find(s => s.textContent?.toLowerCase().includes("result"))?.closest("div")));

				const og_signal_url = result_container.querySelector("a")?.href;

				let start_time = performance.now();
				while (result_container.querySelector("a")?.href === og_signal_url) {
					if (performance.now() - start_time > 60000) {
						console.error("Timeout waiting for signal URL");
						return;
					}
					await new Promise(resolve => setTimeout(resolve, 100));
				}
				const signal_url = notnull(result_container.querySelector("a")).href;

				await save_gradio_signal_to_file({signal_url, prompt, model});
			};
			submit_button.addEventListener("click", on_submit_fn);
			textarea.addEventListener("keydown", ev => {
				if (ev.key === "Enter" && !ev.shiftKey) {
					on_submit_fn();
				}
			});
		} catch (e) {
			console.error("Error setting up submit button", e);
		}
	});
}


/**
 * @param {{ signal_url: string, prompt: string, model: string }} param1
 */
async function save_gradio_signal_to_file({ signal_url, prompt, model }) {

	const signal = await fetch(signal_url).then(resp => resp.blob());

	const randid = Math.random().toString(36).substring(7);

	const filename = sanitize_filename(`${model}_${prompt.slice(0, 50)}_${randid}.wav`);

	await save_signal_blob_to_file(signal, {
		name: filename,
		filename,
		prompt,
		model,
		origin: notnull(document.querySelector("gradio-app"))["src"],
		sha265: "",
		starred: false,
		trash: false,
		vote: 0,
		playcount: 0,
	});

}
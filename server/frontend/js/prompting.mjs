import { USE_GRADIO_PROMPT_UI } from "./appmode.mjs";
import { convert_mono_audio_buffer_to_wav_pcm_u8 } from "./audio-buffer-to-wav.mjs";
import { save_signal_blob_to_file } from "./folderfilepicker.mjs";
import { NpWaveFormCanvas } from "./np-waveform-canvas.mjs";
import { notnull, sanitize_filename } from "./util.mjs";

/** @typedef {{ ab: AudioBuffer, prompt: string, model: string, randid: string, human_index: number }} WaveformInfo */

const genmodelpromptcont_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector(".genmodelpromptcont")));
const apiprompt_div = /** @type {HTMLDivElement} */ (notnull(genmodelpromptcont_div.querySelector(".apiprompt")));
const gradio_app = /** @type {HTMLElement | null} */ (document.querySelector("gradio-app"));

const API_URL = "/api/generate";
const N_AT_ONCE = 5;
const SHOW_TOP_N = 3;
const REQ_BODY_BASE = {
	"prompt": "",
	"n_at_once": N_AT_ONCE,
	"resp_type": "sorted"
};

const DOWNLOAD_ALL = true;

if (!USE_GRADIO_PROMPT_UI) {
	apiprompt_div.style.display = "";
	if (gradio_app) gradio_app.style.display = "none";
	genmodelpromptcont_div.style.display = "grid";
	genmodelpromptcont_div.style.gridTemplateRows = "100%";

	const prompt_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("input.prompt")));
	const model_select = /** @type {HTMLSelectElement} */ (notnull(apiprompt_div.querySelector("select.model")));
	const generate_button = /** @type {HTMLButtonElement} */ (notnull(apiprompt_div.querySelector("button.generate")));
	const resultspane_div = /** @type {HTMLDivElement} */ (notnull(apiprompt_div.querySelector("div.resultspane")));
	const resultslist_div = /** @type {HTMLDivElement} */ (notnull(resultspane_div.querySelector("div.resultslist")));
	const selectedresult_div = /** @type {HTMLDivElement} */ (notnull(resultspane_div.querySelector("div.selectedresult")));
	const selectedwaveform_npwfcanvas = /** @type {NpWaveFormCanvas} */ (notnull(selectedresult_div.querySelector("np-waveform-canvas")));
	const download_button = /** @type {HTMLButtonElement} */ (notnull(selectedresult_div.querySelector("button.download")));

	if (DOWNLOAD_ALL) {
		download_button.append("Download All");
	}

	const duration_range_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("input[type=range]")));
	const duration_number_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("input[type=number]")));
	for (const input of [duration_range_input, duration_number_input]) {
		input.addEventListener("input", () => {
			const value = parseFloat(input.value);
			if (isNaN(value)) return;
			if (input === duration_range_input) duration_number_input.value = value.toString();
			else duration_range_input.value = value.toString();
		});
	}

	generate_button.addEventListener("click", async () => {
		const prompt = prompt_input.value;
		const model = model_select.value;

		try {
			generate_button.disabled = true;
			generate_button.classList.add("generating");
			generate_button.animate({
				"transform": ["scaleX(0)", "scaleX(1)"],
			}, {
				duration: 13 * 1e3,
				iterations: 1,
				fill: "forwards",
				easing: "linear",
				pseudoElement: "::after",
			});

			clear_results();
			const resp = await fetch(API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ ...REQ_BODY_BASE, prompt })
			});
			const nwavs_b64 = await resp.json();
			if (typeof nwavs_b64 == "object" && "error" in nwavs_b64) {
				alert(`Error during generation: ${nwavs_b64.error}`);
				throw new Error(`Error during generation: ${nwavs_b64.error}`);
			}
			if (!Array.isArray(nwavs_b64)) {
				alert("Invalid response from server");
				throw new Error(`Invalid response from server: ${JSON.stringify(nwavs_b64)}`);
			}
			console.time("decode");
			const topnwavs_b64 = nwavs_b64.slice(0, SHOW_TOP_N);
			const nwavs_audio_buffers = topnwavs_b64.map((b64) => {
				const u8b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); // pcm_u8 samples
				const ab = new AudioBuffer({ length: u8b.byteLength, numberOfChannels: 1, sampleRate: 8000 });
				const channel = ab.getChannelData(0);
				for (let i = 0; i < channel.length; i++) {
					channel[i] = (u8b[i] - 128) / 128;
				}
				return ab;
			});
			console.timeEnd("decode");

			render_results(nwavs_audio_buffers, prompt, model);
		} finally {
			generate_button.disabled = false;
			generate_button.classList.remove("generating");

		}
	});


	/** @type {WaveformInfo | null} */
	let last_selected_waveform = null;
	/**
	 * @param {WaveformInfo} wfi
	 */
	function select_waveform(wfi) {
		last_selected_waveform = wfi;
		selectedwaveform_npwfcanvas.draw_waveform(wfi.ab.getChannelData(0));
		download_button.disabled = false;
	}


	function clear_results() {
		while (resultslist_div.firstChild) resultslist_div.removeChild(resultslist_div.firstChild);
		last_selected_waveform = null;
		last_waveforms = null;
		download_button.disabled = true;
		selectedwaveform_npwfcanvas.draw_waveform(null);
	}

	/** @type {{ nwavs_audio_buffers: AudioBuffer[], prompt: string, model: string, randid: string } | null} */
	let last_waveforms = null;
	/**
	 * @param {AudioBuffer[]} nwavs_audio_buffers
	 * @param {string} prompt
	 * @param {string} model
	 */
	function render_results(nwavs_audio_buffers, prompt, model) {
		clear_results();
		const randid = Math.random().toString(36).substring(7).toUpperCase();
		last_waveforms = { nwavs_audio_buffers, prompt, model, randid };

		let human_index = 1;
		for (const ab of nwavs_audio_buffers) {
			const result_div = document.createElement("div");
			result_div.classList.add("result");
			result_div.dataset.index = (human_index++).toString();

			const waveform_canvas = new NpWaveFormCanvas();
			result_div.appendChild(waveform_canvas);

			waveform_canvas.draw_waveform(ab.getChannelData(0));

			result_div.addEventListener("click", () => {
				for (const child of resultslist_div.children) {
					child.classList.remove("selected");
				}
				result_div.classList.add("selected");
				select_waveform({ab, prompt, model, randid, human_index});
			});

			resultslist_div.appendChild(result_div);
		}

		resultslist_div.querySelector(".result")?.classList.add("selected");
		select_waveform({ ab: nwavs_audio_buffers[0], prompt, model, randid, human_index: 1 });
	}

	download_button.addEventListener("click", async () => {
		if (DOWNLOAD_ALL) {
			if (!last_waveforms) return;
			const { nwavs_audio_buffers, prompt, model, randid } = last_waveforms;
			for (let i = 0; i < nwavs_audio_buffers.length; i++) {
				const human_index = i + 1;
				const ab = nwavs_audio_buffers[i];
				save_generated_waveform_to_file({ ab, prompt, model, randid, human_index });
			}
		} else {
			if (!last_selected_waveform) return;
			const { ab, prompt, model, randid, human_index } = last_selected_waveform;
			save_generated_waveform_to_file({ ab, prompt, model, randid, human_index });
		}
	});

	clear_results();
} else {
	if (!gradio_app) {
		alert("gradio-app not found");
		throw new Error("gradio-app not found");
	}
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
	const randid = Math.random().toString(36).substring(7).toUpperCase();
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

/**
 *
 * @param {WaveformInfo} wfi
 */
async function save_generated_waveform_to_file(wfi) {
	const { ab, prompt, model, randid, human_index } = wfi
    const signal = await convert_audio_buffer_to_wav(ab);
    const filename = sanitize_filename(`${prompt.slice(0, 50)}_${randid}_${human_index}.wav`);
    await save_signal_blob_to_file(signal, {
        name: filename,
        filename,
        prompt,
        model,
        origin: API_URL,
        sha265: "",
        starred: false,
        trash: false,
        vote: 0,
        playcount: 0,
    });
}



/**
 *
 * @param {AudioBuffer} ab
 */
async function convert_audio_buffer_to_wav(ab) {
	// const au_ctx = new AudioContext({ sampleRate: ab.sampleRate, latencyHint: "playback" });
	// const au_media_dest_node = au_ctx.createMediaStreamDestination()
	// const media_recorder = new MediaRecorder(au_media_dest_node.stream, { mimeType: "audio/wav" });

	// const au_buf_src_node = new AudioBufferSourceNode(au_ctx, { buffer: ab });
	// au_buf_src_node.connect(au_media_dest_node);
	// that approach is stuck with realtime playback because OfflineAudioContext doesnt support mediarecording (afaict), so in JS creation of the wav file might be better

	const wav_bytes = convert_mono_audio_buffer_to_wav_pcm_u8(ab);
	const wav_blob = new Blob([wav_bytes], { type: "audio/wav" });
	return wav_blob;
}

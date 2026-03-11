import { VIDEO_RATING_MODE, CAPTION_RATING_MODE, FLIP_AB_MODELS, USE_GRADIO_PROMPT_UI, VIDEO_PLAYBACK } from "./appmode.mjs";
import { convert_mono_audio_buffer_to_wav_pcm_u8 } from "./audio-buffer-to-wav.mjs";
import { save_signal_blob_to_file } from "./folderfilepicker.mjs";
import { NpWaveFormCanvas } from "./np-waveform-canvas.mjs";
import { notnull, sanitize_filename } from "./util.mjs";

/** @typedef {{ ab: AudioBuffer, vprompt: string, prompt: string, model: string, randid: string, human_index: number }} WaveformInfo */

const genmodelpromptcont_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector(".genmodelpromptcont")));
const apiprompt_div = /** @type {HTMLDivElement} */ (notnull(genmodelpromptcont_div.querySelector(".apiprompt")));
const captionrating_div = /** @type {HTMLDivElement} */ (notnull(genmodelpromptcont_div.querySelector(".captionrating")));
const videorating_div = /** @type {HTMLDivElement} */ (notnull(genmodelpromptcont_div.querySelector(".videorating")));
const gradio_app = /** @type {HTMLElement | null} */ (document.querySelector("gradio-app"));
const pbmvideopane_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector(".pbmvideopane")));

const API_URL = "/api/generate";
const N_AT_ONCE = 5;
const SHOW_TOP_N = 5;
const REQ_BODY_BASE = {
	"prompt": "",
	"n_at_once": N_AT_ONCE,
	"resp_type": "shuffled",
	"sorted_top_n": SHOW_TOP_N,
	"create_variants": true,
	"normalize_output": true,
};

const DOWNLOAD_ALL = true;
const AB_PROMPTING = false;

if (VIDEO_PLAYBACK) {
	genmodelpromptcont_div.style.display = "none";
	pbmvideopane_div.style.display = "";
} else if (VIDEO_RATING_MODE) {
    videorating_div.style.display = "";
    apiprompt_div.style.display = "none";
	// move video to videorating_div
	/** @type {HTMLDivElement} */
	const video_wrapper = notnull(document.querySelector(".video-wrapper"));
	notnull(videorating_div.querySelector(".videocontainer")).appendChild(video_wrapper);
	/** @type {HTMLVideoElement} */
	const video = notnull(video_wrapper.querySelector("video#pbmvideo"));
	video.controls = false;
	/** @type {HTMLDivElement} */
	const header = notnull(document.querySelector("div.header"));
	header.style.visibility = "hidden";
	header.style.height = "0px";

} else if (CAPTION_RATING_MODE) {
	captionrating_div.style.display = "";
	apiprompt_div.style.display = "none";

} else if (!USE_GRADIO_PROMPT_UI) {
	apiprompt_div.style.display = "";
	if (gradio_app) gradio_app.style.display = "none";
	genmodelpromptcont_div.style.display = "grid";
	genmodelpromptcont_div.style.gridTemplateRows = "100%";

	const prompt_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("input.prompt")));
	const genmodelinputcontainer_div = /** @type {HTMLDivElement} */ (notnull(apiprompt_div.querySelector(".genmodelinputcontainer")));
	const model_select = /** @type {HTMLSelectElement} */ (notnull(apiprompt_div.querySelector("select.model")));
	const generate_button = /** @type {HTMLButtonElement} */ (notnull(apiprompt_div.querySelector("button.generate")));
	const resultspane_div = /** @type {HTMLDivElement} */ (notnull(apiprompt_div.querySelector("div.resultspane")));
	const resultslist_modelA_div = /** @type {HTMLDivElement} */ (notnull(resultspane_div.querySelector("div.resultslist.modela")));
	const modela_h3 = /** @type {HTMLHeadingElement} */ (notnull(resultslist_modelA_div.parentElement?.querySelector("h3")));
	const resultslist_modelB_div = /** @type {HTMLDivElement} */ (notnull(resultspane_div.querySelector("div.resultslist.modelb")));
	const modelb_h3 = /** @type {HTMLHeadingElement} */ (notnull(resultslist_modelB_div.parentElement?.querySelector("h3")));
	const selectedresult_div = /** @type {HTMLDivElement} */ (notnull(resultspane_div.querySelector("div.selectedresult")));
	const selectedwaveform_npwfcanvas = /** @type {NpWaveFormCanvas} */ (notnull(selectedresult_div.querySelector("np-waveform-canvas")));
	const download_button = /** @type {HTMLButtonElement} */ (notnull(selectedresult_div.querySelector("button.download")));

	const AB_MODELS = FLIP_AB_MODELS ?
		{ // flipped
			"modelA": "HFaudiogen-medium_db34c85a",
			"modelB": "51eabea7_d684b3a7",
		} :
		{ // default
			"modelA": "51eabea7_d684b3a7",
			"modelB": "HFaudiogen-medium_db34c85a",
		};
	console.log("FLIP_AB_MODELS: ", FLIP_AB_MODELS, "AB_MODELS: ", AB_MODELS);
	/** @type {Record<string, number>} */
	const EXPECTED_DURATION_FOR_MODEL = {
		"51eabea7_d684b3a7": 15 * 1e3, // 15s
		"HFaudiogen-medium_db34c85a": 32 * 1e3, // 32s
	};
	const MODEL_TO_AB_MAP = new Map(Object.entries(AB_MODELS).map(([k, v]) => [v, k]));
	/**
	 * @param {string} user_study_model_name
	 * @returns {HTMLDivElement}
	 */
	function get_resultslist_div(user_study_model_name) {
		if (user_study_model_name === "modelA") return resultslist_modelA_div;
		if (user_study_model_name === "modelB") return resultslist_modelB_div;
		throw new Error(`Unknown user_study_model_name: ${user_study_model_name}`);
	}
	/**
	 *
	 * @param {string} model
	 * @returns {string}
	 */
	function model_to_user_study_model_name(model) {
		const user_study_model_name = MODEL_TO_AB_MAP.get(model);
		if (!user_study_model_name) throw new Error(`Unknown model: ${model}`);
		return user_study_model_name;
	}

	if (DOWNLOAD_ALL) {
		download_button.append("Download All");
	}
	if (AB_PROMPTING) {
		genmodelinputcontainer_div.style.display = "none";
	} else {
		// modela_h3.style.visibility = "hidden";
		notnull(resultslist_modelB_div.parentElement).style.display = "none";
	}

	const duration_range_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("#genmodelduration_range")));
	const duration_number_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("#genmodelduration")));
	for (const input of [duration_range_input, duration_number_input]) {
		input.addEventListener("input", () => {
			const value = parseFloat(input.value);
			if (isNaN(value)) return;
			if (input === duration_range_input) duration_number_input.value = value.toString();
			else duration_range_input.value = value.toString();
		});
	}

	const topk_number_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("#genmodeltopk")));
	const topp_number_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("#genmodeltopp")));
	const temperature_number_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("#genmodeltemperature")));
	const use_sampling_checkbox = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("#genmodelusesampling")));
	const cfgcoef_number_input = /** @type {HTMLInputElement} */ (notnull(apiprompt_div.querySelector("#genmodelcfgcoef")));


	generate_button.addEventListener("click", async () => {
		prompt_input.value = prompt_input.value.trim();

		const prompt = prompt_input.value;
		const model = model_select.value;
		const duration = parseFloat(duration_number_input.value);
		const use_sampling = use_sampling_checkbox.checked;
		const topk = parseInt(topk_number_input.value);
		const topp = parseFloat(topp_number_input.value);
		const cfg_coef = parseFloat(cfgcoef_number_input.value);
		const temperature = parseFloat(temperature_number_input.value);
		if (!Number.isFinite(duration) || !Number.isFinite(topk) || !Number.isFinite(temperature)) {
			alert("Invalid number input for generation parameters");
			throw new Error("Invalid number input for generation parameters");
		}

		/** @type {{ el: HTMLElement, dur: number }[]} */
		const animate_generating_els = [
			{ el: generate_button, dur: 15 * 1e3 },
			{ el: modela_h3, dur: EXPECTED_DURATION_FOR_MODEL[AB_MODELS["modelA"]] },
			{ el: modelb_h3, dur: EXPECTED_DURATION_FOR_MODEL[AB_MODELS["modelB"]] }
		];
		try {
			generate_button.disabled = true;
			for (const { el, dur } of animate_generating_els) {
				el.classList.add("generating");
				el.animate({ "transform": ["scaleX(0)", "scaleX(1)"] }, {
					duration: dur,
					iterations: 1,
					fill: "forwards",
					easing: "linear",
					pseudoElement: "::after",
				});
			}


			clear_results();
			const randid = Math.random().toString(36).substring(7).toUpperCase();

			if (AB_PROMPTING) {
				last_waveforms = [];
				const settled = await Promise.allSettled(Object.entries(AB_MODELS).map(async ([user_study_model_name, model]) => {
					const { nwavs_audio_buffers, vprompt_list } = await make_request({ prompt, model, use_sampling, topk, topp, temperature, cfg_coef, });
					const resultslist_div = get_resultslist_div(user_study_model_name);
					if (!Array.isArray(last_waveforms)) throw new Error("last_waveforms not array");
					last_waveforms.push({ nwavs_audio_buffers, vprompt_list, prompt, model, randid });
					render_list_results(nwavs_audio_buffers, vprompt_list, prompt, model, resultslist_div, randid);
				}));
				for (const s of settled) {
					if (s.status === "rejected") {
						console.error("Error during generation", s.reason);
						throw s.reason;
					}
				}
			} else {
				const { nwavs_audio_buffers, vprompt_list } = await make_request({ prompt, model, use_sampling, topk, topp, temperature, cfg_coef, });
				last_waveforms = { nwavs_audio_buffers, vprompt_list, prompt, model, randid };
				render_list_results(nwavs_audio_buffers, vprompt_list, prompt, model, resultslist_modelA_div, randid);
			}

			download_button.disabled = false;
		} finally {
			generate_button.disabled = false;
			for (const { el } of animate_generating_els) el.classList.remove("generating");
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
	}


	function clear_results() {
		while (resultslist_modelA_div.firstChild) resultslist_modelA_div.removeChild(resultslist_modelA_div.firstChild);
		while (resultslist_modelB_div.firstChild) resultslist_modelB_div.removeChild(resultslist_modelB_div.firstChild);
		last_selected_waveform = null;
		last_waveforms = null;
		download_button.disabled = true;
		selectedwaveform_npwfcanvas.draw_waveform(null);
	}

	/** @typedef {{ nwavs_audio_buffers: AudioBuffer[], vprompt_list: string[], prompt: string, model: string, randid: string }} LastWaveforms */
	/** @type {LastWaveforms | LastWaveforms[] | null} */
	let last_waveforms = null;
	/**
	 * @param {AudioBuffer[]} nwavs_audio_buffers
	 * @param {string} prompt
	 * @param {string} model
	 */
	function render_list_results(nwavs_audio_buffers, vprompt_list, prompt, model, resultslist_div, randid) {
		// clear_results(); # allow filling both resultslist_divs
		// last_waveforms = { nwavs_audio_buffers, vprompt_list, prompt, model, randid };

		let i = 0;
		let human_index = 1;
		for (const ab of nwavs_audio_buffers) {
			const vprompt = vprompt_list[i++];
			const result_div = document.createElement("div");
			result_div.classList.add("result");
			result_div.dataset.index = (human_index++).toString();

			const waveform_canvas = new NpWaveFormCanvas();
			result_div.appendChild(waveform_canvas);

			waveform_canvas.draw_waveform(ab.getChannelData(0));

			result_div.addEventListener("click", () => {
				for (const child of [...resultslist_modelA_div.children, ...resultslist_modelB_div.children]) {
					child.classList.remove("selected");
				}
				result_div.classList.add("selected");
				select_waveform({ab, vprompt, prompt, model, randid, human_index});
			});

			resultslist_div.appendChild(result_div);
		}

		const either_list_has_selected_result = [...resultslist_modelA_div.children, ...resultslist_modelB_div.children].some(div => div.classList.contains("selected"));
		if (!either_list_has_selected_result) { // if nothing selected already, select first result
			resultslist_div.querySelector(".result")?.classList.add("selected");
			select_waveform({ ab: nwavs_audio_buffers[0], vprompt: vprompt_list[0], prompt, model, randid, human_index: 1 });
		}
	}

	download_button.addEventListener("click", async () => {
		if (DOWNLOAD_ALL) {
			if (!last_waveforms) return;
			for (const lwfs of (Array.isArray(last_waveforms) ? last_waveforms : [last_waveforms])) {
				const { nwavs_audio_buffers, vprompt_list, prompt, model, randid } = lwfs;
				for (let i = 0; i < nwavs_audio_buffers.length; i++) {
					const human_index = i + 1;
					const ab = nwavs_audio_buffers[i];
					const vprompt = vprompt_list[i];
					const user_study_model_name = model_to_user_study_model_name(model);
					await save_generated_waveform_to_file({ ab, prompt, vprompt, model, randid, human_index }, user_study_model_name);
				}
			}
		} else {
			if (!last_selected_waveform) return;
			const { ab, vprompt, prompt, model, randid, human_index } = last_selected_waveform;
			const user_study_model_name = model_to_user_study_model_name(model);
			await save_generated_waveform_to_file({ ab, vprompt, prompt, model, randid, human_index }, user_study_model_name);
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
		vprompt: prompt,
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
 * @param {string=} userstudy_model_name
 */
async function save_generated_waveform_to_file(wfi, userstudy_model_name) {
	const { ab, vprompt, prompt, model, randid, human_index } = wfi
    const signal = await convert_audio_buffer_to_wav(ab);
	const raw_fn = userstudy_model_name ? `${prompt.slice(0, 50)}_${randid}_${userstudy_model_name}_${human_index}.wav` : `${prompt.slice(0, 50)}_${randid}_${human_index}.wav`;
    const filename = sanitize_filename(raw_fn);
    await save_signal_blob_to_file(signal, {
        name: filename,
        filename,
		vprompt,
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

async function make_request({ prompt, model, use_sampling, topk, topp, temperature, cfg_coef,}) {
	const resp = await fetch(API_URL, {
		method: "POST", headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			...REQ_BODY_BASE,
			prompt,
			model_name: model,
			use_sampling: use_sampling,
			top_k: topk,
			top_p: topp,
			temperature: temperature,
			cfg_coef: cfg_coef,
		})
	});
	const result = await resp.json();
	const nwavs_b64 = result["wavs"];
	/** @type {string[]} */
	const vprompt_list = result["prompts"];
	if (typeof nwavs_b64 == "object" && "error" in nwavs_b64) {
		alert(`Error during generation: ${nwavs_b64.error}`);
		throw new Error(`Error during generation: ${nwavs_b64.error}`);
	}
	if (!Array.isArray(nwavs_b64) || !Array.isArray(vprompt_list) || nwavs_b64.length !== vprompt_list.length) {
		alert("Invalid response from server");
		throw new Error(`Invalid response from server: ${JSON.stringify({nwavs_b64, vprompt_list})}`);
	}
	// console.time("decode");
	// const topnwavs_b64 = nwavs_b64.slice(0, SHOW_TOP_N); # should be done server side
	const nwavs_audio_buffers = nwavs_b64.map((b64) => {
		const u8b = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); // pcm_u8 samples
		const ab = new AudioBuffer({ length: u8b.byteLength, numberOfChannels: 1, sampleRate: 8000 });
		const channel = ab.getChannelData(0);
		for (let i = 0; i < channel.length; i++) {
			channel[i] = (u8b[i] - 128) / 128;
		}
		return ab;
	});
	// console.timeEnd("decode");

	return { nwavs_audio_buffers, vprompt_list };
}
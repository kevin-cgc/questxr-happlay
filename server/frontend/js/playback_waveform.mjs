import { CAPTION_RATING_MODE, SAMPLE_RATE, VIDEO_RATING_MODE, WORKSHOP_MODE } from "./appmode.mjs";
import { bump_playcount_on_filemeta } from "./folderfilepicker.mjs";
import { notnull } from "./util.mjs";
import { start_video_playback, stop_video_playback } from "./video-playback.mjs";

const playbackv_div = /** @type {HTMLDivElement} **/ (document.getElementById("playbackv"));
const waveformcontainer_div = /** @type {HTMLDivElement} **/ (document.getElementById("waveformcontainer"));
const waveformcanvas = /** @type {HTMLCanvasElement} **/ (document.getElementById("waveformcanvas"));
const playbackheadcanvas = /** @type {HTMLCanvasElement} **/ (document.getElementById("playbackheadcanvas"));
const playbackstatus_div = /** @type {HTMLDivElement} **/ (playbackv_div.querySelector(".playbackstatus"));
const filename_span = /** @type {HTMLSpanElement} **/ (playbackstatus_div.querySelector("span.filename"));
const playback_progress = /** @type {HTMLProgressElement} **/ (playbackstatus_div.querySelector("progress"));
playbackheadcanvas.width = waveformcanvas.width = notnull(waveformcanvas.parentElement).clientWidth ?? 500;
window.addEventListener("resize", () => {
	playbackheadcanvas.width = waveformcanvas.width = notnull(waveformcanvas.parentElement).clientWidth ?? 500;
	if (last_waveform) draw_waveform(last_waveform.pcm, last_waveform.filename);
	else draw_unknown_waveform();
});

const wf_ctx = notnull(waveformcanvas.getContext("2d"));
function draw_unknown_waveform() {
	filename_span.textContent = "Unknown current filename";

	wf_ctx.fillStyle = "black";
	wf_ctx.fillRect(0, 0, waveformcanvas.width, waveformcanvas.height);
	wf_ctx.font = "50px monospace";
	wf_ctx.fillStyle = "white";
	wf_ctx.textAlign = "center";
	wf_ctx.fillText("Unknown current waveform", waveformcanvas.width / 2, waveformcanvas.height / 2);
}
draw_unknown_waveform();

/** samples per pixel */
let last_step = 0;
/** @type {null | { pcm: Float32Array, filename: string }} */
export let last_waveform = null;
/** @type {(pcm: Float32Array, filename: string) => void} */
export const draw_waveform = (pcm, filename) => {
	last_waveform = { pcm, filename };

	// console.log(`max: ${Math.max(...pcm)}, min: ${Math.min(...pcm)}`)

	filename_span.textContent = filename;

	wf_ctx.fillStyle = "black";
	wf_ctx.fillRect(0, 0, waveformcanvas.width, waveformcanvas.height);

	const { width, height } = waveformcanvas;
	last_step = pcm.length / width;
	wf_ctx.strokeStyle = "white";
	wf_ctx.beginPath();
	wf_ctx.moveTo(0, height / 2);
	for (let i = 0; i < width - 1; i++) {
		// const sample = pcm[Math.floor(i * last_step)];
		// wf_ctx.lineTo(i, height / 2 - sample * height / 2);
		const samples = pcm.slice(Math.floor(i * last_step), Math.floor((i + 1) * last_step));
		const max = Math.max(...samples);
		const min = Math.min(...samples);
		wf_ctx.lineTo(i, height / 2 - min * height / 2);
		wf_ctx.lineTo(i, height / 2 - max * height / 2);
	}
	wf_ctx.stroke();
}


let playback_started_at = null;
export function start_playback() {
	playback_started_at = performance.now();
	start_video_playback();

	if (last_waveform) bump_playcount_on_filemeta(last_waveform.filename);

	const tick = () => {
		if (playback_started_at == null) {
			draw_playback_head(0);
			return;
		} else {
			const elapsed = performance.now() - playback_started_at;
			draw_playback_head(elapsed);
			requestAnimationFrame(tick);
		}
	};

	tick();
}
export function stop_playback() {
	playback_started_at = null;
	stop_video_playback();
}

const pbh_ctx = notnull(playbackheadcanvas.getContext("2d"));
const draw_playback_head = elapsed => {
	const { width, height } = playbackheadcanvas;
	pbh_ctx.clearRect(0, 0, width, height);
	pbh_ctx.fillStyle = "red";
	const samples_elapsed = (elapsed / 1000) * SAMPLE_RATE;
	const position = samples_elapsed / last_step;
	pbh_ctx.fillRect(position, 0, 2, height);

	try {
		playback_progress.value = 100 * samples_elapsed / (last_waveform?.pcm.length ?? 0);
	} catch (e) {}
}

export function mark_playback_loading() {
	playback_progress.removeAttribute("value");
}
export function mark_playback_loaded() {
	playback_progress.value = 0;
}

if (WORKSHOP_MODE || CAPTION_RATING_MODE) {
	playbackv_div.classList.add("nowaveform")
}
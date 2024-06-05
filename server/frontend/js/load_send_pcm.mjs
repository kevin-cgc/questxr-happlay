import { SAMPLE_RATE } from "./appmode.mjs";
import { get_num_devices, mark_devices_notacked } from "./devicelist.mjs";
import { draw_waveform, mark_playback_loading } from "./playback_waveform.mjs";
import { notnull } from "./util.mjs";
import { send_ws_pcm_signal } from "./websocket.mjs";

/**
 *
 * @param {File} file
 */
export function load_and_send_pcm(file) {
	// if (file.type !== "audio/wav") { // lets just let decodeAudioData complain
	// 	alert("Invalid file type, must be audio/wav");
	// 	return;
	// }
	if (file.size > 5e6) {
		alert("File size should be less than 5MB (soft limit, can remove if needed)");
		return;
	}

	const reader = new FileReader();
	reader.onload = async () => {
		try {
			const data = notnull(reader.result);
			if (typeof data === "string") throw new TypeError("unreachable");

			const audio_ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "playback" });
			const decoded_pcm = await audio_ctx.decodeAudioData(data);
			console.log(decoded_pcm);

			if (decoded_pcm.numberOfChannels !== 1) {
				alert("Audio file is not mono");
				return;
			}

			const pcm = decoded_pcm.getChannelData(0); // device expects f32le

			send_pcm(pcm, file.name);

		} catch (err) {
			console.error(err);
			alert("Error reading file, see browser console for details");
		}
	};
	reader.readAsArrayBuffer(file);
}

/**
 *
 * @param {Float32Array} pcm
 * @param {string} filename
 */
export function send_pcm(pcm, filename) {
	draw_waveform(pcm, filename);

	send_ws_pcm_signal(pcm);

	mark_devices_notacked();
	if (get_num_devices() > 0) mark_playback_loading() // show loading while not acked (sending)
}
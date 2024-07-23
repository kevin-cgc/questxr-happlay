import { SAMPLE_RATE } from "./appmode.mjs";
import { get_num_devices, mark_devices_notacked } from "./devicelist.mjs";
import { draw_waveform, mark_playback_loading } from "./playback_waveform.mjs";
import { notnull } from "./util.mjs";
import { send_ws_pcm_signal } from "./websocket.mjs";

const HAPTIC_DECODE_AUDIO_CTX = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "playback" });

/**
 *
 * @param {File} file
 * @returns {Promise<Float32Array>}
 */
export async function load_pcm(file) {
	// if (file.type !== "audio/wav") { // lets just let decodeAudioData complain
	// 	throw new Error("Invalid file type, must be audio/wav");
	// }
	if (file.size > 5e6) {
		throw new Error("File size should be less than 5MB (soft limit, can remove if needed)");
	}
	try {
		const reader = new FileReader();
		const read_prom = new Promise((resolve, reject) => {
			reader.onload = async () => {
				try {
					const data = notnull(reader.result);
					if (typeof data === "string") throw new TypeError("unreachable");

					const decoded_pcm = await HAPTIC_DECODE_AUDIO_CTX.decodeAudioData(data);
					if (decoded_pcm.numberOfChannels !== 1) throw new Error("Audio file is not mono");
					const pcm = decoded_pcm.getChannelData(0); // device expects f32le
					resolve(pcm);
				} catch (err) {
					reject(err);
				}
			};
			reader.readAsArrayBuffer(file);
		});

		return await read_prom;
	} catch (err) {
		throw new Error(`Failed to load PCM data from file '${file.name}': ${err}`);
	}
}

/**
 *
 * @param {File} file
 */
export async function load_and_send_pcm(file) {
	const pcm = await load_pcm(file);
	send_pcm(pcm, file.name);
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
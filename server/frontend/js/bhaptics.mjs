import { SAMPLE_RATE } from "./appmode.mjs";

export const BHAPTICS_BIN_DURATION_MS = 100;
const USE_PATH = false;
const PATH_COORDINATES = [[0.2, 0.2], [0.2, 0.2]];
let single_actuator_num = 5;

/** @type {Float32Array | null} */
let current_pcm = null;
let playback_generation = 0;

const tact_promise = initialize_bhaptics();

window.addEventListener("refresh-haptic-devices", () => {
	refresh_bhaptics_devices().catch(error => console.error("Failed to refresh bHaptics devices", error));
});
window.addEventListener("bhaptics-actuator-change", event => {
	const actuator_num = Number(/** @type {CustomEvent} */ (event).detail);
	if (Number.isInteger(actuator_num) && actuator_num >= 0 && actuator_num < 40) {
		single_actuator_num = actuator_num;
	}
});

async function initialize_bhaptics() {
	try {
		const response = await fetch("/api/bhaptics/config");
		if (!response.ok) throw new Error(`Config request failed (${response.status})`);
		const config = await response.json();
		if (!config.enabled) {
			window.dispatchEvent(new CustomEvent("bhaptics-vest-status", {
				detail: { connected: false, actuator_num: single_actuator_num, configured: false },
			}));
			return null;
		}

		const module_path = "/vendor/tact-js/bundle.js";
		const { default: Tact, PositionType } = await import(module_path);
		await Tact.init({ appId: config.appId, apiKey: config.apiKey });
		console.info("bHaptics SDK initialized");
		const sdk = { Tact, PositionType };
		await update_bhaptics_devices(sdk);
		return sdk;
	} catch (error) {
		console.error("Failed to initialize bHaptics SDK", error);
		window.dispatchEvent(new CustomEvent("bhaptics-vest-status", {
			detail: { connected: false, actuator_num: single_actuator_num, error },
		}));
		return null;
	}
}

async function update_bhaptics_devices(sdk) {
	const vest_connected = await sdk.Tact.isDeviceConnected(sdk.PositionType.Vest);
	window.dispatchEvent(new CustomEvent("bhaptics-vest-status", {
		detail: { connected: vest_connected, actuator_num: single_actuator_num, configured: true },
	}));
}

async function refresh_bhaptics_devices() {
	const sdk = await tact_promise;
	if (sdk) await update_bhaptics_devices(sdk);
}

function sleep(duration_ms) {
	return new Promise(resolve => setTimeout(resolve, duration_ms));
}

function lerp_path(t) {
	if (t <= 0) return PATH_COORDINATES[0];
	if (t >= 1) return PATH_COORDINATES[PATH_COORDINATES.length - 1];

	const segment_count = PATH_COORDINATES.length - 1;
	const scaled_t = t * segment_count;
	const segment_index = Math.min(Math.floor(scaled_t), segment_count - 1);
	const local_t = scaled_t - segment_index;
	const start = PATH_COORDINATES[segment_index];
	const end = PATH_COORDINATES[segment_index + 1];
	return [
		start[0] + (end[0] - start[0]) * local_t,
		start[1] + (end[1] - start[1]) * local_t,
	];
}

function calculate_amplitudes(pcm) {
	const window_size = Math.max(1, Math.round(SAMPLE_RATE * BHAPTICS_BIN_DURATION_MS / 1000));
	const amplitudes = [];
	for (let offset = 0; offset < pcm.length; offset += window_size) {
		const end = Math.min(offset + window_size, pcm.length);
		let sum_of_squares = 0;
		for (let i = offset; i < end; i++) sum_of_squares += pcm[i] ** 2;
		const rms = Math.sqrt(sum_of_squares / (end - offset));
		amplitudes.push(Math.min(100, Math.trunc(rms * 200)));
	}
	return amplitudes;
}

export function set_bhaptics_pcm(pcm) {
	current_pcm = pcm;
}

export async function start_bhaptics_playback() {
	if (!current_pcm) return;
	const amplitudes = calculate_amplitudes(current_pcm);
	await play_bhaptics_amplitudes(amplitudes);
}

/**
 * Plays values that are already aligned to bHaptics' 100 ms amplitude bins.
 * Each value is clamped to an integer intensity from 0 through 100.
 *
 * @param {Iterable<number>} amplitudes
 * @returns {Promise<boolean>} Whether playback could be started.
 */
export async function play_bhaptics_amplitudes(amplitudes) {
	const values = Array.from(amplitudes, amplitude =>
		Math.round(Math.min(100, Math.max(0, Number(amplitude) || 0)))
	);
	const generation = ++playback_generation;
	const sdk = await tact_promise;
	if (!sdk || values.length === 0 || generation !== playback_generation) return false;

	const started_at = performance.now();
	for (let i = 0; i < values.length; i++) {
		const delay = started_at + i * BHAPTICS_BIN_DURATION_MS - performance.now();
		if (delay > 0) await sleep(delay);
		if (generation !== playback_generation) return true;

		const t = i / Math.max(1, values.length - 1);
		const [x, y] = lerp_path(t);
		if (USE_PATH) {
			await sdk.Tact.playPath({
				position: sdk.PositionType.Vest,
				x: [x],
				y: [y],
				intensity: [values[i]],
				duration: BHAPTICS_BIN_DURATION_MS,
			});
		} else {
			const motor_len = 40;
			const motor_values = new Array(motor_len).fill(0);
			motor_values[single_actuator_num] = values[i];
			await sdk.Tact.playDot({
				position: sdk.PositionType.Vest,
				duration: BHAPTICS_BIN_DURATION_MS,
				motorValues: motor_values
			});
		}
	}

	await sleep(BHAPTICS_BIN_DURATION_MS);
	if (generation === playback_generation) await sdk.Tact.stopAll();
	return true;
}

export async function stop_bhaptics_playback() {
	playback_generation++;
	const sdk = await tact_promise;
	if (sdk) await sdk.Tact.stopAll();
}

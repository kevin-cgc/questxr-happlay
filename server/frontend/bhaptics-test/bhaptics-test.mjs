import {
	BHAPTICS_BIN_DURATION_MS,
	play_bhaptics_amplitudes,
	stop_bhaptics_playback,
} from "../js/bhaptics.mjs";

const fields = {
	onBins: /** @type {HTMLInputElement} */ (document.getElementById("on-bins")),
	offBins: /** @type {HTMLInputElement} */ (document.getElementById("off-bins")),
	cycles: /** @type {HTMLInputElement} */ (document.getElementById("cycles")),
	intensity: /** @type {HTMLInputElement} */ (document.getElementById("intensity")),
	actuator: /** @type {HTMLInputElement} */ (document.getElementById("actuator")),
};
const patternElement = /** @type {HTMLDivElement} */ (document.getElementById("pattern"));
const summaryElement = /** @type {HTMLParagraphElement} */ (document.getElementById("pattern-summary"));
const intensityValue = /** @type {HTMLOutputElement} */ (document.getElementById("intensity-value"));
const vestStatus = /** @type {HTMLDivElement} */ (document.getElementById("vest-status"));
const playbackStatus = /** @type {HTMLParagraphElement} */ (document.getElementById("playback-status"));
const playButton = /** @type {HTMLButtonElement} */ (document.getElementById("play"));
const stopButton = /** @type {HTMLButtonElement} */ (document.getElementById("stop"));
let uiPlaybackGeneration = 0;

function integerValue(input, fallback) {
	const value = Number.parseInt(input.value, 10);
	return Number.isInteger(value) ? value : fallback;
}

function createPattern() {
	const onBins = Math.min(100, Math.max(1, integerValue(fields.onBins, 1)));
	const offBins = Math.min(100, Math.max(0, integerValue(fields.offBins, 0)));
	const cycles = Math.min(100, Math.max(1, integerValue(fields.cycles, 1)));
	const intensity = Math.min(100, Math.max(1, integerValue(fields.intensity, 100)));
	const cycle = [
		...new Array(onBins).fill(intensity),
		...new Array(offBins).fill(0),
	];
	return Array.from({ length: cycles }, () => cycle).flat();
}

function renderPattern() {
	const amplitudes = createPattern();
	intensityValue.value = fields.intensity.value;
	patternElement.replaceChildren(...amplitudes.map((amplitude, index) => {
		const bin = document.createElement("span");
		bin.className = amplitude > 0 ? "bin on" : "bin off";
		bin.title = `Bin ${index + 1}: ${amplitude}`;
		bin.setAttribute("aria-label", `Bin ${index + 1}, intensity ${amplitude}`);
		return bin;
	}));
	const durationSeconds = amplitudes.length * BHAPTICS_BIN_DURATION_MS / 1000;
	summaryElement.textContent = `${amplitudes.length} bins × ${BHAPTICS_BIN_DURATION_MS} ms = ${durationSeconds.toFixed(1)} seconds`;
}

for (const input of Object.values(fields)) {
	input.addEventListener("input", renderPattern);
}

fields.actuator.addEventListener("change", () => {
	const actuator = integerValue(fields.actuator, 5);
	if (actuator < 0 || actuator > 39) return;
	window.dispatchEvent(new CustomEvent("bhaptics-actuator-change", { detail: actuator }));
});

window.addEventListener("bhaptics-vest-status", event => {
	const detail = /** @type {CustomEvent} */ (event).detail;
	const connected = Boolean(detail.connected);
	vestStatus.textContent = connected
		? "Vest connected"
		: detail.configured === false
			? "bHaptics is not configured"
			: detail.error
				? "bHaptics initialization failed"
				: "Vest not connected";
	vestStatus.className = `status ${connected ? "connected" : "disconnected"}`;
});

playButton.addEventListener("click", async () => {
	const actuator = Math.min(39, Math.max(0, integerValue(fields.actuator, 5)));
	fields.actuator.value = String(actuator);
	window.dispatchEvent(new CustomEvent("bhaptics-actuator-change", { detail: actuator }));
	const generation = ++uiPlaybackGeneration;
	playbackStatus.textContent = "Playing…";
	playButton.disabled = true;
	try {
		const started = await play_bhaptics_amplitudes(createPattern());
		if (generation === uiPlaybackGeneration) {
			playbackStatus.textContent = started ? "Playback finished." : "Playback unavailable. Check the bHaptics configuration and connection.";
		}
	} catch (error) {
		console.error("bHaptics test playback failed", error);
		if (generation === uiPlaybackGeneration) {
			playbackStatus.textContent = `Playback failed: ${error instanceof Error ? error.message : String(error)}`;
		}
	} finally {
		if (generation === uiPlaybackGeneration) playButton.disabled = false;
	}
});

stopButton.addEventListener("click", async () => {
	uiPlaybackGeneration++;
	await stop_bhaptics_playback();
	playbackStatus.textContent = "Playback stopped.";
	playButton.disabled = false;
});

renderPattern();

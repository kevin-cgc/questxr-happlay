import { notnull } from "./util.mjs";

export class NpWaveFormCanvas extends HTMLElement {
	#canvas;
	#ctx;
	/** @type {Float32Array | null} */
	#last_waveform;

	#_resize_observer = new ResizeObserver(this.#_on_parent_resize.bind(this));

	static observedAttributes = ["width", "height"];

	/** @type {number | null} */
	#_set_width = null;
	/** @type {number | null} */
	#_set_height = null;
	set width(value) {
		this.#_set_width = value;
		this.#canvas.width = value;
		if (this.#last_waveform) this.draw_waveform(this.#last_waveform);
	}
	get width() {
		return this.#_set_width ?? this.#canvas.width;
	}
	set height(value) {
		this.#_set_height = value;
		this.#canvas.height = value;
		if (this.#last_waveform) this.draw_waveform(this.#last_waveform);
	}
	get height() {
		return this.#_set_height ?? this.#canvas.height;
	}


	constructor() {
		super();
		// const shadowroot = this.attachShadow({ mode: "open" });
		const canvas = document.createElement("canvas");
		this.appendChild(canvas);
		this.#canvas = canvas;
		this.#ctx = notnull(canvas.getContext("2d"));
	}

	#_on_parent_resize() {
		if (!this.#_set_width) this.#canvas.width = this.parentElement?.clientWidth ?? 500;
		if (!this.#_set_height) this.#canvas.height = this.parentElement?.clientHeight ?? 500;
		if ((!this.#_set_width || !this.#_set_height) && this.#last_waveform) this.draw_waveform(this.#last_waveform);
	}

	connectedCallback() {
		if (this.parentElement) {
			this.#_resize_observer.observe(this.parentElement);
			this.#_on_parent_resize();
		} else {
			console.warn("parentElement is null, cannot observe resize");
		}
	}
	disconnectedCallback() {
		this.#_resize_observer.disconnect();
	}


	/**
	 *
	 * @param {Float32Array | null} pcm
	 */
	draw_waveform(pcm) {
		this.#last_waveform = pcm;

		// console.log(`drawing max: ${Math.max(...pcm)}, min: ${Math.min(...pcm)}`)

		const canvas = this.#canvas;
		const wf_ctx = this.#ctx;
		const { width, height } = canvas;

		wf_ctx.fillStyle = "black";
		wf_ctx.fillRect(0, 0, width, height);

		if (!pcm) return;

		const last_step = pcm.length / width;
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

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "width") this.width = parseInt(newValue);
		else if (name === "height") this.height = parseInt(newValue);
	}
}

customElements.define("np-waveform-canvas", NpWaveFormCanvas);
import { CAPTION_RATING_MODE } from "./appmode.mjs";
import { load_and_send_pcm } from "./load_send_pcm.mjs";
import { PARTICIPANT_ID_GLO } from "./participantid_analytics.mjs";
import { get_random_order, notnull } from "./util.mjs";

const captionrating_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector(".captionrating")));
const captionlist_div = /** @type {HTMLDivElement} */ (notnull(captionrating_div.querySelector(".captionlist")));
const submit_button = /** @type {HTMLButtonElement} */ (notnull(captionrating_div.querySelector("button.submit")));

/**
 * @param {string[]} captions_for_signal - Array of captions for the signal.
 * @returns {CaptionRatingElement[]} - Array of CaptionRatingElement instances.
 */
function render_captions(captions_for_signal) {
    while (captionlist_div.lastChild) captionlist_div.removeChild(captionlist_div.lastChild);
    const res = [];
    for (const caption of captions_for_signal) {
        const captionrating = CaptionRatingElement.createWithCaption(caption);
        captionlist_div.appendChild(captionrating);
        res.push(captionrating);
    }
    // submit_button.disabled = true;
    submit_button.disabled = false;
    return res;
}
// captionlist_div.addEventListener("change", ev => {
//     const all_rated = [...captionlist_div.children].every(el => !(el instanceof CaptionRatingElement) || el.get_rating() !== null);
//     submit_button.disabled = !all_rated;
// });

// div with caption text, rating slider 1-5 (no default, required to submit), the numeric value of the slider
class CaptionRatingElement extends HTMLDivElement {
    #_caption_str = "";
    /** @type {number | null} */
    #_rating_value = null;

    constructor() {
        super();
        this.classList.add("caption");
        this.innerHTML = `
            <div class="captiontext"></div>
            <div class="ratingslider">
                <input type="range" min="1" max="5" step="1" value="3" class="rating" list="tickmarks">
                <span class="ratingvalue">NR</span>
                <datalist id="tickmarks">
                    <option value="1" label="1"></option>
                    <option value="2" label="2"></option>
                    <option value="3" label="3"></option>
                    <option value="4" label="4"></option>
                    <option value="5" label="5"></option>
                </datalist>
            </div>
        `;
        this.captiontext_div = /** @type {HTMLDivElement} */ (this.querySelector(".captiontext"));
        this.rating_input = /** @type {HTMLInputElement} */ (this.querySelector(".rating"));
        this.ratingvalue_span = /** @type {HTMLSpanElement} */ (this.querySelector(".ratingvalue"));

        this.rating_input.addEventListener("input", this.#_on_input);
        this.rating_input.addEventListener("change", this.#_on_input);
        this.rating_input.addEventListener("click", this.#_on_input);
    }
    #_on_input = (ev) => {
        this.#_rating_value = parseInt(this.rating_input.value);
        this.ratingvalue_span.textContent = this.rating_input.value;
        this.dispatchEvent(new Event("change"));
    };

    set_caption(caption_str) {
        this.#_caption_str = caption_str;
        this.captiontext_div.textContent = caption_str;
    }


    get_rating() {
        return this.#_rating_value;
    }
    get_caption() {
        return this.#_caption_str;
    }


    static createWithCaption(caption_str) {
        const captionrating = new CaptionRatingElement();
        captionrating.set_caption(caption_str);
        return captionrating;
    }
}
customElements.define("caption-rating", CaptionRatingElement, { extends: "div" });

/**
 * @typedef {Object} ParsedCaption
 * @property {string} signal_id - The ID of the signal.
 * @property {string} category - The category of the signal.
 * @property {Array<{ text1: string, text2: string, distance: number }>} comparisons - Array of comparisons with distances.
 * @property {string[]} captions - Array of captions for the signal.
 */
/**
 * Parses the caption file text and returns an array of parsed caption objects.
 * @param {string} text - The text content of the caption file.
 * @returns {ParsedCaption[]} - An array of parsed caption objects.
 */
function parse_caption_file(text) {
    const blocks = text.split(/-{10,}/).filter(Boolean);
    const results = [];

    for (let i = 0; i < blocks.length; i += 2) {
        const header = blocks[i].trim();
        const content = blocks[i + 1] ? blocks[i + 1].trim() : "";

        const headerMatch = header.match(/signal id:(.*?), category:(.*)/);
        if (!headerMatch) continue;

        const signal_id = headerMatch[1].trim();
        const category = headerMatch[2].trim();

        const comparisons = [];
        const captions = [];

        const lines = content.split("\n").map(line => line.trim()).filter(Boolean);

        for (const line of lines) {
            if (line.match(/^\d+:/)) {
                const [, text] = line.split(":", 2);
                captions.push(text.trim());
            } else if (line.includes("<-->") && line.includes("Distance:")) {
                const match = line.match(/^(.*?) <--> (.*?) \| Distance: ([\d.]+)/);
                if (match) {
                    comparisons.push({
                        text1: match[1].trim(),
                        text2: match[2].trim(),
                        distance: parseFloat(match[3])
                    });
                }
            }
        }

        results.push({
            signal_id,
            category,
            comparisons,
            captions
        });
    }

    return results;
}

/**
 * @param {ParsedCaption[]} parsed - Array of parsed caption objects.
 * @returns {Map<string, string[]>} - A map where the key is the signal ID and the value is an array of captions.
 */
function get_all_captions_by_signal_id(parsed) {
    const captions_by_signal_id = new Map();
    for (const { signal_id, captions } of parsed) {
        if (!captions_by_signal_id.has(signal_id)) {
            captions_by_signal_id.set(signal_id, []);
        }
        captions_by_signal_id.get(signal_id).push(...captions);
    }
    return captions_by_signal_id;
}

async function caption_rating_main() {
    // create button to select root folder, wait for user to select folder
    // then ask for set number via prompt and load inference_caption_{SETNUM}.1.txt from the folder


    const load_caption_dir_button = document.createElement("button");
    load_caption_dir_button.textContent = "Load caption directory";
    captionlist_div.appendChild(load_caption_dir_button);

    /**
     * @typedef {Object} DirectoryResult
     * @property {FileSystemDirectoryHandle} dir_handle - The handle to the selected directory.
     * @property {string} setnum - The set number provided by the user.
     * @property {ParsedCaption[]} parsed - The parsed caption data.
     */
    /** @type {DirectoryResult} */
    const { dir_handle, setnum, parsed } = await new Promise(res => load_caption_dir_button.addEventListener("click", async (ev) => {
        if (!("showDirectoryPicker" in window)) {
            alert("Directory picker not supported in this browser");
            return;
        }
        const dir_handle = await window.showDirectoryPicker({ mode: "read" });

        const { setnum, filedata } = await (async () => {
            while (true) {
                const setnum = await prompt("set number");
                if (!setnum) continue;

                try {
                    const file = await dir_handle.getFileHandle(`inference_caption_${setnum}.1.txt`);
                    const filedata = await file.getFile();
                    return { setnum, filedata }
                } catch (e) {
                    alert(`File inference_caption_${setnum}.1.txt not found in directory ${dir_handle.name}. Please try again.`);
                    continue;
                }
            }
        })();
        const text = await filedata.text();
        const parsed = parse_caption_file(text);
        load_caption_dir_button.remove();
        res({ dir_handle, setnum, parsed });
    }));

    if (!PARTICIPANT_ID_GLO.is_participant_id_set()) {
        await PARTICIPANT_ID_GLO.force_prompt_participant_id();
    }
    PARTICIPANT_ID_GLO.lock_participant_id();

    const captions_by_signal_id = get_all_captions_by_signal_id(parsed);
    for (const [signal_id, captions] of get_random_order(captions_by_signal_id)) {
        // try to load the file signal_id.wav from the directory
        const captionrating_els = render_captions(get_random_order(captions));
        while (true) {
            try {
                const file_handle = await dir_handle.getFileHandle(`${signal_id}`);
                const file = await file_handle.getFile();
                await load_and_send_pcm(file);
                break;
            } catch (e) {
                alert(`File ${signal_id} not found in directory ${dir_handle.name}. Please create the file.`);
                continue;
            }
        }

        retry: while (true) {
            await new Promise(res => submit_button.addEventListener("click", res, { once: true }));
            const ratings_map = new Map();
            for (const captionrating of captionrating_els) {
                const rating = captionrating.get_rating();
                if (rating === null) {
                    alert("Please rate all captions before submitting");
                    continue retry;
                }
                const caption = captionrating.get_caption();
                ratings_map.set(caption, rating);
            }

            try {
                for (const [caption, rating] of ratings_map) {
                    // console.log(`Rating for caption "${caption}": ${rating}`);
                    await PARTICIPANT_ID_GLO.set_caption_rating(signal_id, caption, rating);
                }
            } catch (e) {
                console.error(e);
                alert("Error sending caption rating. Please retry: " + e);
                continue retry;
            }

            break;
        }
    }
}

if (CAPTION_RATING_MODE) {
    caption_rating_main().catch(err => {
        console.error(err);
        alert("Error in caption rating main: " + err);
        throw err;
    });
}
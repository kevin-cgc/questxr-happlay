import { VIDEO_RATING_MODE } from "./appmode.mjs";
import { load_and_send_pcm } from "./load_send_pcm.mjs";
import { draw_box, update_video } from "./video-playback.mjs";
import { get_random_order, notnull } from "./util.mjs";
import { idbkv } from "../script.mjs";

export const USE_FACTORS = false;

/** @type {{ video: string, algo: number }[]} */
export const SIGNAL_ORDER = [
];
const HXI_FACTORS = {
    "Autotelics": [
        "Regardless of function, I found the haptic sensations pleasant.",
        "Experiencing the haptic sensations was enjoyable to me.",
        "I enjoyed the haptic sensations themselves.",
        "The haptic sensations were enjoyable on their own, regardless of their function."
    ],
    "Involvement": [
        "I felt absorbed in the task due to the haptic sensations.",
        "I found the haptic sensations strengthened my engagement with the system.",
        "The haptic sensations contributed to my involvement in the task.",
        "The haptic interactions made me more focused."
    ],
    "Realism": [
        "The haptic sensations resembled the ones I feel in real life.",
        "The haptic sensations closely mimicked the experiences I would expect in reality.",
        "The haptic sensations felt familiar to real life touch.",
        "The haptic sensations provided a true-to-life representation of real-world sensations."
    ],
    "Discord": [
        "The haptic sensations seemed to lack coordination with other senses.",
        "I experienced a sense of mismatch between the haptic sensations and other senses.",
        "The haptic sensations felt out of sync with the other senses.",
        "I experienced a disconnect between the haptic sensations and what I expected.",
    ],
    "Harmony": [
        "I felt a sense of harmony between the haptic sensations and other senses.",
        "The haptic sensations integrated seamlessly with other senses.",
        "I feel the haptic sensations are well coordinated with the other senses.",
        "The haptic sensations complemented other senses well."
    ]
}
/** @type {string[]} */
export const FACTOR_STATEMENTS = [
    ...HXI_FACTORS.Autotelics,
    //...HXI_FACTORS.Involvement,
    ...HXI_FACTORS.Realism,
    ...HXI_FACTORS.Discord,
    //...HXI_FACTORS.Harmony
]
const RATING_STATEMENTS = ["Overall Quality", "Relevance to Video"];

const videorating_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector('.videorating')));
const ratinglist_div = /** @type {HTMLDivElement} */ (notnull(videorating_div.querySelector('.ratinglist')));
const submit_button = /** @type {HTMLButtonElement} */ (notnull(videorating_div.querySelector('button.submit')));

/**
 * Renders a list of statement rating elements.
 * @param {string[]} statements
 * @param {boolean} randomize
 * @returns {StatementRatingElement[]}
 */
function render_statements(statements, randomize = true, opts) {
    while (ratinglist_div.lastChild) ratinglist_div.removeChild(ratinglist_div.lastChild);
    const res = [];
    if (randomize) statements = get_random_order(statements);
    for (const stmt of statements) {
        const el = StatementRatingElement.createWithStatement(stmt, opts);
        ratinglist_div.appendChild(el);
        res.push(el);
    }
    submit_button.disabled = false;
    return res;
}

class StatementRatingElement extends HTMLDivElement {
    #statement = '';
    /** @type {number|null} */
    #rating_value = null;
    constructor() {
        super();
        this.classList.add('statement');
        this.innerHTML = `
            <div class="statementtext"></div>
            <div class="ratingslider">
                <input type="range" min="1" max="7" step="1" class="rating" list="likertmarks">
                <span class="ratingvalue">NR</span>
                <datalist id="likertmarks">
                    <option value="1" label="1"></option>
                    <option value="2" label="2"></option>
                    <option value="3" label="3"></option>
                    <option value="4" label="4"></option>
                    <option value="5" label="5"></option>
                    <option value="6" label="6"></option>
                    <option value="7" label="7"></option>
                </datalist>
            </div>`;
        this.statementtext_div = /** @type {HTMLDivElement} */ (this.querySelector('.statementtext'));
        this.rating_input = /** @type {HTMLInputElement} */ (this.querySelector('.rating'));
        this.ratingvalue_span = /** @type {HTMLSpanElement} */ (this.querySelector('.ratingvalue'));
        this.datalist_el = /** @type {HTMLDataListElement} */ (this.querySelector('datalist'));
        this.rating_input.addEventListener('input', this.#on_input);
        this.rating_input.addEventListener('change', this.#on_input);
        this.rating_input.addEventListener('click', this.#on_input);
    }
    #on_input = () => {
        this.#rating_value = parseInt(this.rating_input.value);
        this.ratingvalue_span.textContent = this.rating_input.value;
        this.rating_input.classList.add('filled');
    };
    set_statement(stmt) {
        this.#statement = stmt;
        this.statementtext_div.textContent = stmt;
    }
    get_rating() { return this.#rating_value; }
    get_statement() { return this.#statement; }
    /**
     * Factory method.
     * @param {string} stmt the statement text
     * @param {object} [opts]
     * @param {number} [opts.min=1]
     * @param {number} [opts.max=7]
     * @param {number} [opts.step=1]
     * @param {string[] | null} [opts.marks] labels for each tick
     */
    static createWithStatement(stmt, { min = 1, max = 7, step = 1, marks = null } = {}) {
        const el = new StatementRatingElement();
        el.set_statement(stmt);
        el.rating_input.min  = min.toString();
        el.rating_input.max  = max.toString();
        el.rating_input.step = step.toString();
        el.rating_input.value = Math.round((min + max) / 2).toString(); // default to middle value

        const listId = `likertmarks-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        el.datalist_el.id = listId;
        el.rating_input.setAttribute('list', listId);
        el.datalist_el.innerHTML = '';
        if (Array.isArray(marks) && marks.length > 0) {
            const count = marks.length;
            for (let i = 0; i < count; i++) {
                const opt = document.createElement('option');
                const val = min + i * ((max - min) / (count - 1));
                opt.value = val.toString();
                opt.label = marks[i];
                el.datalist_el.appendChild(opt);
            }
        } else {
            for (let v = min; v <= max; v += step) {
                const opt = document.createElement('option');
                opt.value = v.toString();
                opt.label = String(v);
                el.datalist_el.appendChild(opt);
            }
        }
        return el;
    }
}
customElements.define('statement-rating', StatementRatingElement, { extends: 'div' });

async function video_rating_main() {

    const videodir_button = document.createElement('button');
    videodir_button.textContent = 'Select Video Folder';
    videorating_div.insertBefore(videodir_button, ratinglist_div);

    const participantdir_button = document.createElement('button');
    participantdir_button.textContent = 'Select Participant Folder';
    videorating_div.insertBefore(participantdir_button, ratinglist_div);

    /**
     * Helper to prompt directory selection with retry on cancel or error
     * @param {HTMLButtonElement} btn - The button to attach click listener
     * @param {FileSystemPermissionMode} mode - 'read' or 'readwrite'
     * @returns {Promise<FileSystemDirectoryHandle>}
     */
    async function pickDirectory(btn, mode) {
        if (!('showDirectoryPicker' in window)) {
            alert('Directory picker not supported in this browser');
            throw new Error('DirectoryPickerNotSupported');
        }
        while (true) {
            // wait for user click
            await new Promise(resolve => btn.addEventListener('click', resolve, { once: true }));
            try {
                const handle = await window.showDirectoryPicker({ mode });
                return handle;
            } catch (err) {
                // user cancelled or error
                if (err.name === 'AbortError') {
                    alert('Directory selection cancelled. Please try again.');
                } else {
                    alert(`Error selecting directory: ${err.message}`);
                }
                // continue loop until valid directory picked
            }
        }
    }

    /** @type {FileSystemDirectoryHandle | null} */
    const prev_used_video_dir = await idbkv.get("video_rating_last_video_dir");
    let video_dir = null;
    if (prev_used_video_dir) {
        const perm_state = await prev_used_video_dir.queryPermission();
        if (perm_state == "prompt") {
            await prev_used_video_dir.requestPermission({ mode: "readwrite" })
        } else if (perm_state != "granted") {
            alert(`Previous video directory (${prev_used_video_dir.name}) permission state is '${perm_state}'. Please select a new directory.`);
        } else {
            video_dir = prev_used_video_dir;
        }
    }
    if (!video_dir) video_dir = await pickDirectory(videodir_button, 'read');
    await idbkv.set("video_rating_last_video_dir", video_dir);
    videodir_button.remove();

    const participant_dir = await pickDirectory(participantdir_button, 'readwrite');
    participantdir_button.remove();

    for (const { video, algo } of SIGNAL_ORDER) {
        const statements = USE_FACTORS ? FACTOR_STATEMENTS : RATING_STATEMENTS;
        const ratingEls = render_statements(statements, USE_FACTORS, USE_FACTORS ? {} : { min: 0, max: 100, step: 1, marks: ['0', '25', '50', '75', '100'] });
        const signal_file_prefix = `${video.split(".")[0]}__${algo}`;

        retryload: while (true) {
            const participant_files = [];
            for await (const entry of participant_dir.entries()) participant_files.push(entry);
            participant_files.sort(([an, ah], [bn, bh]) => an.localeCompare(bn));

            const matches = participant_files.filter(([name, handle]) => name.startsWith(signal_file_prefix));
            if (matches.length === 0) {
                alert(`No files found for signal '${signal_file_prefix}'. Please ensure the participant folder contains a signal file '${signal_file_prefix}*.wav`);
                continue retryload;
            }
            if (matches.length > 1) {
                alert(`Multiple files found for signal '${signal_file_prefix}': ${matches.map(([name]) => name).join(', ')}. Please ensure only one file matches.`);
                continue retryload;
            }

            const file_handle = matches[0][1];
            // 1) Regex with named groups:
            //    (?<video_name>.*?)   → non-greedy everything up to “__”
            //    __                    → literal “__”
            //    (?<algo_int>\d+)      → digits for the algorithm index
            //    _                     → underscore
            //    (?<extract_radius_str>\d+)r_ → digits + “r_” for radius
            //    (?<extract_point_x>\d+)x → x-coordinate
            //    (?<extract_point_y>\d+)y_ → y-coordinate + “y_”
            //    (?<timestamp>\d+(?:\.\d+)?) → integer or float timestamp
            //    \.wav$                → “.wav” at end of string
            const FILENAME_REGEX = /^(?<video_name>.*?)__(?<algo_int_str>\d+)_(?<extract_radius_str>\d+)r_(?<extract_point_x_str>\d+)x(?<extract_point_y_str>\d+)y_(?<timestamp_str>\d+(?:\.\d+)?)\.wav$/;
            const match = file_handle.name.match(FILENAME_REGEX);
            if (!match) throw new Error(`Filename didn’t match pattern: ${file_handle}`);
            // @ts-ignore
            const { video_name, algo_int_str, extract_radius_str, extract_point_x_str, extract_point_y_str, timestamp_str } = match.groups;
            const [algo_int, extract_radius, extract_point_x, extract_point_y, timestamp] = [algo_int_str, extract_radius_str, extract_point_x_str, extract_point_y_str, timestamp_str].map(v => Number.parseFloat(v));

            if (!(file_handle instanceof FileSystemFileHandle)) {
                alert(`Expected a file handle for signal '${signal_file_prefix}', but got a directory or other type.`);
                continue retryload;
            }

            try {
                const file = await file_handle.getFile();
                await load_and_send_pcm(file);

                const video_handle = await video_dir.getFileHandle(video);
                const video_file = await video_handle.getFile();
        await update_video(video_file);
                await draw_box(extract_point_x, extract_point_y, extract_radius);
            } catch (e) {
                console.error(e);
                alert(`Error loading signal '${signal_file_prefix}': ${e.message}`);
                continue retryload;
            }

            break retryload;
        }

        // Collect ratings with retry on incomplete
        const ratings = {};
        retry: while (true) {
            await new Promise(resolve => submit_button.addEventListener('click', resolve, { once: true }));
            for (const el of ratingEls) {
                const val = el.get_rating();
                if (val == null) {
                    alert('Please rate all statements');
                    continue retry;
                }
                ratings[el.get_statement()] = val;
            }

            break retry;
        }

        retrysave: while (true) {
            const json_filename = `${signal_file_prefix}.json`;
            const existing = await participant_dir.getFileHandle(json_filename, { create: false }).catch(() => null);
            if (existing) {
                alert(`File '${json_filename}' already exists. Please delete or rename it.`);
                continue retrysave;
            }
            try {
                const fh = await participant_dir.getFileHandle(json_filename, { create: true });
            const w = await fh.createWritable();
            await w.write(JSON.stringify(ratings, null, 2));
            await w.close();
            } catch (e) {
                console.error(e);
                alert(`Error saving ratings for '${signal_file_prefix}': ${e.message}`);
                continue retrysave;
            }

            break retrysave;
        }
    }
}

if (VIDEO_RATING_MODE) {
    video_rating_main().catch(e => { console.error(e); alert('Error: ' + e); });
}

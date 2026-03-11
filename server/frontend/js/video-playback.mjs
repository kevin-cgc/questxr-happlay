import { notnull } from "./util.mjs";

/** @type {HTMLVideoElement} */
const video = notnull(document.querySelector("video#pbmvideo"));
/** @type {HTMLCanvasElement} */
const overlay = notnull(document.querySelector("canvas.video-overlay"));
const ctx = notnull(overlay.getContext("2d"));

/**
 * @param {File} video_file
 */
export async function update_video(video_file) {
    console.log("Updating video", video_file);
    const video_url = URL.createObjectURL(video_file);
    video.src = video_url;
}

export async function start_video_playback() {
    video.currentTime = 0;
    video.play();
}
export async function stop_video_playback() {
    video.pause();
    video.currentTime = 0;
}


let last_box = null;
export function draw_box(x, y, radius) {
    // update our one‐and‐only box
    last_box = { x, y, radius };
    const r = radius;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
}
video.addEventListener("loadedmetadata", () => {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    overlay.style.width = video.clientWidth + "px";
    overlay.style.height = video.clientHeight + "px";

    if (last_box) {
        const { x, y, radius } = last_box;
        draw_box(x, y, radius);
    }
});

import { notnull } from "./util.mjs";

/** @type {HTMLVideoElement} */
const video = notnull(document.querySelector("video#pbmvideo"));

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
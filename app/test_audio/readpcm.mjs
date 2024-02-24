import fs from 'fs/promises';

const ifile = await fs.readFile("./dog_barking_haptic.pcm_f32le");
const audio = new Float32Array(ifile.buffer);
console.log(audio.length);
const ofile = await fs.open("./dog_barking_haptic.pcm_f32le.hpp", "w");
await ofile.write(`#pragma once
constexpr uint32_t dog_barking_haptic_pcm_f32le_sample_len = ${audio.length};
constexpr float dog_barking_haptic_pcm_f32le[] = {
	${audio.join(",")}
};
`);
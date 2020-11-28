import Log from "../utils/logger";
import { MPEG4AudioObjectTypes, MPEG4SamplingFrequencies, MPEG4SamplingFrequencyIndex } from "./mpeg4-audio";

export class AACFrame {
    audio_object_type: MPEG4AudioObjectTypes;
    sampling_freq_index: MPEG4SamplingFrequencyIndex;
    sampling_frequency: number;
    channel_config: number;

    data: Uint8Array;
}

export clas
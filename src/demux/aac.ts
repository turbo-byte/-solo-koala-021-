import Log from "../utils/logger";
import { MPEG4AudioObjectTypes, MPEG4SamplingFrequencies, MPEG4SamplingFrequencyIndex } from "./mpeg4-audio";

export class AACFrame {
    audio_object_type: MPEG4AudioObjectTypes;
    sampling_freq_index: MPEG4SamplingFrequencyIndex;
    sampling_frequency: number;
    channel_config: number;

    data: Uint8Array;
}

export class AACADTSParser {

    private readonly TAG: string = "AACADTSParser";

    private data_: Uint8Array;
    private current_syncword_offset_: number;
    private eof_flag_: boolean;
    private has_last_incomplete_data: boolean;

    public constructor(data: Uint8Array) {
        this.data_ = data;
        this.current_syncword_offset_ = this.findNextSyncwordOffset(0);
        if (this.eof_flag_) {
            Log.e(this.TAG, `Could not found ADTS syncword until payload end`);
        }
    }

    private findNextSyncwordOffset(syncword_offset: number): number {
        let i = syncword_offset;
        let data = this.data_;

        while (true) {
            if (i + 7 >= data.byteLength) {
                this.eof_flag_ = true;
                return data.byteLength;
            }

            // search 12-bit 0xFFF syncword
            let syncword = ((data[i + 0] << 8) | data[i + 1]) >>> 4;
            if (syncword === 0xFFF) {
                return i;
            } else {
                i++;
            }
        }
    }

    public readNextAACFrame(): AACFrame | null {
        let data = this.data_;
        let aac_frame: AACFrame = null;

        while (aac_frame == null) {
            if (this.eof_flag_) {
                break;
            }

            let syncword_offset = this.current_syncword_
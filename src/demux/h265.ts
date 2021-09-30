import Log from "../utils/logger";

export enum H265NaluType {
    kSliceIDR_W_RADL = 19,
    kSliceIDR_N_LP = 20,
    kSliceCRA_NUT = 21,
    kSliceVPS = 32,
    kSliceSPS = 33,
    kSlicePPS = 34,
    kSliceAUD = 35,
}

export class H265NaluPayload {
    type: H265NaluType;
    data: Uint8Array;
}

export class H265NaluHVC1 {
    type: H265NaluType;
    data: Uint8Array;

    constructor(nalu: H265NaluPayload) {
        let nalu_size = nalu.data.byteLength;

        this.type = nalu.type;
        this.data = new Uint8Array(4 + nalu_size);  // 4 byte length-header + nalu payload

        let v = new DataView(this.data.buffer);
        // Fill 4 byte length-header
        v.setUint32(0, nalu_size);
        // Copy payload
        this.data.set(nalu.data, 4);
    }
}

export class H265AnnexBParser {

    private readonly TAG: string = "H265AnnexBParser";

    private data_: Uint8Array;
    private current_startcode_offset_: number = 0;
    private eof_flag_: boolean = false;

    public constructor(data: Uint8Array) {
        this.data_ = data;
        this.current_startcode_offset_ = this.findNextStartCodeOffset(0);
        if (this.eof_flag_) {
            Log.e(this.TAG, "Could not find H265 startcode until payload end!");
        }
    }

    private findNextStartCodeOffset(start_offset: number) {
        let i = start_offset;
        let data = this.data_;

        while (true) {
            if (i + 3 >= data.byteLength) {
                this.eof_flag_ = true;
                return data.byteLength;
            }

            // search 00 00 00 01 or 00 00 01
            let uint32 = (data[i + 0] << 24)
                        | (data[i + 1] << 16)
                        | (data[i + 2] << 8)
                        | (data[i + 3]);
            let uint24 = (data[i + 0] << 16)
                        | (data[i + 1] << 8)
                        | (data[i + 2]);
            if (uint32 === 0x00000001 || uint24 === 0x000001) {
                return i;
            } else {
                i++;
            }
        }
    }

    public readNextNaluPayload(): H265NaluPayload | null {
        let data = this.data_;
        let nalu_payload: H265NaluPayload = null;

        while (nalu_payload == null) {
            if (this.eof_flag_) {
                break;
            }
            // offset pointed to start code
            let startcode_offset = this.current_startcode_offset_;

            // nalu payload start offset
            let offset = startcode_offset;
            let u32 = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | (data[offset + 3]);
            if (u32 === 0x00000001) {
                offset += 4;
            } else {
                offset += 3;
            }

            let nalu_type: H265NaluType = (data[offset] >> 1) & 0x3F;
            let forbidden_bit = (data[offset] & 0x80) >>> 7;

            let next_startcode_offset = this.findNextStartCodeOffset(offset);
            this.current_startcode_offset_ = next_startcode_offset;

            if (forbidden_bit !== 0) {
                // Log.e(this.TAG, `forbidden_bit near offset ${offset} should be 0 but has value ${forbidden_bit}`);
                continue;
            }

            let payload_data = data.subarray(offset, next_startcode_offset);

            nalu_payload = new H265NaluPayload();
            nalu_payload.type = nalu_type;
            nalu_payload.data = payload_data;
        }

        return nalu_payload;
    }

}

export type HEVCDecoderConfigurationRecordType = {
    configurationVersion: 1;
} & VPSHEVCDecoderConfigurationRecordType & SPSHEVCDecoderConfigurationRecordType & PPSHEVCDecoderConfigurationRecordType;

export type VPSHEVCDecoderConfigurationRecordType = {
    num_temporal_layers: number;
    temporal_id_nested: boolean;
}

export type SPSHEVCDecoderConfigurationRecordType = {
    general_profile_space: number;
    general_tier_flag: number;
    general_profile_idc: number;
    general_profile_compatibility_flags_1: number;
    general_profile_compatibility_flags_2: number;
    general_profile_compatibility_flags_3: number;
    general_profile_compatibility_flags_4: number;
    general_constraint_indicator_flags_1: number;
    general_constraint_indicator_flags_2: number;
    general_constraint_indicator_flags_3: number;
    general_constraint_indicator_flags_4: number;
    general_constraint_indicator_flags_5: number;
    general_constraint_indicator_flags_6: number;
    constant_frame_rate: number;
 
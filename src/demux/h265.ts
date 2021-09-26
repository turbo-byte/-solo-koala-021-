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
            let uint32 = (data[i + 0] << 
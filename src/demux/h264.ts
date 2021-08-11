
import Log from "../utils/logger";

export enum H264NaluType {
    kUnspecified = 0,
    kSliceNonIDR,
    kSliceDPA,
    kSliceDPB,
    kSliceDPC,
    kSliceIDR,
    kSliceSEI,
    kSliceSPS,
    kSlicePPS,
    kSliceAUD,
    kEndOfSequence,
    kEndOfStream,
    kFiller,
    kSPSExt,
    kReserved0
}

export class H264NaluPayload {
    type: H264NaluType;
    data: Uint8Array;
}

export class H264NaluAVC1 {
    type: H264NaluType;
    data: Uint8Array;

    constructor(nalu: H264NaluPayload) {
        let nalu_size = nalu.data.byteLength;

        this.type = nalu.type;
        this.data = new Uint8Array(4 + nalu_size);  // 4 byte length-header + nalu payload

        let v = new DataView(this.data.buffer);
        // Fill 4 byte length-header
        v.setUint32(0, nalu_size);
        // Copy payload
        this.data.set(nalu.data, 4);
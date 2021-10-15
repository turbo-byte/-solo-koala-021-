import ExpGolomb from "./exp-golomb";

export class SMPTE2038Data {
    pid: number;
    stream_id: number;
    pts?: number;
    dts?: number;
    nearest_pts?: number;
    ancillaries: AncillaryData[];
    data: Uint8Array;
    len: number;
}

type AncillaryData = {
    yc_indicator: boolean;
    line_number: number;
    horizontal_offset: number;
    did: number;
    sdid: number;
    user_data: Uint8Array;
    description: string;
    information: any;
}


export const smpte2038parse = (data: Uint8Array) => {
    let gb = new ExpGolomb(data);
    let readBits = 0;

    let ancillaries: AncillaryData[] = [];
    while (true) {
        let zero = gb.readBits(6); readBits += 6;
        if (zero !== 0) { break; }
  
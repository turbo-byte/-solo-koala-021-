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
        let YC_indicator = gb.readBool(); readBits += 1;
        let line_number = gb.readBits(11); readBits += 11;
        let horizontal_offset = gb.readBits(12); readBits += 12;
        let data_ID = gb.readBits(10) & 0xFF; readBits += 10;
        let data_SDID = gb.readBits(10) & 0xFF; readBits += 10;
        let data_count = gb.readBits(10) & 0xFF; readBits += 10;
        let user_data = new Uint8Array(data_count);
        for (let i = 0; i < data_count; i++) {
            let user_data_word = gb.readBits(10) & 0xFF; readBits += 10;
            use
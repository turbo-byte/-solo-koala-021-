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
    horizontal_offset: n
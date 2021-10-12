import ExpGolomb from "./exp-golomb";

export class SMPTE2038Data {
    pid: number;
    stream_id: number;
    pts?: number;
    dts?: number;
    nearest_pt
export declare enum H265NaluType {
    kSliceIDR_W_RADL = 19,
    kSliceIDR_N_LP = 20,
    kSliceCRA_NUT = 21,
    kSliceVPS = 32,
    kSliceSPS = 33,
    kSlicePPS = 34,
    kSliceAUD = 35
}
export declare class H265NaluPayload {
    type: H265NaluType;
    data: Uint8Array;
}
export declare class H265NaluHVC1 {
    type: H265NaluType;
    data: Uint8Array;
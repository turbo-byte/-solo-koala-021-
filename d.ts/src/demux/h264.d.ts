export declare enum H264NaluType {
    kUnspecified = 0,
    kSliceNonIDR = 1,
    kSliceDPA = 2,
    kSliceDPB = 3,
    kSliceDPC = 4,
    kSliceIDR = 5,
    kSliceSEI = 6,
    kSliceSPS = 7,
    kSlicePPS = 8,
    kSliceAUD = 9,
    kEndOfSequence = 10,
    kEndOfStream = 11,
    kFiller = 12,
    kSPSExt = 13,
    kReserved0 = 14
}
export declare class H264NaluPayload {
    type: H264NaluType;
    data: Uint8Array;
}
export declare class H264
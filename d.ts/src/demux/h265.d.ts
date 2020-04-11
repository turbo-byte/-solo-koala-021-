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
    constructor(nalu: H265NaluPayload);
}
export declare class H265AnnexBParser {
    private readonly TAG;
    private data_;
    private current_startcode_offset_;
    private eof_flag_;
    constructor(data: Uint8Array);
    private findNextStartCodeOffset;
    readNextNaluPayload(): H265NaluPayload | null;
}
export declare type HEVCDecoderConfigurationRecordType = {
    configurationVersion: 1;
} & VPSHEVCDecoderConfigurationRecordType & SPSHEVCDecoderConfigurationRecordType & PPSHEVCDecoderConfigurationRecordType;
export declare type VPSHEVCDecoderConfigurationRecordType = {
    num_temporal_layers: number;
    temporal_id_nested: boolean;
};
export declare type SPSHEVCDecoderConfigurationRecordType = {
    general_profile_space: number;
    general_tier_flag: number;
    general_profile_idc: number;
    general_profile_compatibility_flags_1: number;
    general_profile_compatibility_flags_2: number;
    general_profile_compatibility_flags_3: number;
    general_profile_compatibility_flags_4: number;
    general_constraint_indicator_flags_1: number;
    general_constraint_indicator_flags_2: number;
    general_constraint_indicator_flag
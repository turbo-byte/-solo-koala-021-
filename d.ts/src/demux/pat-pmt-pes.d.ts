interface ProgramToPMTPIDMap {
    [program: number]: number;
}
export declare class PAT {
    version_number: number;
    network_pid: number;
    program_pmt_pid: ProgramToPMTPIDMap;
}
export declare enum StreamType {
    kMPEG1Audio = 3,
    kMPEG2Audio = 4,
    kPESPrivateData = 6,
    kADTSAAC = 15,
    kID3 = 21,
    kSCTE35 = 134,
    kH264 = 27,
    kH265 = 36
}
interface PIDToStreamTypeMap {
    [pid: number]: StreamType;
}
export declare class PMT {
    program_number: number;
    version_number: number;
    pcr_pid: number;
    pid_stream_type: PIDToStreamTypeMap;
    common_pids: {
        h264: number | undefined;
        h265: number | undefined;
        adts_aac: number | undefined;
        mp3: number | undefined;
    };
    pes_private_data_pids: {
        [pid: number]: boolean;
    };
    timed_id3_pids: {
        [pid: number]: boolean;
    };
    scte_35_pids: {
        [pid: number]: boolean;
    };
    smpte2038_pids: {
        [oid: number]: boolean;
    };

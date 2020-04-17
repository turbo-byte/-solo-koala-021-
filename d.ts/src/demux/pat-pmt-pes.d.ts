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
    [pid: number]
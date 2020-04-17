interface ProgramToPMTPIDMap {
    [program: number]: number;
}
export declare class PAT {
    version_number: number;
    network_pid: number;
    program_pmt_pid: ProgramToPMTPIDMap;
}
export declare enum StreamT
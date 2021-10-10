
import ExpGolomb from './exp-golomb.js';

export type SCTE35Data = {
    splice_command_type: SCTE35CommandType.kSpliceInsert
    pts?: number,
    nearest_pts?: number
    auto_return?: boolean
    duraiton?: number,
    detail: SCTE35Detail
    data: Uint8Array
} | {
    splice_command_type: SCTE35CommandType.kTimeSignal
    pts?: number,
    nearest_pts?: number
    detail: SCTE35Detail
    data: Uint8Array
} | {
    splice_command_type: SCTE35CommandType.kSpliceNull | SCTE35CommandType.kBandwidthReservation | SCTE35CommandType.kSpliceSchedule | SCTE35CommandType.kPrivateCommand
    pts: undefined,
    nearest_pts?: number
    detail: SCTE35Detail
    data: Uint8Array
}

type SCTE35Detail = {
    table_id: number
    section_syntax_indicator: boolean
    private_indicator: boolean
    section_length: number
    protocol_version: number
    encrypted_packet: boolean
    encryption_algorithm: number
    pts_adjustment: number
    cw_index: number
    tier: number
    splice_command_length: number
    splice_command_type: SCTE35CommandType.kSpliceNull
    splice_command: SpliceNull
    descriptor_loop_length: number
    splice_descriptors: SpliceDescriptor[]
    E_CRC32?: number
    CRC32: number
} | {
    table_id: number
    section_syntax_indicator: boolean
    private_indicator: boolean
    section_length: number
    protocol_version: number
    encrypted_packet: boolean
    encryption_algorithm: number
    pts_adjustment: number
    cw_index: number
    tier: number
    splice_command_length: number
    splice_command_type: SCTE35CommandType.kSpliceSchedule
    splice_command: SpliceSchedule
    descriptor_loop_length: number
    splice_descriptors: SpliceDescriptor[]
    E_CRC32?: number
    CRC32: number
} | {
    table_id: number
    section_syntax_indicator: boolean
    private_indicator: boolean
    section_length: number
    protocol_version: number
    encrypted_packet: boolean
    encryption_algorithm: number
    pts_adjustment: number
    cw_index: number
    tier: number
    splice_command_length: number
    splice_command_type: SCTE35CommandType.kSpliceInsert
    splice_command: SpliceInsert
    descriptor_loop_length: number
    splice_descriptors: SpliceDescriptor[]
    E_CRC32?: number
    CRC32: number
} | {
    table_id: number
    section_syntax_indicator: boolean
    private_indicator: boolean
    section_length: number
    protocol_version: number
    encrypted_packet: boolean
    encryption_algorithm: number
    pts_adjustment: number
    cw_index: number
    tier: number
    splice_command_length: number
    splice_command_type: SCTE35CommandType.kTimeSignal
    splice_command: TimeSignal
    descriptor_loop_length: number
    splice_descriptors: SpliceDescriptor[]
    E_CRC32?: number
    CRC32: number
} | {
    table_id: number
    section_syntax_indicator: boolean
    private_indicator: boolean
    section_length: number
    protocol_version: number
    encrypted_packet: boolean
    encryption_algorithm: number
    pts_adjustment: number
    cw_index: number
    tier: number
    splice_command_length: number
    splice_command_type: SCTE35CommandType.kBandwidthReservation
    splice_command: BandwidthReservation
    descriptor_loop_length: number
    splice_descriptors: SpliceDescriptor[]
    E_CRC32?: number
    CRC32: number
} | {
    table_id: number
    section_syntax_indicator: boolean
    private_indicator: boolean
    section_length: number
    protocol_version: number
    encrypted_packet: boolean
    encryption_algorithm: number
    pts_adjustment: number
    cw_index: number
    tier: number
    splice_command_length: number
    splice_command_type: SCTE35CommandType.kPrivateCommand
    splice_command: PrivateCommand
    descriptor_loop_length: number
    splice_descriptors: SpliceDescriptor[],
    E_CRC32?: number
    CRC32: number
};

export enum SCTE35CommandType {
    kSpliceNull = 0x0,
    kSpliceSchedule = 0x4,
    kSpliceInsert = 0x5,
    kTimeSignal = 0x6,
    kBandwidthReservation = 0x07,
    kPrivateCommand = 0xff
}
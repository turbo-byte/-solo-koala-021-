
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

type SpliceTime = {
    time_specified_flag: boolean,
    pts_time?: number
}

const parseSpliceTime = (reader: ExpGolomb): SpliceTime => {
    const time_specified_flag = reader.readBool()

    if (!time_specified_flag) {
        reader.readBits(7);
        return { time_specified_flag }
    } else {
        reader.readBits(6)
        const pts_time = reader.readBits(31) * 4 + reader.readBits(2);
        return {
            time_specified_flag,
            pts_time
        }
    }
}

type BreakDuration = {
    auto_return: boolean,
    duration: number
}
const parseBreakDuration = (reader: ExpGolomb): BreakDuration => {
    const auto_return = reader.readBool();
    reader.readBits(6);
    const duration = reader.readBits(31) * 4 + reader.readBits(2);
    return {
        auto_return,
        duration
    };
}

type SpliceInsertComponent = {
    component_tag: number,
    splice_time?: SpliceTime
}
const parseSpliceInsertComponent = (splice_immediate_flag: boolean, reader: ExpGolomb): SpliceInsertComponent => {
    const component_tag = reader.readBits(8);
    if (splice_immediate_flag) {
        return { component_tag };
    }

    const splice_time = parseSpliceTime(reader);
    return {
        component_tag,
        splice_time
    };
}
type SpliceScheduleEventComponent = {
    component_tag: number,
    utc_splice_time: number
}
const parseSpliceScheduleEventComponent = (reader: ExpGolomb): SpliceScheduleEventComponent => {
    const component_tag = reader.readBits(8);
    const utc_splice_time = reader.readBits(32);
    return {
        component_tag,
        utc_splice_time
    };
}

type SpliceScheduleEvent = {
    splice_event_id: number,
    splice_event_cancel_indicator: boolean,
    out_of_network_indicator?: boolean,
    program_splice_flag?: boolean,
    duration_flag?: boolean,
    utc_splice_time?: number,
    component_count?: number,
    components?: SpliceScheduleEventComponent[]
    break_duration?: BreakDuration,
    unique_program_id?: number
    avail_num?: number,
    avails_expected?: number
}
const parseSpliceScheduleEvent = (reader: ExpGolomb): SpliceScheduleEvent => {
    const splice_event_id = reader.readBits(32);
    const splice_event_cancel_indicator = reader.readBool();
    reader.readBits(7);

    const spliceScheduleEvent: SpliceScheduleEvent = {
        splice_event_id,
        splice_event_cancel_indicator
    }

    if (splice_event_cancel_indicator) {
        return spliceScheduleEvent;
    }

    spliceScheduleEvent.out_of_network_indicator = reader.readBool()
    spliceScheduleEvent.program_splice_flag = reader.readBool()
    spliceScheduleEvent.duration_flag = reader.readBool()
    reader.readBits(5)

    if (spliceScheduleEvent.program_splice_flag) {
        spliceScheduleEvent.utc_splice_time = reader.readBits(32);
    } else {
        spliceScheduleEvent.component_count = reader.readBits(8);
        spliceScheduleEvent.components = [];
        for (let i = 0; i < spliceScheduleEvent.component_count; i++) {
            spliceScheduleEvent.components.push(parseSpliceScheduleEventComponent(reader));
        }
    }

    if (spliceScheduleEvent.duration_flag) {
        spliceScheduleEvent.break_duration = parseBreakDuration(reader);
    }

    spliceScheduleEvent.unique_program_id = reader.readBits(16);
    spliceScheduleEvent.avail_num = reader.readBits(8);
    spliceScheduleEvent.avails_expected = reader.readBits(8);

    return spliceScheduleEvent;
}

type SpliceNull = {}
type SpliceSchedule = {
    splice_count: number,
    events: SpliceScheduleEvent[],
}
type SpliceInsert = {
    splice_event_id: number,
    splice_event_cancel_indicator: boolean,
    out_of_network_indicator?: boolean,
    program_splice_flag?: boolean,
    duration_flag?: boolean,
    splice_immediate_flag?: boolean,
    splice_time?: SpliceTime,
    component_count?: number,
    components?: SpliceInsertComponent[],
    break_duration?: BreakDuration,
    unique_program_id?: number,
    avail_num?: number,
    avails_expected?: number
}
type TimeSignal = {
    splice_time: SpliceTime
}
type BandwidthReservation = {}
type PrivateCommand = {
    identifier: string,
    private_data: ArrayBuffer
}

type SpliceCommand = SpliceNull | SpliceSchedule | SpliceInsert | TimeSignal | BandwidthReservation | PrivateCommand

const parseSpliceNull = (): SpliceNull => {
    return {};
};
const parseSpliceSchedule = (reader: ExpGolomb): SpliceSchedule => {
    const splice_count = reader.readBits(8)
    const events: SpliceScheduleEvent[] = [];
    for (let i = 0; i < splice_count; i++) {
        events.push(parseSpliceScheduleEvent(reader));
    }
    return {
        splice_count,
        events
    };
}
const parseSpliceInsert = (reader: ExpGolomb): SpliceInsert => {
    const splice_event_id = reader.readBits(32);
    const splice_event_cancel_indicator = reader.readBool();
    reader.readBits(7);

    const spliceInsert: SpliceInsert = {
        splice_event_id,
        splice_event_cancel_indicator
    }

    if (splice_event_cancel_indicator) {
        return spliceInsert;
    }

    spliceInsert.out_of_network_indicator = reader.readBool()
    spliceInsert.program_splice_flag = reader.readBool()
    spliceInsert.duration_flag = reader.readBool()
    spliceInsert.splice_immediate_flag = reader.readBool()
    reader.readBits(4)

    if (spliceInsert.program_splice_flag && !spliceInsert.splice_immediate_flag) {
        spliceInsert.splice_time = parseSpliceTime(reader);
    }
    if (!spliceInsert.program_splice_flag) {
        spliceInsert.component_count = reader.readBits(8)
        spliceInsert.components = [];
        for (let i = 0; i < spliceInsert.component_count; i++) {
            spliceInsert.components.push(parseSpliceInsertComponent(spliceInsert.splice_immediate_flag, reader));
        }
    }

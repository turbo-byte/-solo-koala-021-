
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

    if (spliceInsert.duration_flag) {
        spliceInsert.break_duration = parseBreakDuration(reader);
    }

    spliceInsert.unique_program_id = reader.readBits(16);
    spliceInsert.avail_num = reader.readBits(8);
    spliceInsert.avails_expected = reader.readBits(8);

    return spliceInsert;
}
const parseTimeSignal = (reader: ExpGolomb): TimeSignal => {
    return {
        splice_time: parseSpliceTime(reader)
    };
}
const parseBandwidthReservation = (): BandwidthReservation => {
    return {};
}
const parsePrivateCommand = (splice_command_length: number, reader: ExpGolomb): PrivateCommand => {
    const identifier = String.fromCharCode(reader.readBits(8), reader.readBits(8), reader.readBits(8), reader.readBits(8))
    const data = new Uint8Array(splice_command_length - 4);
    for (let i = 0; i < splice_command_length - 4; i++) {
        data[i] = reader.readBits(8);
    }

    return {
        identifier,
        private_data: data.buffer
    }
}

type Descriptor = {
    descriptor_tag: number,
    descriptor_length: number,
    identifier: string
}
type AvailDescriptor = Descriptor & {
    provider_avail_id: number
}
const parseAvailDescriptor = (descriptor_tag: number, descriptor_length: number, identifier: string, reader: ExpGolomb): AvailDescriptor => {
    const provider_avail_id = reader.readBits(32);

    return {
        descriptor_tag,
        descriptor_length,
        identifier,
        provider_avail_id
    }
}
type DTMFDescriptor = Descriptor & {
    preroll: number,
    dtmf_count: number,
    DTMF_char: string
}
const parseDTMFDescriptor = (descriptor_tag: number, descriptor_length: number, identifier: string, reader: ExpGolomb): DTMFDescriptor => {
    const preroll = reader.readBits(8);
    const dtmf_count = reader.readBits(3);
    reader.readBits(5);
    let DTMF_char = '';
    for (let i = 0; i < dtmf_count; i++) {
        DTMF_char += String.fromCharCode(reader.readBits(8));
    }

    return {
        descriptor_tag,
        descriptor_length,
        identifier,
        preroll,
        dtmf_count,
        DTMF_char
    };
}
type SegmentationDescriptorComponent = {
    component_tag: number,
    pts_offset: number
}
const parseSegmentationDescriptorComponent = (reader: ExpGolomb): SegmentationDescriptorComponent => {
    const component_tag = reader.readBits(8);
    reader.readBits(7)
    const pts_offset = reader.readBits(31) * 4 + reader.readBits(2);
    return {
        component_tag,
        pts_offset
    };
}
type SegmentationDescriptor = Descriptor & {
    segmentation_event_id: number,
    segmentation_event_cancel_indicator: boolean,
    program_segmentation_flag?: boolean,
    segmentation_duration_flag?: boolean
    delivery_not_restricted_flag?: boolean
    web_delivery_allowed_flag?: boolean
    no_regional_blackout_flag?: boolean,
    archive_allowed_flag?: boolean,
    device_restrictions?: number
    component_count?: number,
    components?: any[]
    segmentation_duration?: number
    segmentation_upid_type?: number,
    segmentation_upid_length?: number,
    segmentation_upid?: ArrayBuffer,
    segmentation_type_id?: number,
    segment_num?: number,
    segments_expected?: number,
    sub_segment_num?: number,
    sub_segments_expected?: number
}
const parseSegmentationDescriptor = (descriptor_tag: number, descriptor_length: number, identifier: string, reader: ExpGolomb): SegmentationDescriptor => {
    const segmentation_event_id = reader.readBits(32);
    const segmentation_event_cancel_indicator = reader.readBool();
    reader.readBits(7);

    const segmentationDescriptor: SegmentationDescriptor = {
        descriptor_tag,
        descriptor_length,
        identifier,
        segmentation_event_id,
        segmentation_event_cancel_indicator
    }

    if (segmentation_event_cancel_indicator) {
        return segmentationDescriptor;
    }

    segmentationDescriptor.program_segmentation_flag = reader.readBool();
    segmentationDescriptor.segmentation_duration_flag = reader.readBool();
    segmentationDescriptor.delivery_not_restricted_flag = reader.readBool();

    if (!segmentationDescriptor.delivery_not_restricted_flag) {
        segmentationDescriptor.web_delivery_allowed_flag = reader.readBool();
        segmentationDescriptor.no_regional_blackout_flag = reader.readBool();
        segmentationDescriptor.archive_allowed_flag = reader.readBool();
        segmentationDescriptor.device_restrictions = reader.readBits(2);
    } else {
        reader.readBits(5);
    }

    if (!segmentationDescriptor.program_segmentation_flag) {
        segmentationDescriptor.component_count = reader.readBits(8);
        segmentationDescriptor.components = [];
        for (let i = 0; i < segmentationDescriptor.component_count; i++) {
            segmentationDescriptor.components.push(parseSegmentationDescriptorComponent(reader));
        }
    }

    if (segmentationDescriptor.segmentation_duration_flag) {
        segmentationDescriptor.segmentation_duration = reader.readBits(40);
    }

    segmentationDescriptor.segmentation_upid_type = reader.readBits(8);
    segmentationDescriptor.segmentation_upid_length = reader.readBits(8);
    {
        const upid = new Uint8Array(segmentationDescriptor.segmentation_upid_length)
        for (let i = 0; i < segmentationDescriptor.segmentation_upid_length; i++) {
            upid[i] = reader.readBits(8);
        }
        segmentationDescriptor.segmentation_upid = upid.buffer;
    }
    segmentationDescriptor.segmentation_type_id = reader.readBits(8);
    segmentationDescriptor.segment_num = reader.readBits(8);
    segmentationDescriptor.segments_expected = reader.readBits(8);
    if (
        segmentationDescriptor.segmentation_type_id === 0x34 ||
        segmentationDescriptor.segmentation_type_id === 0x36 ||
        segmentationDescriptor.segmentation_type_id === 0x38 ||
        segmentationDescriptor.segmentation_type_id === 0x3A
    ) {
        segmentationDescriptor.sub_segment_num = reader.readBits(8);
        segmentationDescriptor.sub_segments_expected = reader.readBits(8);
    }

    return segmentationDescriptor;
}
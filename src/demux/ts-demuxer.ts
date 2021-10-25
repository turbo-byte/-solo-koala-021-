
/*
 * Copyright (C) 2021 magicxqq. All Rights Reserved.
 *
 * @author magicxqq <xqq@xqq.im>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Log from '../utils/logger';
import DemuxErrors from './demux-errors';
import MediaInfo from '../core/media-info';
import {IllegalStateException} from '../utils/exception';
import BaseDemuxer from './base-demuxer';
import { PAT, PESData, SectionData, SliceQueue, PIDToSliceQueues, PMT, ProgramToPMTMap, StreamType } from './pat-pmt-pes';
import { AVCDecoderConfigurationRecord, H264AnnexBParser, H264NaluAVC1, H264NaluPayload, H264NaluType } from './h264';
import SPSParser from './sps-parser';
import { AACADTSParser, AACFrame, AudioSpecificConfig } from './aac';
import { MPEG4AudioObjectTypes, MPEG4SamplingFrequencyIndex } from './mpeg4-audio';
import { PESPrivateData, PESPrivateDataDescriptor } from './pes-private-data';
import { readSCTE35, SCTE35Data } from './scte35';
import { H265AnnexBParser, H265NaluHVC1, H265NaluPayload, H265NaluType, HEVCDecoderConfigurationRecord } from './h265';
import H265Parser from './h265-parser';
import { SMPTE2038Data, smpte2038parse } from './smpte2038';
import { MP3Data } from './mp3';

type AACAudioMetadata = {
    codec: 'aac',
    audio_object_type: MPEG4AudioObjectTypes;
    sampling_freq_index: MPEG4SamplingFrequencyIndex;
    sampling_frequency: number;
    channel_config: number;
};
type MP3AudioMetadata = {
    codec: 'mp3',
    object_type: number,
    sample_rate: number,
    channel_count: number;
};
type AudioData = {
    codec: 'aac';
    data: AACFrame;
} | {
    codec: 'mp3';
    data: MP3Data;
}

class TSDemuxer extends BaseDemuxer {

    private readonly TAG: string = 'TSDemuxer';

    private config_: any;
    private ts_packet_size_: number;
    private sync_offset_: number;
    private first_parse_: boolean = true;

    private media_info_ = new MediaInfo();

    private timescale_ = 90;
    private duration_ = 0;

    private pat_: PAT;
    private current_program_: number;
    private current_pmt_pid_: number = -1;
    private pmt_: PMT;
    private program_pmt_map_: ProgramToPMTMap = {};

    private pes_slice_queues_: PIDToSliceQueues = {};
    private section_slice_queues_: PIDToSliceQueues = {};

    private video_metadata_: {
        vps: H265NaluHVC1 | undefined,
        sps: H264NaluAVC1 | H265NaluHVC1 | undefined,
        pps: H264NaluAVC1 | H265NaluHVC1 | undefined,
        details: any
    } = {
        vps: undefined,
        sps: undefined,
        pps: undefined,
        details: undefined
    };

    private audio_metadata_: AACAudioMetadata | MP3AudioMetadata = {
        codec: undefined,
        audio_object_type: undefined,
        sampling_freq_index: undefined,
        sampling_frequency: undefined,
        channel_config: undefined
    };

    private aac_last_sample_pts_: number = undefined;
    private aac_last_incomplete_data_: Uint8Array = null;

    private has_video_ = false;
    private has_audio_ = false;
    private video_init_segment_dispatched_ = false;
    private audio_init_segment_dispatched_ = false;
    private video_metadata_changed_ = false;
    private audio_metadata_changed_ = false;

    private video_track_ = {type: 'video', id: 1, sequenceNumber: 0, samples: [], length: 0};
    private audio_track_ = {type: 'audio', id: 2, sequenceNumber: 0, samples: [], length: 0};

    public constructor(probe_data: any, config: any) {
        super();

        this.ts_packet_size_ = probe_data.ts_packet_size;
        this.sync_offset_ = probe_data.sync_offset;
        this.config_ = config;
    }

    public destroy() {
        this.media_info_ = null;
        this.pes_slice_queues_ = null;
        this.section_slice_queues_ = null;

        this.video_metadata_ = null;
        this.audio_metadata_ = null;
        this.aac_last_incomplete_data_ = null;

        this.video_track_ = null;
        this.audio_track_ = null;

        super.destroy();
    }

    public static probe(buffer: ArrayBuffer) {
        let data = new Uint8Array(buffer);
        let sync_offset = -1;
        let ts_packet_size = 188;

        if (data.byteLength <= 3 * ts_packet_size) {
            return {needMoreData: true};
        }

        while (sync_offset === -1) {
            let scan_window = Math.min(1000, data.byteLength - 3 * ts_packet_size);

            for (let i = 0; i < scan_window; ) {
                // sync_byte should all be 0x47
                if (data[i] === 0x47
                        && data[i + ts_packet_size] === 0x47
                        && data[i + 2 * ts_packet_size] === 0x47) {
                    sync_offset = i;
                    break;
                } else {
                    i++;
                }
            }

            // find sync_offset failed in previous ts_packet_size
            if (sync_offset === -1) {
                if (ts_packet_size === 188) {
                    // try 192 packet size (BDAV, etc.)
                    ts_packet_size = 192;
                } else if (ts_packet_size === 192) {
                    // try 204 packet size (European DVB, etc.)
                    ts_packet_size = 204;
                } else {
                    // 192, 204 also failed, exit
                    break;
                }
            }
        }

        if (sync_offset === -1) {
            // both 188, 192, 204 failed, Non MPEG-TS
            return {match: false};
        }

        if (ts_packet_size === 192 && sync_offset >= 4) {
            Log.v('TSDemuxer', `ts_packet_size = 192, m2ts mode`);
            sync_offset -= 4;
        } else if (ts_packet_size === 204) {
            Log.v('TSDemuxer', `ts_packet_size = 204, RS encoded MPEG2-TS stream`);
        }

        return {
            match: true,
            consumed: 0,
            ts_packet_size,
            sync_offset
        };
    }

    public bindDataSource(loader) {
        loader.onDataArrival = this.parseChunks.bind(this);
        return this;
    }

    public resetMediaInfo() {
        this.media_info_ = new MediaInfo();
    }

    public parseChunks(chunk: ArrayBuffer, byte_start: number): number {
        if (!this.onError
                || !this.onMediaInfo
                || !this.onTrackMetadata
                || !this.onDataAvailable) {
            throw new IllegalStateException('onError & onMediaInfo & onTrackMetadata & onDataAvailable callback must be specified');
        }

        let offset = 0;

        if (this.first_parse_) {
            this.first_parse_ = false;
            offset = this.sync_offset_;
        }

        while (offset + this.ts_packet_size_ <= chunk.byteLength) {
            let file_position = byte_start + offset;

            if (this.ts_packet_size_ === 192) {
                // skip ATS field (2-bits copy-control + 30-bits timestamp) for m2ts
                offset += 4;
            }

            let data = new Uint8Array(chunk, offset, 188);

            let sync_byte = data[0];
            if (sync_byte !== 0x47) {
                Log.e(this.TAG, `sync_byte = ${sync_byte}, not 0x47`);
                break;
            }

            let payload_unit_start_indicator = (data[1] & 0x40) >>> 6;
            let transport_priority = (data[1] & 0x20) >>> 5;
            let pid = ((data[1] & 0x1F) << 8) | data[2];
            let adaptation_field_control = (data[3] & 0x30) >>> 4;
            let continuity_conunter = (data[3] & 0x0F);

            let adaptation_field_info: {
                discontinuity_indicator?: number,
                random_access_indicator?: number,
                elementary_stream_priority_indicator?: number
            } = {};
            let ts_payload_start_index = 4;

            if (adaptation_field_control == 0x02 || adaptation_field_control == 0x03) {
                let adaptation_field_length = data[4];
                if (5 + adaptation_field_length === 188) {
                    // TS packet only has adaption field, jump to next
                    offset += 188;
                    if (this.ts_packet_size_ === 204) {
                        // skip parity word (16 bytes) for RS encoded TS
                        offset += 16;
                    }
                    continue;
                } else {
                    // parse leading adaptation_field if has payload
                    if (adaptation_field_length > 0) {
                        adaptation_field_info = this.parseAdaptationField(chunk,
                                                                          offset + 4,
                                                                          1 + adaptation_field_length);
                    }
                    ts_payload_start_index = 4 + 1 + adaptation_field_length;
                }
            }

            if (adaptation_field_control == 0x01 || adaptation_field_control == 0x03) {
                if (pid === 0 || pid === this.current_pmt_pid_ || (this.pmt_ != undefined && this.pmt_.pid_stream_type[pid] === StreamType.kSCTE35)) {  // PAT(pid === 0) or PMT or SCTE35
                    let ts_payload_length = 188 - ts_payload_start_index;

                    this.handleSectionSlice(chunk,
                                            offset + ts_payload_start_index,
                                            ts_payload_length,
                                            {
                                                pid,
                                                file_position,
                                                payload_unit_start_indicator,
                                                continuity_conunter,
                                                random_access_indicator: adaptation_field_info.random_access_indicator
                                            });
                } else if (this.pmt_ != undefined && this.pmt_.pid_stream_type[pid] != undefined) {
                    // PES
                    let ts_payload_length = 188 - ts_payload_start_index;
                    let stream_type = this.pmt_.pid_stream_type[pid];

                    // process PES only for known common_pids
                    if (pid === this.pmt_.common_pids.h264
                            || pid === this.pmt_.common_pids.h265
                            || pid === this.pmt_.common_pids.adts_aac
                            || pid === this.pmt_.common_pids.mp3
                            || this.pmt_.pes_private_data_pids[pid] === true
                            || this.pmt_.timed_id3_pids[pid] === true) {
                        this.handlePESSlice(chunk,
                                            offset + ts_payload_start_index,
                                            ts_payload_length,
                                            {
                                                pid,
                                                stream_type,
                                                file_position,
                                                payload_unit_start_indicator,
                                                continuity_conunter,
                                                random_access_indicator: adaptation_field_info.random_access_indicator
                                            });
                    }
                }
            }

            offset += 188;

            if (this.ts_packet_size_ === 204) {
                // skip parity word (16 bytes) for RS encoded TS
                offset += 16;
            }
        }

        // dispatch parsed frames to the remuxer (consumer)
        this.dispatchAudioVideoMediaSegment();

        return offset;  // consumed bytes
    }

    private parseAdaptationField(buffer: ArrayBuffer, offset: number, length: number): {
        discontinuity_indicator?: number,
        random_access_indicator?: number,
        elementary_stream_priority_indicator?: number
    } {
        let data = new Uint8Array(buffer, offset, length);

        let adaptation_field_length = data[0];
        if (adaptation_field_length > 0) {
            if (adaptation_field_length > 183) {
                Log.w(this.TAG, `Illegal adaptation_field_length: ${adaptation_field_length}`);
                return {};
            }

            let discontinuity_indicator: number = (data[1] & 0x80) >>> 7;
            let random_access_indicator: number = (data[1] & 0x40) >>> 6;
            let elementary_stream_priority_indicator: number = (data[1] & 0x20) >>> 5;

            return {
                discontinuity_indicator,
                random_access_indicator,
                elementary_stream_priority_indicator
            };
        }

        return {};
    }

    private handleSectionSlice(buffer: ArrayBuffer, offset: number, length: number, misc: any): void {
        let data = new Uint8Array(buffer, offset, length);
        let slice_queue = this.section_slice_queues_[misc.pid];

        if (misc.payload_unit_start_indicator) {
            let pointer_field = data[0];

            if (slice_queue != undefined && slice_queue.total_length !== 0) {
                let remain_section = new Uint8Array(buffer, offset + 1, Math.min(length, pointer_field));
                slice_queue.slices.push(remain_section);
                slice_queue.total_length += remain_section.byteLength;

                if (slice_queue.total_length === slice_queue.expected_length) {
                    this.emitSectionSlices(slice_queue, misc);
                } else {
                    this.clearSlices(slice_queue, misc);
                }
            }

            for (let i = 1 + pointer_field; i < data.byteLength; ){
                let table_id = data[i + 0];
                if (table_id === 0xFF) { break; }

                let section_length = ((data[i + 1] & 0x0F) << 8) | data[i + 2];

                this.section_slice_queues_[misc.pid] = new SliceQueue();
                slice_queue = this.section_slice_queues_[misc.pid];

                slice_queue.expected_length = section_length + 3;
                slice_queue.file_position = misc.file_position;
                slice_queue.random_access_indicator = misc.random_access_indicator;

                let remain_section = new Uint8Array(buffer, offset + i, Math.min(length - i, slice_queue.expected_length - slice_queue.total_length));
                slice_queue.slices.push(remain_section);
                slice_queue.total_length += remain_section.byteLength;

                if (slice_queue.total_length === slice_queue.expected_length) {
                    this.emitSectionSlices(slice_queue, misc);
                } else if (slice_queue.total_length >= slice_queue.expected_length) {
                    this.clearSlices(slice_queue, misc);
                }

                i += remain_section.byteLength;
            }
        } else if (slice_queue != undefined && slice_queue.total_length !== 0) {
            let remain_section = new Uint8Array(buffer, offset, Math.min(length, slice_queue.expected_length - slice_queue.total_length));
            slice_queue.slices.push(remain_section);
            slice_queue.total_length += remain_section.byteLength;

            if (slice_queue.total_length === slice_queue.expected_length) {
                this.emitSectionSlices(slice_queue, misc);
            } else if (slice_queue.total_length >= slice_queue.expected_length) {
                this.clearSlices(slice_queue, misc);
            }
        }
    }

    private handlePESSlice(buffer: ArrayBuffer, offset: number, length: number, misc: any): void {
        let data = new Uint8Array(buffer, offset, length);

        let packet_start_code_prefix = (data[0] << 16) | (data[1] << 8) | (data[2]);
        let stream_id = data[3];
        let PES_packet_length = (data[4] << 8) | data[5];

        if (misc.payload_unit_start_indicator) {
            if (packet_start_code_prefix !== 1) {
                Log.e(this.TAG, `handlePESSlice: packet_start_code_prefix should be 1 but with value ${packet_start_code_prefix}`);
                return;
            }

            // handle queued PES slices:
            // Merge into a big Uint8Array then call parsePES()
            let slice_queue = this.pes_slice_queues_[misc.pid];
            if (slice_queue) {
                if (slice_queue.expected_length === 0 || slice_queue.expected_length === slice_queue.total_length) {
                    this.emitPESSlices(slice_queue, misc);
                } else {
                    this.clearSlices(slice_queue, misc);
                }
            }

            // Make a new PES queue for new PES slices
            this.pes_slice_queues_[misc.pid] = new SliceQueue();
            this.pes_slice_queues_[misc.pid].file_position = misc.file_position;
            this.pes_slice_queues_[misc.pid].random_access_indicator = misc.random_access_indicator;
        }

        if (this.pes_slice_queues_[misc.pid] == undefined) {
            // ignore PES slices without [PES slice that has payload_unit_start_indicator]
            return;
        }

        // push subsequent PES slices into pes_queue
        let slice_queue = this.pes_slice_queues_[misc.pid];
        slice_queue.slices.push(data);
        if (misc.payload_unit_start_indicator) {
            slice_queue.expected_length = PES_packet_length === 0 ? 0 : PES_packet_length + 6;
        }
        slice_queue.total_length += data.byteLength;

        if (slice_queue.expected_length > 0 && slice_queue.expected_length === slice_queue.total_length) {
            this.emitPESSlices(slice_queue, misc);
        } else if (slice_queue.expected_length > 0 && slice_queue.expected_length < slice_queue.total_length) {
            this.clearSlices(slice_queue, misc);
        }
    }

    private emitSectionSlices(slice_queue: SliceQueue, misc: any): void {
        let data = new Uint8Array(slice_queue.total_length);
        for (let i = 0, offset = 0; i < slice_queue.slices.length; i++) {
            let slice = slice_queue.slices[i];
            data.set(slice, offset);
            offset += slice.byteLength;
        }
        slice_queue.slices = [];
        slice_queue.expected_length = -1;
        slice_queue.total_length = 0;

        let section_data = new SectionData();
        section_data.pid = misc.pid;
        section_data.data = data;
        section_data.file_position = slice_queue.file_position;
        section_data.random_access_indicator = slice_queue.random_access_indicator;
        this.parseSection(section_data);
    }

    private emitPESSlices(slice_queue: SliceQueue, misc: any): void {
        let data = new Uint8Array(slice_queue.total_length);
        for (let i = 0, offset = 0; i < slice_queue.slices.length; i++) {
            let slice = slice_queue.slices[i];
            data.set(slice, offset);
            offset += slice.byteLength;
        }
        slice_queue.slices = [];
        slice_queue.expected_length = -1;
        slice_queue.total_length = 0;

        let pes_data = new PESData();
        pes_data.pid = misc.pid;
        pes_data.data = data;
        pes_data.stream_type = misc.stream_type;
        pes_data.file_position = slice_queue.file_position;
        pes_data.random_access_indicator = slice_queue.random_access_indicator;
        this.parsePES(pes_data);
    }

    private clearSlices(slice_queue: SliceQueue, misc: any): void {
        slice_queue.slices = [];
        slice_queue.expected_length = -1;
        slice_queue.total_length = 0;
    }

    private parseSection(section_data: SectionData): void {
        let data = section_data.data;
        let pid = section_data.pid;

        if (pid === 0x00) {
            this.parsePAT(data);
        } else if (pid === this.current_pmt_pid_) {
            this.parsePMT(data);
        } else if (this.pmt_ != undefined && this.pmt_.scte_35_pids[pid]) {
            this.parseSCTE35(data);
        }
    }

    private parsePES(pes_data: PESData): void {
        let data = pes_data.data;
        let packet_start_code_prefix = (data[0] << 16) | (data[1] << 8) | (data[2]);
        let stream_id = data[3];
        let PES_packet_length = (data[4] << 8) | data[5];

        if (packet_start_code_prefix !== 1) {
            Log.e(this.TAG, `parsePES: packet_start_code_prefix should be 1 but with value ${packet_start_code_prefix}`);
            return;
        }

        if (stream_id !== 0xBC  // program_stream_map
                && stream_id !== 0xBE  // padding_stream
                && stream_id !== 0xBF  // private_stream_2
                && stream_id !== 0xF0  // ECM
                && stream_id !== 0xF1  // EMM
                && stream_id !== 0xFF  // program_stream_directory
                && stream_id !== 0xF2  // DSMCC
                && stream_id !== 0xF8) {
            let PES_scrambling_control = (data[6] & 0x30) >>> 4;
            let PTS_DTS_flags = (data[7] & 0xC0) >>> 6;
            let PES_header_data_length = data[8];

            let pts: number | undefined;
            let dts: number | undefined;

            if (PTS_DTS_flags === 0x02 || PTS_DTS_flags === 0x03) {
                pts = (data[9] & 0x0E) * 536870912 + // 1 << 29
                      (data[10] & 0xFF) * 4194304 + // 1 << 22
                      (data[11] & 0xFE) * 16384 + // 1 << 14
                      (data[12] & 0xFF) * 128 + // 1 << 7
                      (data[13] & 0xFE) / 2;

                if (PTS_DTS_flags === 0x03) {
                    dts = (data[14] & 0x0E) * 536870912 + // 1 << 29
                          (data[15] & 0xFF) * 4194304 + // 1 << 22
                          (data[16] & 0xFE) * 16384 + // 1 << 14
                          (data[17] & 0xFF) * 128 + // 1 << 7
                          (data[18] & 0xFE) / 2;
                } else {
                    dts = pts;
                }
            }

            let payload_start_index = 6 + 3 + PES_header_data_length;
            let payload_length: number;

            if (PES_packet_length !== 0) {
                if (PES_packet_length < 3 + PES_header_data_length) {
                    Log.v(this.TAG, `Malformed PES: PES_packet_length < 3 + PES_header_data_length`);
                    return;
                }
                payload_length = PES_packet_length - 3 - PES_header_data_length;
            } else {  // PES_packet_length === 0
                payload_length = data.byteLength - payload_start_index;
            }

            let payload = data.subarray(payload_start_index, payload_start_index + payload_length);

            switch (pes_data.stream_type) {
                case StreamType.kMPEG1Audio:
                case StreamType.kMPEG2Audio:
                    this.parseMP3Payload(payload, pts);
                    break;
                case StreamType.kPESPrivateData:
                    if (this.pmt_.smpte2038_pids[pes_data.pid]) {
                        this.parseSMPTE2038MetadataPayload(payload, pts, dts, pes_data.pid, stream_id);
                    } else {
                        this.parsePESPrivateDataPayload(payload, pts, dts, pes_data.pid, stream_id);
                    }
                    break;
                case StreamType.kADTSAAC:
                    this.parseAACPayload(payload, pts);
                    break;
                case StreamType.kID3:
                    this.parseTimedID3MetadataPayload(payload, pts, dts, pes_data.pid, stream_id);
                    break;
                case StreamType.kH264:
                    this.parseH264Payload(payload, pts, dts, pes_data.file_position, pes_data.random_access_indicator);
                    break;
                case StreamType.kH265:
                    this.parseH265Payload(payload, pts, dts, pes_data.file_position, pes_data.random_access_indicator);
                    break;
                default:
                    break;
            }
        } else if (stream_id === 0xBC  // program_stream_map
                       || stream_id === 0xBF  // private_stream_2
                       || stream_id === 0xF0  // ECM
                       || stream_id === 0xF1  // EMM
                       || stream_id === 0xFF  // program_stream_directory
                       || stream_id === 0xF2  // DSMCC_stream
                       || stream_id === 0xF8) {  // ITU-T Rec. H.222.1 type E stream
            if (pes_data.stream_type === StreamType.kPESPrivateData) {
                let payload_start_index = 6;
                let payload_length: number;

                if (PES_packet_length !== 0) {
                    payload_length = PES_packet_length;
                } else {  // PES_packet_length === 0
                    payload_length = data.byteLength - payload_start_index;
                }

                let payload = data.subarray(payload_start_index, payload_start_index + payload_length);
                this.parsePESPrivateDataPayload(payload, undefined, undefined, pes_data.pid, stream_id);
            }
        }
    }

    private parsePAT(data: Uint8Array): void {
        let table_id = data[0];
        if (table_id !== 0x00) {
            Log.e(this.TAG, `parsePAT: table_id ${table_id} is not corresponded to PAT!`);
            return;
        }

        let section_length = ((data[1] & 0x0F) << 8) | data[2];

        let transport_stream_id = (data[3] << 8) | data[4];
        let version_number = (data[5] & 0x3E) >>> 1;
        let current_next_indicator = data[5] & 0x01;
        let section_number = data[6];
        let last_section_number = data[7];

        let pat: PAT = null;

        if (current_next_indicator === 1 && section_number === 0) {
            pat = new PAT();
            pat.version_number = version_number;
        } else {
            pat = this.pat_;
            if (pat == undefined) {
                return;
            }
        }

        let program_start_index = 8;
        let program_bytes = section_length - 5 - 4;  // section_length - (headers + crc)
        let first_program_number = -1;
        let first_pmt_pid = -1;

        for (let i = program_start_index; i < program_start_index + program_bytes; i += 4) {
            let program_number = (data[i] << 8) | data[i + 1];
            let pid = ((data[i + 2] & 0x1F) << 8) | data[i + 3];

            if (program_number === 0) {
                // network_PID
                pat.network_pid = pid;
            } else {
                // program_map_PID
                pat.program_pmt_pid[program_number] = pid;

                if (first_program_number === -1) {
                    first_program_number = program_number;
                }

                if (first_pmt_pid === -1) {
                    first_pmt_pid = pid;
                }
            }
        }

        // Currently we only deal with first appeared PMT pid
        if (current_next_indicator === 1 && section_number === 0) {
            if (this.pat_ == undefined) {
                Log.v(this.TAG, `Parsed first PAT: ${JSON.stringify(pat)}`);
            }
            this.pat_ = pat;
            this.current_program_ = first_program_number;
            this.current_pmt_pid_ = first_pmt_pid;
        }
    }

    private parsePMT(data: Uint8Array): void {
        let table_id = data[0];
        if (table_id !== 0x02) {
            Log.e(this.TAG, `parsePMT: table_id ${table_id} is not corresponded to PMT!`);
            return;
        }

        let section_length = ((data[1] & 0x0F) << 8) | data[2];

        let program_number = (data[3] << 8) | data[4];
        let version_number = (data[5] & 0x3E) >>> 1;
        let current_next_indicator = data[5] & 0x01;
        let section_number = data[6];
        let last_section_number = data[7];

        let pmt: PMT = null;

        if (current_next_indicator === 1 && section_number === 0) {
            pmt = new PMT();
            pmt.program_number = program_number;
            pmt.version_number = version_number;
            this.program_pmt_map_[program_number] = pmt;
        } else {
            pmt = this.program_pmt_map_[program_number];
            if (pmt == undefined) {
                return;
            }
        }

        let PCR_PID = ((data[8] & 0x1F) << 8) | data[9];
        let program_info_length = ((data[10] & 0x0F) << 8) | data[11];

        let info_start_index = 12 + program_info_length;
        let info_bytes = section_length - 9 - program_info_length - 4;

        for (let i = info_start_index; i < info_start_index + info_bytes; ) {
            let stream_type = data[i] as StreamType;
            let elementary_PID = ((data[i + 1] & 0x1F) << 8) | data[i + 2];
            let ES_info_length = ((data[i + 3] & 0x0F) << 8) | data[i + 4];

            pmt.pid_stream_type[elementary_PID] = stream_type;

            if (stream_type === StreamType.kH264 && !pmt.common_pids.h264 && !pmt.common_pids.h265) {
                pmt.common_pids.h264 = elementary_PID;
            } else if (stream_type === StreamType.kH265 && !pmt.common_pids.h264 && !pmt.common_pids.h265) {
                pmt.common_pids.h265 = elementary_PID;
            } else if (stream_type === StreamType.kADTSAAC && !pmt.common_pids.adts_aac) {
                pmt.common_pids.adts_aac = elementary_PID;
            } else if ((stream_type === StreamType.kMPEG1Audio || stream_type === StreamType.kMPEG2Audio) && !pmt.common_pids.mp3) {
                pmt.common_pids.mp3 = elementary_PID;
            } else if (stream_type === StreamType.kPESPrivateData) {
                pmt.pes_private_data_pids[elementary_PID] = true;
                if (ES_info_length > 0) {
                    // parse descriptor for PES private data
                    for (let offset = i + 5; offset < i + 5 + ES_info_length; ) {
                        let tag = data[offset + 0];
                        let length = data[offset + 1];
                        if (tag === 0x05) { // Registration Descriptor
                            let registration = String.fromCharCode(... Array.from(data.subarray(offset + 2, offset + 2 + length)));

                            if (registration === 'VANC') {
                                pmt.smpte2038_pids[elementary_PID] = true;
                            }
                        }
                        offset += 2 + length;
                    }
                    // provide descriptor for PES private data via callback
                    let descriptors = data.subarray(i + 5, i + 5 + ES_info_length);
                    this.dispatchPESPrivateDataDescriptor(elementary_PID, stream_type, descriptors);
                }
            } else if (stream_type === StreamType.kID3) {
                pmt.timed_id3_pids[elementary_PID] = true;
            } else if (stream_type === StreamType.kSCTE35) {
                pmt.scte_35_pids[elementary_PID] = true;
            }

            i += 5 + ES_info_length;
        }

        if (program_number === this.current_program_) {
            if (this.pmt_ == undefined) {
                Log.v(this.TAG, `Parsed first PMT: ${JSON.stringify(pmt)}`);
            }
            this.pmt_ = pmt;
            if (pmt.common_pids.h264 || pmt.common_pids.h265) {
                this.has_video_ = true;
            }
            if (pmt.common_pids.adts_aac || pmt.common_pids.mp3) {
                this.has_audio_ = true;
            }
        }
    }

    private parseSCTE35(data: Uint8Array): void {
        const scte35 = readSCTE35(data);

        if (scte35.pts != undefined) {
            let pts_ms = Math.floor(scte35.pts / this.timescale_);
            scte35.pts = pts_ms;
        } else {
            scte35.nearest_pts = this.aac_last_sample_pts_;
        }

        if (this.onSCTE35Metadata) {
            this.onSCTE35Metadata(scte35);
        }
    }

    private parseH264Payload(data: Uint8Array, pts: number, dts: number, file_position: number, random_access_indicator: number) {
        let annexb_parser = new H264AnnexBParser(data);
        let nalu_payload: H264NaluPayload = null;
        let units: {type: H264NaluType, data: Uint8Array}[] = [];
        let length = 0;
        let keyframe = false;

        while ((nalu_payload = annexb_parser.readNextNaluPayload()) != null) {
            let nalu_avc1 = new H264NaluAVC1(nalu_payload);

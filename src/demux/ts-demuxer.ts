
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
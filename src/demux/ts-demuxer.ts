
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
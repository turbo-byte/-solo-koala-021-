import BaseDemuxer from './base-demuxer';
declare class TSDemuxer extends BaseDemuxer {
    private readonly TAG;
    private config_;
    private ts_packet_size_;
    private sync_offset_;
    private first_parse_;
    private media_info_;
    private timescale_;
    private duration_;
    private pat_;
    private current_program_;
    private current_pmt_pid_;
    private pmt_;
    private program_pmt_map_;
    private pes_slice_queues_;
    private section_slice_queues_;
    private video_metadata_;
    private audio_metadata_;
    private aac_last_sample_pts_;
    private aac_last_incomplete_data_;
    private has_video_;
    private has_audio_;
    private video_init_segment_dispatched_;
    private audio_init_segment_dispatched_;
    private video_metadata_changed_;
    private audio_metadata_changed_;
    private video_track_;
    private audio_track_;
    constructor(probe_data: any, config: any);
    destroy(): void;
    static probe(buffer: ArrayBuffer): {
        needMoreData: boolean;
   
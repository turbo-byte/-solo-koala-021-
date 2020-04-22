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
    privat
import BaseDemuxer from './base-demuxer';
declare class TSDemuxer extends BaseDemuxer {
    private readonly TAG;
    private config_;
    private ts_packet_size_;
    private sync_offset_;
    private first_parse_;
    private media_info_;
    private times
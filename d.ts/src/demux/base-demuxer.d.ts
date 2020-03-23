import MediaInfo from '../core/media-info';
import { PESPrivateData, PESPrivateDataDescriptor } from './pes-private-data';
import { SMPTE2038Data } from './smpte2038';
import { SCTE35Data } from './scte35';
declare type OnErrorCallback = (type: string, info: string) => void;
declare type OnMediaInfoCallback = (mediaInfo: MediaInfo) => void;
declare type OnMetaDataArrivedCallback = (metadata: any) => void;
declare type OnTrackMetadataCallback = (type: string, metadata: any) => void;
declare type OnDataAvailableCallback = (videoTrack: any, audioTrack: any) => void;
declare type OnTimedID3MetadataCallback = (timed_id3_data: PESPrivateData) => void;
declare type OnSMPTE2038MetadataCallback = (smpte2038_data: SMPTE2038Data) => void;
declare type OnSCTE35MetadataCallback = (scte35_dat
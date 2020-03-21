import MediaInfo from '../core/media-info';
import { PESPrivateData, PESPrivateDataDescriptor } from './pes-private-data';
import { SMPTE2038Data } from './smpte2038';
import { SCTE35Data } from './scte35';
declare type OnErrorCallback = (type: string, info: string) => void;
declare type OnMediaInfoCallback = (mediaInfo: MediaInfo) => void;
declare type OnMetaDataArrivedCallback = (metadata: any) => void;
declare type OnTrackMetadata
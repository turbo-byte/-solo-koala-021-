import MediaInfo from '../core/media-info';
import { PESPrivateData, PESPrivateDataDescriptor } from './pes-private-data';
import { SMPTE2038Data } from './smpte2038';
import { SCTE35Data } from './scte35';

type OnErrorCallback = (type: string, info: string) => void;
type OnMediaInfoCallback = (mediaInfo: MediaInfo) => void;
type OnMetaDataArrivedCallback = (metadata: any) => void;
type OnTrackMetadataCallback = (type: string, metadata: any) => void;
type OnDataAvailableCallback = (videoTrack: any, audioTrack: any) => void;
type OnTimedID3MetadataCallback = (timed_id3_data: PESPrivateData) => void;
type OnSMPTE2038MetadataCallback = (smpte2038_data: SMPTE2038Data) => void;
type OnSCTE35MetadataCallback = (scte35_data: SCTE35Data) => void;
type OnPESPrivateDataCallback = (private_data: 
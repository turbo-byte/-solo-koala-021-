import MediaInfo from '../core/media-info';
import { PESPrivateData, PESPrivateDataDescriptor } from './pes-private-data';
import { SMPTE2038Data } from './smpte2038';
import { SCTE35Data } from './scte35';

type OnErrorCallback = (type: string, info: string) => void;
type OnMediaInfoCallback = (mediaInfo: MediaInfo) => void;
type OnMetaDataArrivedCallback = (metadata: any) => void;
type OnTrackMetadataCallback = (type: string, metadata: any) => vo
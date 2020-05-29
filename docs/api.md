
mpegts.js API
==========
This document use TypeScript-like definitions to describe interfaces.

## Interfaces

mpegts.js exports all the interfaces through `mpegts` object which exposed in global context `window`.

`mpegts` object can also be accessed by require or ES6 import.


Functions:
- [mpegts.createPlayer()](#mpegtscreateplayer)
- [mpegts.isSupported()](#mpegtsissupported)
- [mpegts.getFeatureList()](#mpegtsgetfeaturelist)

Classes:
- [mpegts.MSEPlayer](#mpegtsmseplayer)
- [mpegts.NativePlayer](#mpegtsnativeplayer)
- [mpegts.LoggingControl](#mpegtsloggingcontrol)

Enums:
- [mpegts.Events](#mpegtsevents)
- [mpegts.ErrorTypes](#mpegtserrortypes)
- [mpegts.ErrorDetails](#mpegtserrordetails)




### mpegts.createPlayer()
```js
function createPlayer(mediaDataSource: MediaDataSource, config?: Config): Player;
```

Create a player instance according to `type` field indicated in `mediaDataSource`, with optional `config`.


### MediaDataSource

| Field              | Type                  | Description                              |
| ------------------ | --------------------- | ---------------------------------------- |
| `type`             | `string`              | Indicates media type, `'mse'`, `'mpegts'`, `'m2ts'`, `'flv'` or `'mp4'` |
| `isLive?`          | `boolean`             | Indicates whether the data source is a **live stream** |
| `cors?`            | `boolean`             | Indicates whether to enable CORS for http fetching |
| `withCredentials?` | `boolean`             | Indicates whether to do http fetching with cookies |
| `hasAudio?`        | `boolean`             | Indicates whether the stream has audio track |
| `hasVideo?`        | `boolean`             | Indicates whether the stream has video track |
| `duration?`        | `number`              | Indicates total media duration, in **milliseconds** |
| `filesize?`        | `number`              | Indicates total file size of media file, in bytes |
| `url?`             | `string`              | Indicates media URL, can be starts with `'https(s)'` or `'ws(s)'` (WebSocket) |
| `segments?`        | `Array<MediaSegment>` | Optional field for multipart playback, see **MediaSegment** |

If `segments` field exists, transmuxer will treat this `MediaDataSource` as a **multipart** source.

In multipart mode, `duration` `filesize` `url` field in `MediaDataSource` structure will be ignored.

### MediaSegment

| Field       | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `duration`  | `number` | Required field, indicates segment duration in **milliseconds** |
| `filesize?` | `number` | Optional field, indicates segment file size in bytes |
| `url`       | `string` | Required field, indicates segment file URL |


### Config

| Field                            | Type      | Default                      | Description                              |
| -------------------------------- | --------- | ---------------------------- | ---------------------------------------- |
| `enableWorker?`                  | `boolean` | `false`                      | Enable separated thread (WebWorker) for transmuxing  |
| `enableStashBuffer?`             | `boolean` | `true`                       | Enable IO stash buffer. Set to false if you need realtime (minimal latency) for live stream playback, but may stalled if there's network jittering. |
| `stashInitialSize?`              | `number`  | `384KB`                      | Indicates IO stash buffer initial size. Default is `384KB`. Indicate a suitable size can improve video load/seek time. |
| `isLive?`                        | `boolean` | `false`                      | Same to `isLive` in **MediaDataSource**, ignored if has been set in MediaDataSource structure. |
| `liveBufferLatencyChasing?`      | `boolean` | `false`                      | Chasing the live stream latency caused by the internal buffer in HTMLMediaElement. `isLive` should also be set to `true` |
| `liveBufferLatencyMaxLatency?`   | `number`  | `1.5`                        | Maximum acceptable buffer latency in HTMLMediaElement, in seconds. Effective only if `isLive: true` and `liveBufferLatencyChasing: true` |
| `liveBufferLatencyMinRemain?`    | `number`  | `0.5`                        | Minimum buffer latency to be keeped in HTMLMediaElement, in seconds. Effective only if `isLive: true` and `liveBufferLatencyChasing: true` |
| `lazyLoad?`                      | `boolean` | `true`                       | Abort the http connection if there's enough data for playback. |
| `lazyLoadMaxDuration?`           | `number`  | `3 * 60`                     | Indicates how many seconds of data to be kept for `lazyLoad`. |
| `lazyLoadRecoverDuration?`       | `number`  | `30`                         | Indicates the `lazyLoad` recover time boundary in seconds. |
| `deferLoadAfterSourceOpen?`      | `boolean` | `true`                       | Do load after MediaSource `sourceopen` event triggered. On Chrome, tabs which be opened in background may not trigger `sourceopen` event until switched to that tab. |
| `autoCleanupSourceBuffer`        | `boolean` | `false`                      | Do auto cleanup for SourceBuffer         |
| `autoCleanupMaxBackwardDuration` | `number`  | `3 * 60`                     | When backward buffer duration exceeded this value (in seconds), do auto cleanup for SourceBuffer |
| `autoCleanupMinBackwardDuration` | `number`  | `2 * 60`                     | Indicates the duration in seconds to reserve for backward buffer when doing auto cleanup. |
| `fixAudioTimestampGap`           | `boolean` | `true`                       | Fill silent audio frames to avoid a/v unsync when detect large audio timestamp gap. |
| `accurateSeek?`                  | `boolean` | `false`                      | Accurate seek to any frame, not limited to video IDR frame, but may a bit slower. Available on `Chrome > 50`, `FireFox` and `Safari`. |
| `seekType?`                      | `string`  | `'range'`                    | `'range'` use range request to seek, or `'param'` add params into url to indicate request range. |
| `seekParamStart?`                | `string`  | `'bstart'`                   | Indicates seek start parameter name for `seekType = 'param'` |
| `seekParamEnd?`                  | `string`  | `'bend'`                     | Indicates seek end parameter name for `seekType = 'param'` |
| `rangeLoadZeroStart?`            | `boolean` | `false`                      | Send `Range: bytes=0-` for first time load if use Range seek |
| `customSeekHandler?`             | `object`  | `undefined`                  | Indicates a custom seek handler          |
| `reuseRedirectedURL?`            | `boolean` | `false`                      | Reuse 301/302 redirected url for subsequence request like seek, reconnect, etc. |
| `referrerPolicy?`                | `string`  | `no-referrer-when-downgrade` | Indicates the [Referrer Policy][] when using FetchStreamLoader |
| `headers?`                       | `object`  | `undefined`                  | Indicates additional headers that will be added to request |


[Referrer Policy]: https://w3c.github.io/webappsec-referrer-policy/#referrer-policy

### mpegts.isSupported()
```js
function isSupported(): boolean;
```
Return `true` if basic playback can works on your browser.



### mpegts.getFeatureList()
```js
function getFeatureList(): FeatureList;
```
Return a `FeatureList` object which has following details:
#### FeatureList
| Field                   | Type      | Description                              |
| ----------------------- | --------- | ---------------------------------------- |
| `msePlayback`           | `boolean` | Same to `mpegts.isSupported()`, indicates whether basic playback works on your browser. |
| `mseLivePlayback`       | `boolean` | Indicates whether HTTP MPEG2-TS/FLV live stream can work on your browser. |
| `mseH265Playback`       | `boolean` | Indicates whether H265 over MPEG2-TS/FLV stream can work on your browser. |
| `networkStreamIO`       | `boolean` | Indicates whether the network loader is streaming. |
| `networkLoaderName`     | `string`  | Indicates the network loader type name.  |
| `nativeMP4H264Playback` | `boolean` | Indicates whether your browser support H.264 MP4 video file natively. |
| `nativeMP4H265Playback` | `boolean` | Indicates whether your browser support H.265 MP4 video file natively. |
| `nativeWebmVP8Playback` | `boolean` | Indicates whether your browser support WebM VP8 video file natively. |
| `nativeWebmVP9Playback` | `boolean` | Indicates whether your browser support WebM VP9 video file natively. |



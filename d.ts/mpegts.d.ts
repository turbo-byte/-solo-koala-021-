
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

// mpegts.js TypeScript definition file

declare namespace Mpegts {
    interface MediaSegment {
        duration: number;
        filesize?: number;
        url: string;
    }

    interface MediaDataSource {
        type: string;
        isLive?: boolean;
        cors?: boolean;
        withCredentials?: boolean;

        hasAudio?: boolean;
        hasVideo?: boolean;

        duration?: number;
        filesize?: number;
        url?: string;

        segments?: MediaSegment[];
    }

    interface Config {
        /**
         * @desc Enable separated thread for transmuxing (unstable for now)
         * @defaultvalue false
         */
        enableWorker?: boolean;
        /**
         * @desc Enable IO stash buffer. Set to false if you need realtime (minimal latency) for live stream
         *          playback, but may stalled if there's network jittering.
         * @defaultvalue true
         */
        enableStashBuffer?: boolean;
        /**
         * @desc Indicates IO stash buffer initial size. Default is `384KB`. Indicate a suitable size can
         *          improve video load/seek time.
         */
        stashInitialSize?: number;

        /**
         * @desc Same to `isLive` in **MediaDataSource**, ignored if has been set in MediaDataSource structure.
         * @defaultvalue false
         */
        isLive?: boolean;

        /**
         * @desc Chasing the live stream latency caused by the internal buffer in HTMLMediaElement
         *       `isLive` should also be set to `true`
         * @defaultvalue false
         */
        liveBufferLatencyChasing?: boolean;

        /**
         * @desc Maximum acceptable buffer latency in HTMLMediaElement, in seconds
         *       Effective only if `isLive: true` and `liveBufferLatencyChasing: true`
         * @defaultvalue 1.5
         */
        liveBufferLatencyMaxLatency?: number;

        /**
         * @desc Minimum buffer latency to be keeped in HTMLMediaElement, in seconds
         *       Effective only if `isLive: true` and `liveBufferLatencyChasing: true`
         * @defaultvalue 0.5
         */
        liveBufferLatencyMinRemain?: number;

        /**
         * @desc Abort the http connection if there's enough data for playback.
         * @defaultvalue true
         */
        lazyLoad?: boolean;
        /**
         * @desc Indicates how many seconds of data to be kept for `lazyLoad`.
         * @defaultvalue 3 * 60
         */
        lazyLoadMaxDuration?: number;
        /**
         * @desc Indicates the `lazyLoad` recover time boundary in seconds.
         * @defaultvalue 30
         */
        lazyLoadRecoverDuration?: number;
        /**
         * @desc Do load after MediaSource `sourceopen` event triggered. On Chrome, tabs which
         *          be opened in background may not trigger `sourceopen` event until switched to that tab.
         * @defaultvalue true
         */
        deferLoadAfterSourceOpen?: boolean;

        /**
         * @desc Do auto cleanup for SourceBuffer
         * @defaultvalue false (from docs)
         */
        autoCleanupSourceBuffer?: boolean;
        /**
         * @desc When backward buffer duration exceeded this value (in seconds), do auto cleanup for SourceBuffer
         * @defaultvalue 3 * 60
         */
        autoCleanupMaxBackwardDuration?: number;
        /**
         * @desc Indicates the duration in seconds to reserve for backward buffer when doing auto cleanup.
         * @defaultvalue 2 * 60
         */
        autoCleanupMinBackwardDuration?: number;

        /**
         * @defaultvalue 600
         */
        statisticsInfoReportInterval?: number;

        /**
         * @desc Fill silent audio frames to avoid a/v unsync when detect large audio timestamp gap.
         * @defaultvalue true
         */
        fixAudioTimestampGap?: boolean;

        /**
         * @desc Accurate seek to any frame, not limited to video IDR frame, but may a bit slower.
         *          Available on Chrome > 50, FireFox and Safari.
         * @defaultvalue false
         */
        accurateSeek?: boolean;
        /**
         * @desc 'range' use range request to seek, or 'param' add params into url to indicate request range.
         * @defaultvalue 'range'
         */
        seekType?: 'range' | 'param' | 'custom';
        /**
         * @desc Indicates seek start parameter name for seekType = 'param'
         * @defaultvalue 'bstart'
         */
        seekParamStart?: string;
        /**
         * @desc Indicates seek end parameter name for seekType = 'param'
         * @defaultvalue 'bend'
         */
        seekParamEnd?: string;
        /**
         * @desc Send Range: bytes=0- for first time load if use Range seek
         * @defaultvalue false
         */
        rangeLoadZeroStart?: boolean;
        /**
         * @desc Indicates a custom seek handler
         * @desc Should implement `SeekHandler` interface
         */
        customSeekHandler?: CustomSeekHandlerConstructor;
        /**
         * @desc Reuse 301/302 redirected url for subsequence request like seek, reconnect, etc.
         * @defaultvalue false
         */
        reuseRedirectedURL?: boolean;
        /**
         * @desc Indicates the Referrer Policy when using FetchStreamLoader
         * @defaultvalue 'no-referrer-when-downgrade' (from docs)
         */
        referrerPolicy?: ReferrerPolicy;
        /**
         * @desc Indicates additional headers that will be added to request
         */
        headers?: {
            [k: string]: string
        }
        /**
         * @desc Should implement `BaseLoader` interface
         */
        customLoader?: CustomLoaderConstructor;
    }
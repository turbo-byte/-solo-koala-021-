
/*
 * Copyright (C) 2016 Bilibili. All Rights Reserved.
 *
 * @author zheng qian <xqq@xqq.im>
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

import EventEmitter from 'events';
import Log from '../utils/logger.js';
import Browser from '../utils/browser.js';
import MediaInfo from './media-info.js';
import FLVDemuxer from '../demux/flv-demuxer.js';
import TSDemuxer from '../demux/ts-demuxer';
import MP4Remuxer from '../remux/mp4-remuxer.js';
import DemuxErrors from '../demux/demux-errors.js';
import IOController from '../io/io-controller.js';
import TransmuxingEvents from './transmuxing-events.js';
import {LoaderStatus, LoaderErrors} from '../io/loader.js';

// Transmuxing (IO, Demuxing, Remuxing) controller, with multipart support
class TransmuxingController {

    constructor(mediaDataSource, config) {
        this.TAG = 'TransmuxingController';
        this._emitter = new EventEmitter();

        this._config = config;

        // treat single part media as multipart media, which has only one segment
        if (!mediaDataSource.segments) {
            mediaDataSource.segments = [{
                duration: mediaDataSource.duration,
                filesize: mediaDataSource.filesize,
                url: mediaDataSource.url
            }];
        }

        // fill in default IO params if not exists
        if (typeof mediaDataSource.cors !== 'boolean') {
            mediaDataSource.cors = true;
        }
        if (typeof mediaDataSource.withCredentials !== 'boolean') {
            mediaDataSource.withCredentials = false;
        }

        this._mediaDataSource = mediaDataSource;
        this._currentSegmentIndex = 0;
        let totalDuration = 0;

        this._mediaDataSource.segments.forEach((segment) => {
            // timestampBase for each segment, and calculate total duration
            segment.timestampBase = totalDuration;
            totalDuration += segment.duration;
            // params needed by IOController
            segment.cors = mediaDataSource.cors;
            segment.withCredentials = mediaDataSource.withCredentials;
            // referrer policy control, if exist
            if (config.referrerPolicy) {
                segment.referrerPolicy = config.referrerPolicy;
            }
        });

        if (!isNaN(totalDuration) && this._mediaDataSource.duration !== totalDuration) {
            this._mediaDataSource.duration = totalDuration;
        }

        this._mediaInfo = null;
        this._demuxer = null;
        this._remuxer = null;
        this._ioctl = null;

        this._pendingSeekTime = null;
        this._pendingResolveSeekPoint = null;

        this._statisticsReporter = null;
    }

    destroy() {
        this._mediaInfo = null;
        this._mediaDataSource = null;

        if (this._statisticsReporter) {
            this._disableStatisticsReporter();
        }
        if (this._ioctl) {
            this._ioctl.destroy();
            this._ioctl = null;
        }
        if (this._demuxer) {
            this._demuxer.destroy();
            this._demuxer = null;
        }
        if (this._remuxer) {
            this._remuxer.destroy();
            this._remuxer = null;
        }

        this._emitter.removeAllListeners();
        this._emitter = null;
    }

    on(event, listener) {
        this._emitter.addListener(event, listener);
    }

    off(event, listener) {
        this._emitter.removeListener(event, listener);
    }

    start() {
        this._loadSegment(0);
        this._enableStatisticsReporter();
    }

    _loadSegment(segmentIndex, optionalFrom) {
        this._currentSegmentIndex = segmentIndex;
        let dataSource = this._mediaDataSource.segments[segmentIndex];

        let ioctl = this._ioctl = new IOController(dataSource, this._config, segmentIndex);
        ioctl.onError = this._onIOException.bind(this);
        ioctl.onSeeked = this._onIOSeeked.bind(this);
        ioctl.onComplete = this._onIOComplete.bind(this);
        ioctl.onRedirect = this._onIORedirect.bind(this);
        ioctl.onRecoveredEarlyEof = this._onIORecoveredEarlyEof.bind(this);

        if (optionalFrom) {
            this._demuxer.bindDataSource(this._ioctl);
        } else {
            ioctl.onDataArrival = this._onInitChunkArrival.bind(this);
        }

        ioctl.open(optionalFrom);
    }

    stop() {
        this._internalAbort();
        this._disableStatisticsReporter();
    }

    _internalAbort() {
        if (this._ioctl) {
            this._ioctl.destroy();
            this._ioctl = null;
        }
    }

    pause() {  // take a rest
        if (this._ioctl && this._ioctl.isWorking()) {
            this._ioctl.pause();
            this._disableStatisticsReporter();
        }
    }

    resume() {
        if (this._ioctl && this._ioctl.isPaused()) {
            this._ioctl.resume();
            this._enableStatisticsReporter();
        }
    }

    seek(milliseconds) {
        if (this._mediaInfo == null || !this._mediaInfo.isSeekable()) {
            return;
        }

        let targetSegmentIndex = this._searchSegmentIndexContains(milliseconds);

        if (targetSegmentIndex === this._currentSegmentIndex) {
            // intra-segment seeking
            let segmentInfo = this._mediaInfo.segments[targetSegmentIndex];

            if (segmentInfo == undefined) {
                // current segment loading started, but mediainfo hasn't received yet
                // wait for the metadata loaded, then seek to expected position
                this._pendingSeekTime = milliseconds;
            } else {
                let keyframe = segmentInfo.getNearestKeyframe(milliseconds);
                this._remuxer.seek(keyframe.milliseconds);
                this._ioctl.seek(keyframe.fileposition);
                // Will be resolved in _onRemuxerMediaSegmentArrival()
                this._pendingResolveSeekPoint = keyframe.milliseconds;
            }
        } else {
            // cross-segment seeking
            let targetSegmentInfo = this._mediaInfo.segments[targetSegmentIndex];

            if (targetSegmentInfo == undefined) {
                // target segment hasn't been loaded. We need metadata then seek to expected time
                this._pendingSeekTime = milliseconds;
                this._internalAbort();
                this._remuxer.seek();
                this._remuxer.insertDiscontinuity();
                this._loadSegment(targetSegmentIndex);
                // Here we wait for the metadata loaded, then seek to expected position
            } else {
                // We have target segment's metadata, direct seek to target position
                let keyframe = targetSegmentInfo.getNearestKeyframe(milliseconds);
                this._internalAbort();
                this._remuxer.seek(milliseconds);
                this._remuxer.insertDiscontinuity();
                this._demuxer.resetMediaInfo();
                this._demuxer.timestampBase = this._mediaDataSource.segments[targetSegmentIndex].timestampBase;
                this._loadSegment(targetSegmentIndex, keyframe.fileposition);
                this._pendingResolveSeekPoint = keyframe.milliseconds;
                this._reportSegmentMediaInfo(targetSegmentIndex);
            }
        }

        this._enableStatisticsReporter();
    }

    _searchSegmentIndexContains(milliseconds) {
        let segments = this._mediaDataSource.segments;
        let idx = segments.length - 1;

        for (let i = 0; i < segments.length; i++) {
            if (milliseconds < segments[i].timestampBase) {
                idx = i - 1;
                break;
            }
        }
        return idx;
    }

    _onInitChunkArrival(data, byteStart) {
        let consumed = 0;

        if (byteStart > 0) {
            // IOController seeked immediately after opened, byteStart > 0 callback may received
            this._demuxer.bindDataSource(this._ioctl);
            this._demuxer.timestampBase = this._mediaDataSource.segments[this._currentSegmentIndex].timestampBase;

            consumed = this._demuxer.parseChunks(data, byteStart);
        } else {
            // byteStart == 0, Initial data, probe it first
            let probeData = null;

            // Try probing input data as FLV first
            probeData = FLVDemuxer.probe(data);
            if (probeData.match) {
                // Hit as FLV
                this._setupFLVDemuxerRemuxer(probeData);
                consumed = this._demuxer.parseChunks(data, byteStart);
            }

            if (!probeData.match && !probeData.needMoreData) {
                // Non-FLV, try MPEG-TS probe
                probeData = TSDemuxer.probe(data);
                if (probeData.match) {
                    // Hit as MPEG-TS
                    this._setupTSDemuxerRemuxer(probeData);
                    consumed = this._demuxer.parseChunks(data, byteStart);
                }
            }

            if (!probeData.match && !probeData.needMoreData) {
                // Both probing as FLV / MPEG-TS failed, report error
                probeData = null;
                Log.e(this.TAG, 'Non MPEG-TS/FLV, Unsupported media type!');
                Promise.resolve().then(() => {
                    this._internalAbort();
                });
                this._emitter.emit(TransmuxingEvents.DEMUX_ERROR, DemuxErrors.FORMAT_UNSUPPORTED, 'Non MPEG-TS/FLV, Unsupported media type!');
                // Leave consumed as 0
            }
        }

        return consumed;
    }

    _setupFLVDemuxerRemuxer(probeData) {
        this._demuxer = new FLVDemuxer(probeData, this._config);

        if (!this._remuxer) {
            this._remuxer = new MP4Remuxer(this._config);
        }

        let mds = this._mediaDataSource;
        if (mds.duration != undefined && !isNaN(mds.duration)) {
            this._demuxer.overridedDuration = mds.duration;
        }
        if (typeof mds.hasAudio === 'boolean') {
            this._demuxer.overridedHasAudio = mds.hasAudio;
        }
        if (typeof mds.hasVideo === 'boolean') {
            this._demuxer.overridedHasVideo = mds.hasVideo;
        }

        this._demuxer.timestampBase = mds.segments[this._currentSegmentIndex].timestampBase;

        this._demuxer.onError = this._onDemuxException.bind(this);
        this._demuxer.onMediaInfo = this._onMediaInfo.bind(this);
        this._demuxer.onMetaDataArrived = this._onMetaDataArrived.bind(this);
        this._demuxer.onScriptDataArrived = this._onScriptDataArrived.bind(this);

        this._remuxer.bindDataSource(this._demuxer
                        .bindDataSource(this._ioctl
        ));

        this._remuxer.onInitSegment = this._onRemuxerInitSegmentArrival.bind(this);
        this._remuxer.onMediaSegment = this._onRemuxerMediaSegmentArrival.bind(this);
    }

    _setupTSDemuxerRemuxer(probeData) {
        let demuxer = this._demuxer = new TSDemuxer(probeData, this._config);

        if (!this._remuxer) {
            this._remuxer = new MP4Remuxer(this._config);
        }

        demuxer.onError = this._onDemuxException.bind(this);
        demuxer.onMediaInfo = this._onMediaInfo.bind(this);
        demuxer.onMetaDataArrived = this._onMetaDataArrived.bind(this);
        demuxer.onTimedID3Metadata = this._onTimedID3Metadata.bind(this);
        demuxer.onSMPTE2038Metadata = this._onSMPTE2038Metadata.bind(this);
        demuxer.onSCTE35Metadata = this._onSCTE35Metadata.bind(this);
        demuxer.onPESPrivateDataDescriptor = this._onPESPrivateDataDescriptor.bind(this);
        demuxer.onPESPrivateData = this._onPESPrivateData.bind(this);

        this._remuxer.bindDataSource(this._demuxer);
        this._demuxer.bindDataSource(this._ioctl);

        this._remuxer.onInitSegment = this._onRemuxerInitSegmentArrival.bind(this);
        this._remuxer.onMediaSegment = this._onRemuxerMediaSegmentArrival.bind(this);
    }

    _onMediaInfo(mediaInfo) {
        if (this._mediaInfo == null) {
            // Store first segment's mediainfo as global mediaInfo
            this._mediaInfo = Object.assign({}, mediaInfo);
            this._mediaInfo.keyframesIndex = null;
            this._mediaInfo.segments = [];
            this._mediaInfo.segmentCount = this._mediaDataSource.segments.length;
            Object.setPrototypeOf(this._mediaInfo, MediaInfo.prototype);
        }

        let segmentInfo = Object.assign({}, mediaInfo);
        Object.setPrototypeOf(segmentInfo, MediaInfo.prototype);
        this._mediaInfo.segments[this._currentSegmentIndex] = segmentInfo;

        // notify mediaInfo update
        this._reportSegmentMediaInfo(this._currentSegmentIndex);

        if (this._pendingSeekTime != null) {
            Promise.resolve().then(() => {
                let target = this._pendingSeekTime;
                this._pendingSeekTime = null;
                this.seek(target);
            });
        }
    }

    _onMetaDataArrived(metadata) {
        this._emitter.emit(TransmuxingEvents.METADATA_ARRIVED, metadata);
    }

    _onScriptDataArrived(data) {
        this._emitter.emit(TransmuxingEvents.SCRIPTDATA_ARRIVED, data);
    }

    _onTimedID3Metadata(timed_id3_metadata) {
        let timestamp_base = this._remuxer.getTimestampBase();
        if (timestamp_base == undefined) { return; }

        if (timed_id3_metadata.pts != undefined) {
            timed_id3_metadata.pts -= timestamp_base;
        }
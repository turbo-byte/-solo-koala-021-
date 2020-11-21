
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
import work from 'webworkify-webpack';
import Log from '../utils/logger.js';
import LoggingControl from '../utils/logging-control.js';
import TransmuxingController from './transmuxing-controller.js';
import TransmuxingEvents from './transmuxing-events.js';
import TransmuxingWorker from './transmuxing-worker.js';
import MediaInfo from './media-info.js';

class Transmuxer {

    constructor(mediaDataSource, config) {
        this.TAG = 'Transmuxer';
        this._emitter = new EventEmitter();

        if (config.enableWorker && typeof (Worker) !== 'undefined') {
            try {
                this._worker = work(require.resolve('./transmuxing-worker'));
                this._workerDestroying = false;
                this._worker.addEventListener('message', this._onWorkerMessage.bind(this));
                this._worker.postMessage({cmd: 'init', param: [mediaDataSource, config]});
                this.e = {
                    onLoggingConfigChanged: this._onLoggingConfigChanged.bind(this)
                };
                LoggingControl.registerListener(this.e.onLoggingConfigChanged);
                this._worker.postMessage({cmd: 'logging_config', param: LoggingControl.getConfig()});
            } catch (error) {
                Log.e(this.TAG, 'Error while initialize transmuxing worker, fallback to inline transmuxing');
                this._worker = null;
                this._controller = new TransmuxingController(mediaDataSource, config);
            }
        } else {
            this._controller = new TransmuxingController(mediaDataSource, config);
        }

        if (this._controller) {
            let ctl = this._controller;
            ctl.on(TransmuxingEvents.IO_ERROR, this._onIOError.bind(this));
            ctl.on(TransmuxingEvents.DEMUX_ERROR, this._onDemuxError.bind(this));
            ctl.on(TransmuxingEvents.INIT_SEGMENT, this._onInitSegment.bind(this));
            ctl.on(TransmuxingEvents.MEDIA_SEGMENT, this._onMediaSegment.bind(this));
            ctl.on(TransmuxingEvents.LOADING_COMPLETE, this._onLoadingComplete.bind(this));
            ctl.on(TransmuxingEvents.RECOVERED_EARLY_EOF, this._onRecoveredEarlyEof.bind(this));
            ctl.on(TransmuxingEvents.MEDIA_INFO, this._onMediaInfo.bind(this));
            ctl.on(TransmuxingEvents.METADATA_ARRIVED, this._onMetaDataArrived.bind(this));
            ctl.on(TransmuxingEvents.SCRIPTDATA_ARRIVED, this._onScriptDataArrived.bind(this));
            ctl.on(TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED, this._onTimedID3MetadataArrived.bind(this));
            ctl.on(TransmuxingEvents.SMPTE2038_METADATA_ARRIVED, this._onSMPTE2038MetadataArrived.bind(this));
            ctl.on(TransmuxingEvents.SCTE35_METADATA_ARRIVED, this._onSCTE35MetadataArrived.bind(this));
            ctl.on(TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR, this._onPESPrivateDataDescriptor.bind(this));
            ctl.on(TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED, this._onPESPrivateDataArrived.bind(this));
            ctl.on(TransmuxingEvents.STATISTICS_INFO, this._onStatisticsInfo.bind(this));
            ctl.on(TransmuxingEvents.RECOMMEND_SEEKPOINT, this._onRecommendSeekpoint.bind(this));
        }
    }

    destroy() {
        if (this._worker) {
            if (!this._workerDestroying) {
                this._workerDestroying = true;
                this._worker.postMessage({cmd: 'destroy'});
                LoggingControl.removeListener(this.e.onLoggingConfigChanged);
                this.e = null;
            }
        } else {
            this._controller.destroy();
            this._controller = null;
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

    hasWorker() {
        return this._worker != null;
    }

    open() {
        if (this._worker) {
            this._worker.postMessage({cmd: 'start'});
        } else {
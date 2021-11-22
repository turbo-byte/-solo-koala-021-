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

import Log from '../utils/logger.js';
import SpeedSampler from './speed-sampler.js';
import {LoaderStatus, LoaderErrors} from './loader.js';
import FetchStreamLoader from './fetch-stream-loader.js';
import MozChunkedLoader from './xhr-moz-chunked-loader.js';
import MSStreamLoader from './xhr-msstream-loader.js';
import RangeLoader from './xhr-range-loader.js';
import WebSocketLoader from './websocket-loader.js';
import RangeSeekHandler from './range-seek-handler.js';
import ParamSeekHandler from './param-seek-handler.js';
import {RuntimeException, IllegalStateException, InvalidArgumentException} from '../utils/exception.js';

/**
 * DataSource: {
 *     url: string,
 *     filesize: number,
 *     cors: boolean,
 *     withCredentials: boolean
 * }
 * 
 */

// Manage IO Loaders
class IOController {

    constructor(dataSource, config, extraData) {
        this.TAG = 'IOController';

        this._config = config;
        this._extraData = extraData;

        this._stashInitialSize = 64 * 1024;  // default initial size: 64KB
        if (config.stashInitialSize != undefined && config.stashInitialSize > 0) {
            // apply from config
            this._stashInitialSize = config.stashInitialSize;
        }

        this._stashUsed = 0;
        this._stashSize = this._stashInitialSize;
        this._bufferSize = 1024 * 1024 * 3;  // initial size: 3MB
        this._stashBuffer = new ArrayBuffer(this._bufferSize);
        this._stashByteStart = 0;
        this._enableStash = true;
        if (config.enableStashBuffer === false) {
            this._enableStash = false;
        }

        this._loader = null;
        this._loaderClass = null;
        this._seekHandler = null;

        this._dataSource = dataSource;
        this._isWebSocketURL = /wss?:\/\/(.+?)/.test(dataSource.url);
        this._refTotalLength = dataSource.filesize ? dataSource.filesize : null;
        this._totalLength = this._refTotalLength;
        this._fullRequestFlag = false;
        this._currentRange = null;
        this._redirectedURL = null;

        this._speedNormalized = 0;
        this._speedSampler = new SpeedSampler();
        this._speedNormalizeList = [32, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096];

        this._isEarlyEofReconnecting = false;

        this._paused = false;
        this._resumeFrom = 0;

        this._onDataArrival = null;
        this._onSeeked = null;
        this._onError = null;
        this._onComplete = null;
        this._onRedirect = null;
        this._onRecoveredEarlyEof = null;

        this._selectSeekHandler();
        this._selectLoader();
        this._createLoader();
    }

    destroy() {
        if (this._loader.isWorking()) {
            this._loader.abort();
        }
        this._loader.destroy();
        this._loader = null;
        this._loaderClass = null;
        this._dataSource = null;
        this._stashBuffer = null;
        this._stashUsed = this._stashSize = this._bufferSize = this._stashByteStart = 0;
        this._currentRange = null;
        this._speedSampler = null;

        this._isEarlyEofReconnecting = false;

        this._onDataArrival = null;
        this._onSeeked = null;
        this._onError = null;
        this._onComplete = null;
        this._onRedirect = null;
        this._onRecoveredEarlyEof = null;

        this._extraData = null;
    }

    isWorking() {
        return this._loader && this._loader.isWorking() && !this._paused;
    }

    isPaused() {
        return this._paused;
    }

    get status() {
        return this._loader.status;
    }

    get extraData() {
        return this._extraData;
    }

    set extraData(data) {
        this._extraData = data;
    }

    // prototype: function onDataArrival(chunks: ArrayBuffer, byteStart: number): number
    get onDataArrival() {
        return this._onDataArrival;
    }

    set onDataArrival(callback) {
        this._onDataArrival = callback;
    }

    get onSeeked() {
        return this._onSeeked;
    }

    set onSeeked(callback) {
        this._onSeeked = callback;
    }

    // prototype: function onError(type: number, info: {code: number, msg: string}): void
    get onError() {
        return this._onError;
    }

    set onError(callback) {
        this._onError = callback;
    }

    get onComplete() {
        return this._onComplete;
    }

    set onComplete(callback) {
        this._onComplete = callback;
    }

    get onRedirect() {
        return this._onRedirect;
    }

    set onRedirect(callback) {
        this._onRedirect = callback;
    }

    get onRecoveredEarlyEof() {
        return this._onRecoveredEarlyEof;
    }

    set onRecoveredEarlyEof(callback) {
        this._onRecoveredEarlyEof = callback;
    }

    get currentURL() {
        return this._dataSource.url;
    }

    get hasRedirect() {
        return (this._redirectedURL != null || this._dataSource.redirectedURL != undefined);
    }

    get currentRedirectedURL() {
        return this._redirectedURL || this._dataSource.redirectedURL;
    }

    // in KB/s
    get currentSpeed() {
        if (this._loaderClass === RangeLoader) {
            // SpeedSampler is inaccuracy if loader is RangeLoader
            return this._loader.currentSpeed;
        }
        return this._speedSampler.lastSecondKBps;
    }

    get loaderType() {
        return this._loader.type;
    }

    _selectSeekHandler() {
        let config = this._config;

        if (config.seekType === 'range') {
            this._seekHandler = new RangeSeekHandler(this._config.rangeLoadZeroStart);
        } else if (config.seekType === 'param') {
            let paramStart = config.seekParamStart || 'bstart';
            let paramEnd = config.seekParamEnd || 'bend';

            this._seekHandler = new ParamSeekHandler(paramStart, paramEnd);
        } else if (config.seekType === 'custom') {
            if (typeof config.customSeekHandler !== 'function') {
                throw new InvalidArgumentException('Custom seekType specified in config but invalid customSeekHandler!');
            }
            this._seekHandler = new config.customSeekHandler();
        } else {
            throw new InvalidArgumentException(`Invalid seekType in config: ${config.seekType}`);
        }
    }

    _selectLoader() {
        if (this._config.customLoader != null) {
            this._loaderClass = this._config.customLoader;
        } else if (this._isWebSocketURL) {
            this._loaderClass = WebSocketLoader;
        } else if (FetchStreamLoader.isSupported()) {
            this._loaderClass = FetchStreamLoader;
        } else if (MozChunkedLoader.isSupported()) {
            this._loaderClass = MozChunkedLoader;
        } else if (RangeLoader.isSupported()) {
            this._loaderClass = RangeLoader;
        } else {
            throw new RuntimeException('Your browser doesn\'t support xhr with arraybuffer responseType!');
        }
    }

    _createLoader() {
        this._loader = new this._loaderClass(this._seekHandler, this._config);
        if (this._loader.needStashBuffer === false) {
            this._enableStash = false;
        }
        this._loader.onContentLengthKnown = this._onContentLengthKnown.bind(this);
    
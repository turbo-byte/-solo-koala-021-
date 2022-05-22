
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
import PlayerEvents from './player-events.js';
import Transmuxer from '../core/transmuxer.js';
import TransmuxingEvents from '../core/transmuxing-events.js';
import MSEController from '../core/mse-controller.js';
import MSEEvents from '../core/mse-events.js';
import {ErrorTypes, ErrorDetails} from './player-errors.js';
import {createDefaultConfig} from '../config.js';
import {InvalidArgumentException, IllegalStateException} from '../utils/exception.js';

class MSEPlayer {

    constructor(mediaDataSource, config) {
        this.TAG = 'MSEPlayer';
        this._type = 'MSEPlayer';
        this._emitter = new EventEmitter();

        this._config = createDefaultConfig();
        if (typeof config === 'object') {
            Object.assign(this._config, config);
        }

        let typeLowerCase = mediaDataSource.type.toLowerCase();
        if (typeLowerCase !== 'mse'
                && typeLowerCase !== 'mpegts'
                && typeLowerCase !== 'm2ts'
                && typeLowerCase !== 'flv') {
            throw new InvalidArgumentException('MSEPlayer requires an mpegts/m2ts/flv MediaDataSource input!');
        }

        if (mediaDataSource.isLive === true) {
            this._config.isLive = true;
        }

        this.e = {
            onvLoadedMetadata: this._onvLoadedMetadata.bind(this),
            onvSeeking: this._onvSeeking.bind(this),
            onvCanPlay: this._onvCanPlay.bind(this),
            onvStalled: this._onvStalled.bind(this),
            onvProgress: this._onvProgress.bind(this)
        };

        if (self.performance && self.performance.now) {
            this._now = self.performance.now.bind(self.performance);
        } else {
            this._now = Date.now;
        }

        this._pendingSeekTime = null;  // in seconds
        this._requestSetTime = false;
        this._seekpointRecord = null;
        this._progressChecker = null;

        this._mediaDataSource = mediaDataSource;
        this._mediaElement = null;
        this._msectl = null;
        this._transmuxer = null;

        this._mseSourceOpened = false;
        this._hasPendingLoad = false;
        this._receivedCanPlay = false;

        this._mediaInfo = null;
        this._statisticsInfo = null;

        let chromeNeedIDRFix = (Browser.chrome &&
                               (Browser.version.major < 50 ||
                               (Browser.version.major === 50 && Browser.version.build < 2661)));
        this._alwaysSeekKeyframe = (chromeNeedIDRFix || Browser.msedge || Browser.msie) ? true : false;

        if (this._alwaysSeekKeyframe) {
            this._config.accurateSeek = false;
        }
    }

    destroy() {
        if (this._progressChecker != null) {
            window.clearInterval(this._progressChecker);
            this._progressChecker = null;
        }
        if (this._transmuxer) {
            this.unload();
        }
        if (this._mediaElement) {
            this.detachMediaElement();
        }
        this.e = null;
        this._mediaDataSource = null;

        this._emitter.removeAllListeners();
        this._emitter = null;
    }

    on(event, listener) {
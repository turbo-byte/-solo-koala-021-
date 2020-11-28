
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
import LoggingControl from '../utils/logging-control.js';
import Polyfill from '../utils/polyfill.js';
import TransmuxingController from './transmuxing-controller.js';
import TransmuxingEvents from './transmuxing-events.js';

/* post message to worker:
   data: {
       cmd: string
       param: any
   }

   receive message from worker:
   data: {
       msg: string,
       data: any
   }
 */

let TransmuxingWorker = function (self) {

    let TAG = 'TransmuxingWorker';
    let controller = null;
    let logcatListener = onLogcatCallback.bind(this);

    Polyfill.install();

    self.addEventListener('message', function (e) {
        switch (e.data.cmd) {
            case 'init':
                controller = new TransmuxingController(e.data.param[0], e.data.param[1]);
                controller.on(TransmuxingEvents.IO_ERROR, onIOError.bind(this));
                controller.on(TransmuxingEvents.DEMUX_ERROR, onDemuxError.bind(this));
                controller.on(TransmuxingEvents.INIT_SEGMENT, onInitSegment.bind(this));
                controller.on(TransmuxingEvents.MEDIA_SEGMENT, onMediaSegment.bind(this));
                controller.on(TransmuxingEvents.LOADING_COMPLETE, onLoadingComplete.bind(this));
                controller.on(TransmuxingEvents.RECOVERED_EARLY_EOF, onRecoveredEarlyEof.bind(this));
                controller.on(TransmuxingEvents.MEDIA_INFO, onMediaInfo.bind(this));
                controller.on(TransmuxingEvents.METADATA_ARRIVED, onMetaDataArrived.bind(this));
                controller.on(TransmuxingEvents.SCRIPTDATA_ARRIVED, onScriptDataArrived.bind(this));
                controller.on(TransmuxingEvents.TIMED_ID3_METADATA_ARRIVED, onTimedID3MetadataArrived.bind(this));
                controller.on(TransmuxingEvents.SMPTE2038_METADATA_ARRIVED, onSMPTE2038MetadataArrived.bind(this));
                controller.on(TransmuxingEvents.SCTE35_METADATA_ARRIVED, onSCTE35MetadataArrived.bind(this));
                controller.on(TransmuxingEvents.PES_PRIVATE_DATA_DESCRIPTOR, onPESPrivateDataDescriptor.bind(this));
                controller.on(TransmuxingEvents.PES_PRIVATE_DATA_ARRIVED, onPESPrivateDataArrived.bind(this));
                controller.on(TransmuxingEvents.STATISTICS_INFO, onStatisticsInfo.bind(this));
                controller.on(TransmuxingEvents.RECOMMEND_SEEKPOINT, onRecommendSeekpoint.bind(this));
                break;
            case 'destroy':
                if (controller) {
                    controller.destroy();
                    controller = null;
                }
                self.postMessage({msg: 'destroyed'});
                break;
            case 'start':
                controller.start();
                break;
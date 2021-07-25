
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
import AMF from './amf-parser.js';
import SPSParser from './sps-parser.js';
import DemuxErrors from './demux-errors.js';
import MediaInfo from '../core/media-info.js';
import {IllegalStateException} from '../utils/exception.js';
import H265Parser from './h265-parser.js';
import buffersAreEqual from '../utils/typedarray-equality.ts';

function Swap16(src) {
    return (((src >>> 8) & 0xFF) |
            ((src & 0xFF) << 8));
}

function Swap32(src) {
    return (((src & 0xFF000000) >>> 24) |
            ((src & 0x00FF0000) >>> 8)  |
            ((src & 0x0000FF00) << 8)   |
            ((src & 0x000000FF) << 24));
}

function ReadBig32(array, index) {
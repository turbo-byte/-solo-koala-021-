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
import decodeUTF8 from '../utils/utf8-conv.js';
import {IllegalStateException} from '../utils/exception.js';

let le = (function () {
    let buf = new ArrayBuffer(2);
    (new DataView(buf)).setInt16(0, 256, true);  // little-endian write
    return (new Int16Array(buf))[0] === 256;  // platform-spec read, if equal then LE
})();

class AMF {

    static parseScriptData(arrayBuffer, dataOffset, dataSize) {
        let data = {};

        try {
            let name = AMF.parseValue(arrayBuffer, dataOffset, dataSize);
            let value = AMF.parseValue(arrayBuffer, dataOffset + name.size, dataSize - name.size);

            data[name.data] = value.data;
        } catch (e) {
            Log.e('AMF', e.toString());
        }

        return data;
    }

    static parseObject(arrayBuffer, dataOffset, dataSize) {
        if (dataSize < 3) {
            throw new IllegalStateException('Data not enough when parse ScriptDataObject');
        }
        let name = AMF.parseString(arrayBuffer, dataOffset, dataSize);
        let value = AMF.parseValue(arrayBuffer, dataOffset + name.size, dataSize - name.size);
        let isObjectEnd = value.objectEnd;

        return {
            data: {
                name: name.data,
                value: value.data
            },
            size: name.size + value.size,
            objectEnd: isObjectEnd
        };
    }

    static parseVariable(arrayBuffer, dataOffset, dataSize) {
        return AMF.parseObject(arrayBuffer, dataOffset, dataSize);
    }

    static parseString(arrayBuffer, dataOffset, dataSize) {
        if (dataSize < 2) {
            throw new IllegalStateException('Data not enough when parse String');
        }
        let v = new DataView(arrayBuffer,
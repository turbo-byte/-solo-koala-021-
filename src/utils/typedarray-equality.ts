/*
 * Copyright (C) 2022 magicxqq. All Rights Reserved.
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

function isAligned16(a: Uint8Array) : boolean {
    return a.byteOffset % 2 === 0 && a.byteLength % 2 === 0;
}

function isAligned32(a: Uint8Array) : boolean {
    return a.byteOffset % 4 === 0 && a.byteLength % 4 === 0;
}

function compareArray(a: Uint8Array | Uint16Array | Uint32Array,
                      b: Uint8Array | Uint16Array | Uint32Array): boolean {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function equal8(a: Uint8A
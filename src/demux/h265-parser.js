/*
 * Copyright (C) 2022 もにょてっく. All Rights Reserved.
 *
 * @author もにょ〜ん <monyone.teihen@gmail.com>
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

import ExpGolomb from './exp-golomb.js';

class H265NaluParser {

    static _ebsp2rbsp(uint8array) {
        let src = uint8array;
        let src_length = src.byteLength;
        let dst = new Uint8Array(src_length);
        let dst_idx = 0;

        for (let i = 0; i < src_length; i++) {
            if (i >= 2) {
                // Unescape: Skip 0x03 after 00 00
                if (src[i] === 0x03 && src[i - 1] === 0x00 && src[i - 2] === 0x00) {
                    continue;
                }
            }
            dst[dst_idx] = src[i];
            dst_idx++;
        }

        return new Uint8Array(dst.buffer, 0, dst_idx);
    }

    static parseVPS(uint8array) {
        let rbsp = H265NaluParser._ebsp2rbsp(uint8array);
        let gb = new ExpGolomb(rbsp);

        /* remove NALu Header */
        gb.readByte();
        gb.readByte();

        // VPS
        let video_parameter_set_id = gb.readBits(4);
        gb.readBits(2);
        let max_layers_minus1 = gb.readBits(6);
        let max_sub_layers_minus1 = gb.readBits(3);
        let temporal_id_nesting_flag = gb.readBool();
        // and more ...

        return {
            num_temporal_layers: max_sub_layers_minus1 + 1,
            temporal_id_nested: temporal_id_nesting_flag
        }
    }

    static parseSPS(uint8array) {
        let rbsp = H265NaluParser._ebsp2rbsp(uint8array);
        let gb = new ExpGolomb(rbsp);

        /* remove NALu Header */
        gb.readByte();
        gb.readByte();

        let left_offset = 0, right_offset = 0, top_offset = 0, bottom_offset = 0;

        // SPS
        let video_paramter_set_id = gb.readBits(4);
        let max_sub_layers_minus1 = gb.readBits(3);
        let temporal_id_nesting_flag = gb.readBool();

        // profile_tier_level begin
        let general_profile_space = gb.readBits(2);
        let general_tier_flag = gb.readBool();
        let general_profile_idc = gb.readBits(5);
        let general_profile_compatibility_flags_1 = gb.readByte();
        let general_profile_compatibility_flags_2 = gb.readByte();
        let general_profile_compatibility_flags_3 = gb.readByte();
        let general_profile_compatibility_flags_4 = gb.readByte();
        let general_constraint_indicator_flags_1 = gb.readByte();
        let general_constraint_indicator_flags_2 = gb.readByte();
        let general_constraint_indicator_flags_3 = gb.readByte();
        let general_constraint_indicator_flags_4 = gb.readByte();
        let general_constraint_indicator_flags_5 = gb.readByte();
        let general_constraint_indicator_flags_6 = gb.readByte();
        let general_level_idc = gb.readByte();
        let sub_layer_profile_present_flag = [];
        let sub_layer_level_present_flag = [];
        for (let i = 0; i < max_sub_layers_minus1; i++) {
            sub_layer_profile_pr
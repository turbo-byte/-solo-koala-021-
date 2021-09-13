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
            sub_layer_profile_present_flag.push(gb.readBool());
            sub_layer_level_present_flag.push(gb.readBool());
        }
        if (max_sub_layers_minus1 > 0) {
            for (let i = max_sub_layers_minus1; i < 8; i++) { gb.readBits(2); }
        }
        for (let i = 0; i < max_sub_layers_minus1; i++) {
            if (sub_layer_profile_present_flag[i]) {
                gb.readByte(); // sub_layer_profile_space, sub_layer_tier_flag, sub_layer_profile_idc
                gb.readByte(); gb.readByte(); gb.readByte(); gb.readByte(); // sub_layer_profile_compatibility_flag
                gb.readByte(); gb.readByte(); gb.readByte(); gb.readByte(); gb.readByte(); gb.readByte();
            }
            if (sub_layer_level_present_flag[i]) {
                gb.readByte();
            }
        }
        // profile_tier_level end

        let seq_parameter_set_id = gb.readUEG();
        let chroma_format_idc = gb.readUEG();
        if (chroma_format_idc == 3) {
            gb.readBits(1);  // separate_colour_plane_flag
        }
        let pic_width_in_luma_samples = gb.readUEG();
        let pic_height_in_luma_samples = gb.readUEG();
        let conformance_window_flag = gb.readBool();
        if (conformance_window_flag) {
            left_offset += gb.readUEG();
            right_offset += gb.readUEG();
            top_offset += gb.readUEG();
            bottom_offset += gb.readUEG();
        }
        let bit_depth_luma_minus8 = gb.readUEG();
        let bit_depth_chroma_minus8 = gb.readUEG();
        let log2_max_pic_order_cnt_lsb_minus4 = gb.readUEG();
        let sub_layer_ordering_info_present_flag = gb.readBool();
        for (let i = sub_layer_ordering_info_present_flag ? 0 : max_sub_layers_minus1; i <= max_sub_layers_minus1; i++) {
            gb.readUEG(); // max_dec_pic_buffering_minus1[i]
            gb.readUEG(); // max_num_reorder_pics[i]
            gb.readUEG(); // max_latency_increase_plus1[i]
        }
        let log2_min_luma_coding_block_size_minus3 = gb.readUEG();
        let log2_diff_max_min_luma_coding_block_size = gb.readUEG();
        let log2_min_transform_block_size_minus2 = gb.readUEG();
        let log2_diff_max_min_transform_block_size = gb.readUEG();
        let max_transform_hierarchy_depth_inter = gb.readUEG();
        let max_transform_hierarchy_depth_intra = gb.readUEG();
        let scaling_list_enabled_flag = gb.readBool();
        if (scaling_list_enabled_flag) {
            let sps_scaling_list_data_present_flag = gb.readBool();
            if (sps_scaling_list_data_present_flag) {
                for (let sizeId = 0; sizeId < 4; sizeId++) {
                    for(let matrixId = 0; matrixId < ((sizeId === 3) ? 2 : 6); matrixId++){
                        let scaling_list_pred_mode_flag = gb.readBool();
                        if (!scaling_list_pred_mode_flag) {
                            gb.readUEG(); // scaling_list_pred_matrix_id_delta
                        } else {
                            let coefNum = Math.min(64, (1 << (4 + (sizeId << 1))));
                            if (sizeId > 1) { gb.readSEG() }
                            for (let i = 0; i < coefNum; i++) { gb.readSEG(); }
                        }
                    }
                }
            }
        }
        let amp_enabled_flag = gb.readBool();
        let sample_adaptive_offset_enabled_flag = gb.readBool();
        let pcm_enabled_flag = gb.readBool();
        if (pcm_enabled_flag) {
            gb.readByte();
            gb.readUEG();
            gb.readUEG();
            gb.readBool();
        }
        let num_short_term_ref_pic_sets = gb.readUEG();
        let num_delta_pocs = 0;
        for (let i = 0; i < num_short_term_ref_pic_sets; i++) {
            let inter_ref_pic_set_prediction_flag = false;
            if (i !== 0) { inter_ref_pic_set_prediction_flag = gb.readBool(); }
            if (inter_ref_pic_set_prediction_flag) {
                if (i === num_short_term_ref_pic_sets) { gb.readUEG(); }
                gb.readBool();
                gb.readUEG();
                let next_num_delta_pocs = 0;
                for (let j = 0; j <= num_delta_pocs; j++) {
                    let used_by_curr_pic_flag = gb.readBool();
                    let use_delta_flag = false;
                    if (!used_by_curr_pic_flag) {
                        use_delta_flag = gb.readBool();
                    }
                    if (used_by_curr_pic_flag || use_delta_flag) {
                        next_num_delta_pocs++;
                    }
                }
                num_delta_pocs = next_num_delta_pocs;
            } else {
                let num_negative_pics = gb.readUEG();
                let num_positive_pics = gb.readUEG();
                num_delta_pocs = num_negative_pics + num_positive_pics;
                for (let j = 0; j < num_negative_pics; j++) {
                    gb.readUEG();
                    gb.readBool();
                }
                for (let j = 0; j < num_positive_pics; j++) {
                    gb.readUEG();
                    gb.readBool();
                }
            }
        }
        let long_term_ref_pics_present_flag = gb.readBool();
        if (long_term_ref_pics_present_flag) {
            let num_long_term_ref_pics_sps = gb.readUEG();
            for (let i = 0; i < num_long_term_ref_pics_sps; i++) {
                for (let j = 0; j < (log2_max_pic_order_cnt_lsb_minus4 + 4); j++) { gb.readBits(1); }
                gb.readBits(1);
            }
        }
        //*
        let default_display_window_flag = false; // for calc offset
        let min_spatial_segmentation_idc = 0; // for hvcC
        let sar_width = 1, sar_height = 1;
        let fps_fixed = false, fps_den = 1, fps_num = 1;
        //*/
        let sps_temporal_mvp_enabled_flag = gb.readBool();
        let strong_intra_smoothing_enabled_flag = gb.readBool();
        let vui_parameters_present_flag = gb.readBool();
        if (vui_parameters_present_flag) {
            let aspect_ratio_info_present_flag = gb.readBool();
            if (aspect_ratio_info_present_flag) {
                let aspect_ratio_idc = gb.readByte();

                let sar_w_table = [1, 12, 10, 16, 40, 24, 20, 32, 80, 18, 15, 64, 160, 4, 3, 2];
                let sar_h_table = [1, 11, 11, 11, 33, 11, 11, 11, 33, 11, 11, 33,  99, 3, 2, 1];

                if (aspect_ratio_idc > 0 && aspect_ratio_idc < 16) {
                    sar_width = sar_w_table[aspect_ratio_idc - 1];
                    sar_height = sar_h_table[aspect_ratio_idc - 1];
                } else if (aspect_ratio_idc === 255) {
                    sar_width = gb.readBits(16);
                    sar_height = gb.readBits(16);
                }
            }
            let overscan_info_present_flag = gb.readBool();
            if (overscan_info_present_flag) {
                gb.readBool();
            }
            let video_signal_type_present_flag = gb.readBool();
            if (video_signal_type_present_flag) {
                gb.readBits(3);
                gb.readBool();
                let colour_description_present_flag = gb.readBool();
                if (colour_description_present_flag) {
                    gb.readByte();
                    gb.readByte();
                    gb.readByte();
                }
            }
            let chroma_loc_info_present_flag = gb.readBool();
            if (chroma_loc_info_present_flag) {
                gb.readUEG();
                gb.readUEG();
            }
            let neutral_chroma_indication_flag = gb.readBool();
            let field_seq_flag = gb.readBool();
            let frame_field_info_present_flag = gb.readBool();
            default_display_window_flag = gb.readBool();
            if (default_display_window_flag) {
                left_offset += gb.readUEG();
                right_offset += gb.readUEG();
                top_offset += gb.readUEG();
                bottom_offset += gb.readUEG();
            }
            let vui_timing_info_present_flag = gb.readBool();
            if (vui_timing_info_present_flag) {
                fps_den = gb.readBits(32);
                fps_num = gb.readBits(32);
                let vui_poc_proportional_to_timing_flag = gb.readBool();
                if (vui_poc_proportional_to_timing_flag) {
                    gb.readUEG();
                    let vui_hrd_parameters_present_flag = gb.readBool();
                    if (vui_hrd_parameters_present_flag) {
                        let commonInfPresentFlag = 1;
                        let nal_hrd_parameters_present_flag = false;
                        let vcl_hrd_parameters_present_flag = false;
                        let sub_pic_hrd_params_present_flag = false;
                        if (commonInfPresentFlag) {
                            nal_hrd_parameters_present_flag = gb.readBool();
                            vcl_hrd_parameters_present_flag = gb.readBool();
                            if( nal_hrd_parameters_present_flag || vcl_hrd_parameters_present_flag ){
                                sub_pic_hrd_params_present_flag = gb.readBool();
                                if (sub_pic_hrd_params_present_flag) {
                                    gb.readByte();
                                    gb.readBits(5);
                                    gb.readBool();
                                    gb.readBits(5);
                                }
                                let bit_rate_scale = gb.readBits(4);
                                let cpb_size_scale = gb.readBits(4);
                                if (sub_pic_hrd_params_present_flag) {
                                    gb.readBits(4);
                                }
                                gb.readBits(5);
                                gb.readBits(5);
                                gb.readBits(5);
                            }
                        }
                        for (let i = 0; i <= max_sub_layers_minus1; i++) {
                            let fixed_pic_rate_general_flag = gb.readBool();
                            fps_fixed = fixed_pic_rate_general_flag;
                            let fixed_pic_rate_within_cvs_flag = false;
                            let cpbCnt = 1;
                            if (!fixed_pic_rate_general_flag) {
                                fixed_pic_rate_within_cvs_flag = gb.readBool();
                            }
                            let low_delay_hrd_flag = false;
                            if (fixed_pic_rate_within_cvs_flag) {
                                gb.readSEG();
                            } else {
                                low_delay_hrd_flag = gb.readBool();
                            }
                            if (!low_delay_hrd_flag) {
                                cpbCnt = gb.readUEG() + 1;
                            }
                            if (nal_hrd_parameters_present_flag) {
                                for (let j = 0; j < cpbCnt; j++) {
                                    gb.readUEG(); gb.readUEG();
                                    if (sub_pic_hrd_params_present_flag) {
                                        gb.readUEG(); gb.readUEG();
                                    }
                                }
                            }
                            if (vcl_hrd_parameters_present_flag) {
                                for (let j = 0; j < cpbCnt; j++) {
                                    gb.readUEG(); gb.readUEG();
                                    if (sub_pic_hrd_params_present_flag) {
                                        gb.readUEG(); gb.readUEG();
                                    }
                                }
                            }
                        }
                    }
                }
            }
            let bitstream_restriction_flag = gb.readBool();
            if (bitstream_restriction_flag) {
                let tiles_fixed_structure_flag = gb.readBool()
                let motion_vectors_over_pic_boundaries_flag = gb.readBool()
                let restricted_ref_pic_lists_flag = gb.readBool();
                min_spatial_segmentation_idc = gb.readUEG();
                let max_bytes_per_pic_denom = gb.readUEG();
                let max_bits_per_min_cu_denom = gb.readUEG();
                let log2_max_mv_length_horizontal = gb.readUEG();
                let log2_max_mv_length_vertical = gb.readUEG();
            }
        }
        let sps_extension_flag = gb.readBool(); // ignore...

        // for meta data
        let codec_mimetype = `hvc1.${general_profile_idc}.1.L${general_level_idc}.B0`;
        let codec_width = pic_width_in_luma_samples;
        let codec_height = pic_height_in_luma_samples;
        let sar_scale = 1;
        if (sar_width !== 1 && sar_height !== 1) {
            sar_scale = sar_width / sar_height;
        }

        gb.destroy();
        gb = null;

        return {
            codec_mimetype,
            level_string: H265NaluParser.getLevelString(general_level_idc),
            profile_idc: general_profile_idc,
            bit_depth: bit_depth_luma_minus8 + 8,
        
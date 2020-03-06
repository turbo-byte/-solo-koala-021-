mpegts.js  [![npm](https://img.shields.io/npm/v/mpegts.js.svg?style=flat)](https://www.npmjs.com/package/mpegts.js)
======
[日本語](README_ja.md)

mpegts.js 是在 HTML5 上直接播放 MPEG2-TS 流的播放器，针对低延迟直播优化，可用于 DVB/ISDB 数字电视流或监控摄像头等的低延迟回放。

mpegts.js 基于 [flv.js](https://github.com/bilibili/flv.js) 改造而来。

## Overview
mpegts.js 通过在 JavaScript 中渐进化解析 MPEG2-TS 流并实时转封装为 ISO BMFF (Fragmented MP4)，然后通过 [Media Source Extensions][] 把音视频数据喂入 HTML5 `<video>` 元素。

[Media Source Extensions]: https://w3c.github.io/media-source/

## News
H.265/HEVC 播放支持（FLV 或 MPEG-TS 均已支持）已在 v1.7.0 版本登场！

## Demo
[http://xqq.github.io/mpegts.js/demo/](http://xqq.github.io/mpegts.js/demo/)

## Features
- 回放 http(s) 或 WebSocket 上承载的 H.264 + AAC 编码的 MPEG2-TS 流
- 超低延迟，最佳情况延迟可低达 1 秒以内
- 回放 TS packet 为 192 字节的 `.m2ts` 文件（BDAV/BDMV）或 204 字节的 TS 流
- 支持动态编码参数切换，如视频分辨率动态变化
- 支持 Chrome, FireFox, Safari, Edg
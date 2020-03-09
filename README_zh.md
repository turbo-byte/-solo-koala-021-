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
- 支持 Chrome, FireFox, Safari, Edge (Old or Chromium) 或任何基于 Chromium 的浏览器
- 支持对 HTMLMediaElement 内部缓冲的自动延迟追赶
- 极低的 CPU 使用率和内存使用量（单个实例约使用 JS 堆 10MiB）
- 支持 PES private data 回调 (stream_type=0x06)，如 ARIB B24 字幕 （可配合 [aribb24.js][]）
- 支持 Timed ID3 Metadata (stream_type=0x15) 回调 (TIMED_ID3_METADATA_ARRIVED)

[aribb24.js]: https://github.com/monyone/aribb24.js

## CORS
若在与页面不同的独立的服务器串流，必须设置 CORS 的 `Access-Control-Allow-Origin` 头。

参阅 [cors.md](docs/cors.md)。

## Installation
```bash
npm install --save mpegts.js
```

## Build
```bash
npm install                 # install dev-dependences
npm install -g webpack-cli  # install build tool
npm run build               # packaged & minimized js will be emitted in dist folder
```

若在中国大陆可尝试 [cnpm](https://github.com/cnpm/cnpm) 镜像。

## Getting Started
```html
<script src="mpegts.js"></script>
<video id="videoElement"></video>
<script>
    if (mpegts.getFeatureList().mseLivePlayback) {
        var videoElement = document.getElementById('videoElement');
        var player = mpegts.createPlayer({
            type: 'mse',  // could also be mpegts, m2ts, flv
            
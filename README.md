mpegts.js  [![npm](https://img.shields.io/npm/v/mpegts.js.svg?style=flat)](https://www.npmjs.com/package/mpegts.js)
======
[日本語](README_ja.md)  [中文说明](README_zh.md)

HTML5 MPEG2-TS stream player written in TypeScript & JavaScript.

mpegts.js is optimized for low-latency live stream playback, such as DVB/ISDB television or surveillance cameras.

This project is based on [flv.js](https://github.com/bilibili/flv.js).

## Overview
mpegts.js works by transmuxing MPEG2-TS stream into ISO BMFF (Fragmented MP4) segments, followed by feeding mp4 segments into an HTML5 `<video>` element through [Media Source Extensions][] API.

[Media Source Extensions]: https://w3c.github.io/media-source/

## News
H.265/HEVC over MPEG-TS/FLV support has been introduced in v1.7.0!

## Demo
[http://xqq.github.io/mpegts.js/demo/](http://xqq.github.io/mpegts.js/demo/)

[demo with aribb24.js](http://xqq.github.io/mpegts.js/demo/arib.html)

## Features
- Playback for MPEG2-TS stream with H.264/H.265 + AAC codec transported in http(s) or WebSocket
- Playback for FLV stream with H.264/H.265 + AAC codec transported in http(s) or WebSocket
- Extremely low latency of less than 1 second in the best case
- Playback for `.m2ts` file like BDAV/BDMV with 192 bytes TS packet, or 204 bytes TS packet
- Support handling dynamic codec parameters change (e.g. video resolution change)
- Support Chrome, FireFox, Safari, Edge (Old or Chromium) or any Chromium-based browsers
- Support chasing latency automatically for internal buffer of HTMLMediaElement
- Low CPU overhead and low memory usage (JS heap takes about 10MiB for each instance)
- Support extracting PES private data (stream_type=0x06) like ARIB B24 subtitles (with [aribb24.js][])
- Support Timed ID3 Metadata (stream_type=0x15) callback (TIMED_ID3_METADATA_ARRIVED)

[aribb24.js]: https://github.com/monyone/aribb24.js

## CORS
If you use standalone video server
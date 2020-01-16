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
H.265/HEVC over MPEG-TS/FLV support has been introduced in
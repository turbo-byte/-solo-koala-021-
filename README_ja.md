
mpegts.js  [![npm](https://img.shields.io/npm/v/mpegts.js.svg?style=flat)](https://www.npmjs.com/package/mpegts.js)
======
MPEG2-TS ストリームを HTML5 上で再生するビデオプレーヤーです。

mpegts.js はライブ配信に対し、低遅延再生のために最適化しています。DVB/ISDB のテレビチャンネルや監視カメラの映像等を低遅延で再生可能になります。

mpegts.js は [flv.js](https://github.com/bilibili/flv.js) を基づいて作ってきたものです。

## Overview
mpegts.js は、JavaScript で MPEG2-TS ストリームを解析しながら、映像と音声のデータを ISO BMFF (fmp4) フォーマットのフラグメントにリマックスして、[Media Source Extensions][] を通じて `<video>` 要素に提供することで再生することにしています。

[Media Source Extensions]: https://w3c.github.io/media-source/

## News
H.265/HEVC 再生支援（over FLV/MPEG-TS）は v1.7.0 から導入されています。

## Demo
[http://xqq.github.io/mpegts.js/demo/](http://xqq.github.io/mpegts.js/demo/)

[demo with aribb24.js](http://xqq.github.io/mpegts.js/demo/arib.html)

## Features
- http(s) または WebSocket で伝送する H.264 + AAC の MPEG2-TS ストリームが再生可能
- 最良の場合は 1 秒以内の低遅延が達成可能
- TS packet が 192 bytes の `.m2ts` ファイル（BDAV/BDMV）、または 204 bytes も再生可能
- 動的パラメータ切り替えが可能 （例えば、映像解像度が途中に切り替わっても再生します）
- Chrome, FireFox, Safari, Edge (Old or Chromium) または Chromium-based ブラウザで実行可能
- HTMLMediaElement 内部バッファーの遅延を追いかける機能
- 低い CPU 使用率とメモリ使用量 （1つのインスタンスが概ね 10MiB のメモリかかります）
- ARIB-B24 字幕等の PES private data (stream_type=0x06) が抽出可能 （[aribb24.js][] と共同運用可能）
- Timed ID3 Metadata (stream_type=0x15) のコールバック支援 (TIMED_ID3_METADATA_ARRIVED)

[aribb24.js]: https://github.com/monyone/aribb24.js

## CORS
MPEG2-TS ストリームが別のサーバー上にある場合、`Access-Control-Allow-Origin` は必須です。

[cors.md](docs/cors.md) を参照してください。

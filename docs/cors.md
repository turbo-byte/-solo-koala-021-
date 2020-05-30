
CORS Configuration
==================
Anytime you want to play an MPEG2-TS/FLV stream from another `Origin`, the server must response with a CORS header:

```
Access-Control-Allow-Origin: <your-origin> | *
```

For example, if an html on your site `http://flvplayback.com` want's to play an MPEG2-TS/FLV from another `Origin` like `http://cdn.flvplayback.com`, the video server must response with the following CORS header:

```
Access-Control-Allow-Origi
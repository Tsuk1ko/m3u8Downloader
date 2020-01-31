# m3u8 Downloader

Use node.js download m3u8 to mp4

Promise support

Need ffmpeg

## how to use

```javascript
const download = require('m3u8-downloader');

download({
    url: 'https://yun.kubozy-youku-163.com/20190709/16666_5a9c65b6/1000k/hls/index.m3u8',
    processNum: 8,
    filePath: 'video'
});
```

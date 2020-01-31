const request = require('request');
const fs = require('fs-extra');
const URL = require('url');
const md5 = require('md5');
const { exec } = require('child_process');
const path = require('path');
const utils = require('./utils');

module.exports = opts =>
  new Promise((resolve, reject) => {
    let maxPN = 8;
    let processNum = 0;
    let tsCount = 0;
    let tsList = [];
    let tsOutPuts = [];
    let downloadedNum = 0;
    let url = '';
    let rootPath = '';
    let dir = '';
    let filmName = 'result';
    let ffmpeg = 'ffmpeg';

    function download() {
      ffmpeg = opts.ffmpeg || ffmpeg;
      maxPN = opts.processNum || maxPN;
      url = opts.url;
      filmName = opts.filmName || md5(url);
      rootPath = opts.filePath;
      dir = path.join(rootPath, filmName);

      if (!fs.existsSync(ffmpeg)) {
        utils.log(`\n[error] ffmpeg not found\n`);
        reject();
        return;
      }

      if (fs.existsSync(`${rootPath}/${filmName}.mp4`)) {
        utils.log(`\n[exist] ${filmName}\n`);
        resolve();
        return;
      }

      fs.ensureDirSync(dir);
      request(url, (err, res, body) => {
        if (err) {
          utils.logError(`problem with request: ${err.message}`);
          return;
        }
        parseM3U8(body);
      });
    }

    function parseM3U8(content) {
      utils.log('starting parsing m3u8 file');
      tsList = content.match(/((http|https):\/\/.*)|(.+\.ts)/g);
      if (!tsList) {
        utils.logError('m3u8 file error');
        utils.log(content);
        return;
      }
      tsCount = tsList.length;
      if (tsCount > 0) {
        processNum = tsCount > maxPN ? maxPN : tsCount;
      }
      tsOutPuts = [];
      const urlObj = URL.parse(url);
      const host = `${urlObj.protocol}//${urlObj.host}`;
      const urlPath = url.substr(0, url.lastIndexOf('/') + 1);

      for (let i = 0; i < tsCount; i++) {
        if (tsList[i].indexOf('http') < 0) {
          if (tsList[i].indexOf('/') === 0) {
            tsList[i] = host + tsList[i];
          } else {
            tsList[i] = urlPath + tsList[i];
          }
        }
        const tsOut = `${dir}/${i}.ts`;
        tsList[i] = {
          index: i,
          url: tsList[i],
          file: tsOut,
        };
        tsOutPuts.push(tsOut);
      }
      batchDownload();
    }

    function batchDownload() {
      for (let i = 0; i < processNum; i++) {
        downloadTs(i);
      }
    }

    function downloadTs(index) {
      if (index >= tsCount) {
        return;
      }
      const tsObj = tsList[index];
      utils.log(`start download ts${tsObj.index}`);
      const opt = {
        method: 'GET',
        url: tsObj.url,
        timeout: 100000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
        },
        encoding: null,
      };
      request(opt, (error, response, buff) => {
        if (error) {
          utils.logError(`download failed ts${tsObj.index}\nerror: ${error.message}`);
          downloadTs(index);
        } else if (response.statusCode === 200) {
          fs.writeFile(tsObj.file, buff, error2 => {
            if (error2) {
              utils.logError(`download failed ts${tsObj.index}\nerror: ${error2.message}`);
              downloadTs(index);
            } else {
              downloadedNum++;
              utils.log(`download ts${tsObj.index} sucess, ${downloadedNum}/${tsCount}`);
              checkIfDone();
              downloadTs(index + processNum);
            }
          });
        }
      });
    }

    function checkIfDone() {
      if (downloadedNum === tsCount) {
        convertTS();
      }
    }

    let mp4Num = 0;
    let mp4DoneNum = 0;
    let toConcat = [];

    function convertTS() {
      toConcat = utils.arrayChunk(tsOutPuts, 100);
      utils.log('concat ts to mp4');
      mp4Num = toConcat.length;
      doConvert(0);
    }

    function doConvert(index) {
      if (mp4Num === mp4DoneNum) {
        concatMP4();
      } else {
        const outPutMP4 = `${dir}/output${index}.mp4`;
        const strConcat = toConcat[index].join('|');
        if (strConcat !== '') {
          if (fs.existsSync(outPutMP4)) {
            fs.unlinkSync(outPutMP4);
          }
          const cmd = `${ffmpeg} -i "concat:${strConcat}" -acodec copy -vcodec copy -absf aac_adtstoasc ${outPutMP4}`;
          exec(cmd, error => {
            if (error) {
              utils.logError(`ffmpeg mp4 ${index} error: ${error.message}`);
              doConvert(index);
            }
            utils.log(`ffmpeg mp4 ${index} success`);
            mp4DoneNum++;
            doConvert(index + 1);
          });
        }
      }
    }

    function concatMP4() {
      const lastMP4 = `${rootPath}/${filmName}.mp4`;
      if (mp4Num > 1) {
        let filelist = '';
        for (let i = 0; i < mp4Num; i++) {
          const output = `output${i}.mp4`;
          filelist += `file ${path.join(dir, output).replace(/\\/g, '/')}\n`;
        }
        const filePath = path.join(dir, 'filelist.txt');
        fs.writeFileSync(filePath, filelist);
        const cmd = `${ffmpeg} -f concat -i ${filePath} -c copy ${lastMP4}`;
        exec(cmd, error => {
          if (error) {
            utils.logError(`ffmpeg mp4ALL error: ${error.message}`);
            reject();
            return;
          }
          utils.log('ffmpeg mp4ALL success');
          deleteTS();
        });
      } else {
        fs.rename(path.join(dir, 'output0.mp4'), lastMP4, err => {
          if (err) {
            utils.logError(`rename last mp4 error: ${err.message}`);
            reject();
            return;
          }
          deleteTS();
        });
      }
    }

    function deleteTS() {
      fs.removeSync(dir);
      utils.log(`\n[success] ${filmName}\n`);
      resolve();
    }

    download();
  });

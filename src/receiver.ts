const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const uuid = require('uuid/v4');
import { sizeof } from './common';

const OSS_THRESHOLD = 3e6;

type AliyunCallback = (error: any, response: any) => any;

export function initReceiver(): {
  receive: (event: string) => Promise<any>;
  reply: (callback: AliyunCallback) => (returnValue: string) => Promise<void>;
} {
  const cwd = process.cwd();
  const config = JSON.parse(
    fs.readFileSync(path.join(cwd, './.fc-config.json')).toString()
  );

  config.fc.region = config.fc.region + '-internal';
  config.oss.region = config.oss.region + '-internal';

  const ossClient = new OSS(config.oss);

  const receive = async (event: string) => {
    const { storeType, body } = JSON.parse(event);

    if (storeType === 'oss') {
      const bodyString = (await ossClient.get(body)).content.toString();
      ossClient.delete(body).catch(console.error);
      return bodyString;
    }

    return body;
  };

  const reply = (callback: AliyunCallback) => {
    return async (returnValue: string) => {
      if (sizeof(returnValue) > OSS_THRESHOLD) {
        const filePath = uuid();
        await ossClient.put(filePath, Buffer.from(returnValue));
        const body = {
          storeType: 'oss',
          body: filePath,
        };
        callback(null, body);
        return;
      }
      callback(null, {
        storeType: 'direct',
        body: returnValue,
      });
    };
  };

  return { receive, reply };
}
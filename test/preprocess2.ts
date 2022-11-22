import * as fs from 'fs';
import * as readline from 'readline';
import {
  AllTestResult,
  CacheActionChain,
  DOUBLE_ACTION_RES_FILE,
  logTest,
  logTestReset,
  SINGLE_ACTION_RES_FILE,
} from './const';

export type ExecuteResultKey = Array<{
  text: string;
  cursorLine: number;
  cursorCharacter: number;
  mode: string;
}>;

export default async function preprocess2() {
  const doubleActionRes = await readActionRes(DOUBLE_ACTION_RES_FILE);
  const singleActionRes = await readActionRes(SINGLE_ACTION_RES_FILE);

  const resMap = new Map<string, CacheActionChain[]>();
  for (const actionRes of doubleActionRes) {
    const resultkey: ExecuteResultKey = actionRes.result.map((v) => {
      return {
        text: v.text,
        cursorCharacter: v.position.character,
        cursorLine: v.position.line,
        mode: v.mode,
      };
    });
    const target = resMap.get(JSON.stringify(resultkey));
    if (target) {
      target.push(actionRes.cacheAction);
    } else {
      resMap.set(JSON.stringify(resultkey), [actionRes.cacheAction]);
    }
  }

  for (const actionRes of singleActionRes) {
    const resultkey: ExecuteResultKey = actionRes.result.map((v) => {
      return {
        text: v.text,
        cursorCharacter: v.position.character,
        cursorLine: v.position.line,
        mode: v.mode,
      };
    });
    const target = resMap.get(JSON.stringify(resultkey));
    if (target) {
      target.push(actionRes.cacheAction);
    } else {
      resMap.set(JSON.stringify(resultkey), [actionRes.cacheAction]);
    }
  }

  const recommendAction = new Map<CacheActionChain, CacheActionChain>();
  const tmp = [];
  for (const [k, v] of resMap) {
    if (v.length === 1) continue;

    // キーの押す回数が最も少ないものを探す
    let minKeyLength = Infinity;
    let minIdx = -1;
    for (let i = 0; i < v.length; i++) {
      const cacheActionChain = v[i];
      const keyLength = cacheActionChain.reduce((sum, v) => sum + v.pressKeys.length, 0);
      if (keyLength < minKeyLength) {
        minKeyLength = keyLength;
        minIdx = i;
      }
    }

    for (const cacheActionChain of v) {
      recommendAction.set(cacheActionChain, v[minIdx]);
      tmp.push([cacheActionChain, v[minIdx]]);
    }
  }

  logTestReset();
  await logTest(JSON.stringify(tmp));

  // return recommendAction
}

async function readActionRes(filename: string) {
  const stream = fs.createReadStream(filename, {
    encoding: 'utf8',
    highWaterMark: 1024,
  });
  const reader = readline.createInterface({ input: stream });
  const executeResult = await new Promise<AllTestResult[]>((resolve) => {
    const res: AllTestResult[] = [];
    reader.on('line', (v) => {
      const obj = JSON.parse(v) as AllTestResult[];
      res.push(...obj);
    });
    reader.on('close', () => {
      resolve(res);
    });
  });
  return executeResult;
}

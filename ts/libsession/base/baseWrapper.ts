import type { MergeStructVector, StringVector } from '@session-foundation/libsession-wasm';
import { to_hex } from 'libsodium-wrappers-sumo';
import { getLibSessionInstance } from '../libsession';

export function buildUserMergeVector(
  incomingConfigMessages: Array<{
    data: Uint8Array<ArrayBuffer>;
    hash: string;
  }>
): MergeStructVector {
  const libsession = getLibSessionInstance();

  const wasmHexVector = new libsession.MergeStructVector();
  incomingConfigMessages.forEach(m => {
    wasmHexVector.push_back({
      dataHex: to_hex(m.data),
      hash: m.hash,
    });
  });
  return wasmHexVector;
}

type WasmToJsTypes<T extends StringVector> = T extends StringVector ? string : never;

export function wasmVectorToArray<T extends StringVector>(content: T): Array<WasmToJsTypes<T>> {
  const result: Array<WasmToJsTypes<T>> = [];
  for (let index = 0; index < content.size(); index++) {
    const element = content.get(index);
    if (!element) {
      continue;
    }
    result.push(element.toString() as WasmToJsTypes<T>);
  }
  return result;
}

export function stringArrayToWasmVector(content: Array<string>): StringVector {
  const libsession = getLibSessionInstance();
  const wasmVector = new libsession.StringVector();
  content.forEach(m => {
    wasmVector.push_back(m);
  });
  return wasmVector;
}

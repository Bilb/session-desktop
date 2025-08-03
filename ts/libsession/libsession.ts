import MainModuleFactory, { EmbindModule } from '@session-foundation/libsession-wasm';

let libsessionInstance: EmbindModule | null = null;

export async function libsessionReady() {
  if (!libsessionInstance) {
    libsessionInstance = await MainModuleFactory();
  }
  return libsessionInstance;
}

export function getLibSessionInstance() {
  if (!libsessionInstance) {
    throw new Error('libsession not ready. call and await libsessionReady first');
  }
  return libsessionInstance;
}

export type LibsessionType = EmbindModule;

import type { GroupPubkeyType } from 'libsession_util_nodejs';
import type {
  AsyncObjectWrapper,
  ConfigDumpDataNode,
  ConfigDumpRow,
} from '../../types/sqlSharedTypes';
// eslint-disable-next-line import/no-unresolved, import/extensions
import type { ConfigWrapperObjectTypesMeta } from '../../webworker/workers/browser/libsession_worker_functions';
import { channels } from '../channels';
import { cleanData } from '../dataUtils';

export const ConfigDumpData: AsyncObjectWrapper<ConfigDumpDataNode> = {
  getByVariantAndPubkey: (variant: ConfigWrapperObjectTypesMeta, pubkey: string) => {
    return channels.getByVariantAndPubkey(variant, pubkey);
  },
  saveConfigDump: (dump: ConfigDumpRow) => {
    return channels.saveConfigDump(cleanData(dump));
  },
  getAllDumpsWithData: () => {
    return channels.getAllDumpsWithData();
  },
  getAllDumpsWithoutData: () => {
    return channels.getAllDumpsWithoutData();
  },
  getAllDumpsWithoutDataFor: (pk: string) => {
    return channels.getAllDumpsWithoutDataFor(pk);
  },
  deleteDumpFor: (pk: GroupPubkeyType) => {
    return channels.deleteDumpFor(pk);
  },
};

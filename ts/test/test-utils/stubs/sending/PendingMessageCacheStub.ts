import { PendingMessageCache } from '../../../../session/sending';
import type { OutgoingRawMessage } from '../../../../session/types';

export class PendingMessageCacheStub extends PendingMessageCache {
  public dbData: Array<OutgoingRawMessage>;
  constructor(dbData: Array<OutgoingRawMessage> = []) {
    super();
    this.dbData = dbData;
  }

  public getCache(): Readonly<Array<OutgoingRawMessage>> {
    return this.cache;
  }

  protected async getFromStorage() {
    return this.dbData;
  }

  // biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
  protected async saveToDB() {}
}

import { type PubkeyType } from 'libsession_util_nodejs';
import { ConversationModel } from '../../../models/conversation';
import { PubKey } from '../../types';
import { LibsessionUtilUserWasm } from '../../../libsession/user/userWrappers';

/**
 * Returns true if that conversation is not us, is private, is not blinded.
 *
 * We want to sync the message request status so we need to allow a contact even if it's not approved, did not approve us and is not blocked.
 */
function isContactToStoreInWrapper(convo: ConversationModel): boolean {
  try {
    PubKey.cast(convo.id);
  } catch (e) {
    return false;
  }
  return !convo.isMe() && convo.isPrivate() && convo.isActive() && PubKey.is05Pubkey(convo.id);
}

async function removeContactFromWrapper(id: PubkeyType) {
  try {
    LibsessionUtilUserWasm.getUserContacts().erase(id);
  } catch (e) {
    window.log.warn(`ContactsWrapperActions.erase of ${id} failed with ${e.message}`);
  }
}

export const SessionUtilContact = {
  isContactToStoreInWrapper,
  removeContactFromWrapper,
};

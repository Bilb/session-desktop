import { createSelector } from '@reduxjs/toolkit';
import type { ConfirmModalState } from '../../ducks/modalDialog';
import type { ModalsState, TermsOfServicePrivacyModalState } from '../ducks/modals';
import type { OnboardingStoreState } from '../store';

const getModals = (state: OnboardingStoreState): ModalsState => {
  return state.modals;
};

export const getQuitModalState = createSelector(
  getModals,
  (state: ModalsState): ConfirmModalState => state.quitModalState
);

export const getTermsOfServicePrivacyModalState = createSelector(
  getModals,
  (state: ModalsState): TermsOfServicePrivacyModalState => state.termsOfServicePrivacyModalState
);

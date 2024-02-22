import React, { SessionDataTestId } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';

import { resetConversationExternal } from '../../state/ducks/conversations';
import { recoveryPhraseModal, updateDeleteAccountModal } from '../../state/ducks/modalDialog';
import {
  SectionType,
  setLeftOverlayMode,
  showLeftPaneSection,
  showSettingsSection,
} from '../../state/ducks/section';
import { getFocusedSettingsSection } from '../../state/selectors/section';
import { SessionIcon } from '../icon';
import { SessionSettingCategory } from '../settings/SessionSettings';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';

const StyledSettingsSectionTitle = styled.strong`
  font-family: var(--font-accent), var(--font-default);
  font-size: var(--font-size-md);
`;

const StyledSettingsListItem = styled.div<{ active: boolean }>`
  background-color: ${props =>
    props.active
      ? 'var(--settings-tab-background-selected-color)'
      : 'var(--settings-tab-background-color)'};
  color: var(--settings-tab-text-color);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  height: 74px;
  line-height: 1.4;
  padding: 0px var(--margins-md);
  flex-shrink: 0;
  cursor: pointer;
  transition: var(--default-duration) !important;

  :hover {
    background: var(--settings-tab-background-hover-color);
  }
`;

const getCategories = () => {
  return [
    {
      id: 'privacy' as const,
      title: window.i18n('privacySettingsTitle'),
    },
    {
      id: 'notifications' as const,
      title: window.i18n('notificationsSettingsTitle'),
    },
    {
      id: 'conversations' as const,
      title: window.i18n('conversationsSettingsTitle'),
    },
    {
      id: 'messageRequests' as const,
      title: window.i18n('openMessageRequestInbox'),
    },
    {
      id: 'appearance' as const,
      title: window.i18n('appearanceSettingsTitle'),
    },
    {
      id: 'permissions' as const,
      title: window.i18n('permissionsSettingsTitle'),
    },
    {
      id: 'help' as const,
      title: window.i18n('helpSettingsTitle'),
    },
    {
      id: 'recoveryPhrase' as const,
      title: window.i18n('recoveryPhrase'),
    },
    {
      id: 'ClearData' as const,
      title: window.i18n('clearDataSettingsTitle'),
    },
  ].map(m => ({ ...m, dataTestId: `${m.id}-settings-menu-item` as const }));
};

const LeftPaneSettingsCategoryRow = (props: {
  item: {
    id: SessionSettingCategory;
    title: string;
    dataTestId: SessionDataTestId;
  };
}) => {
  const { item } = props;
  const { id, title } = item;
  const dispatch = useDispatch();
  const focusedSettingsSection = useSelector(getFocusedSettingsSection);

  const isClearData = id === 'ClearData';

  return (
    <StyledSettingsListItem
      data-testid={item.dataTestId}
      key={id}
      active={id === focusedSettingsSection}
      role="link"
      onClick={() => {
        switch (id) {
          case 'messageRequests':
            dispatch(showLeftPaneSection(SectionType.Message));
            dispatch(setLeftOverlayMode('message-requests'));
            dispatch(resetConversationExternal());
            break;
          case 'recoveryPhrase':
            dispatch(recoveryPhraseModal({}));
            break;
          case 'ClearData':
            dispatch(updateDeleteAccountModal({}));
            break;
          default:
            dispatch(showSettingsSection(id));
        }
      }}
    >
      <StyledSettingsSectionTitle style={{ color: isClearData ? 'var(--danger-color)' : 'unset' }}>
        {title}
      </StyledSettingsSectionTitle>

      {id === focusedSettingsSection && (
        <SessionIcon iconSize="medium" iconType="chevron" iconRotation={270} />
      )}
    </StyledSettingsListItem>
  );
};

const LeftPaneSettingsCategories = () => {
  const categories = getCategories();

  return (
    <>
      {categories.map(item => {
        return <LeftPaneSettingsCategoryRow key={item.id} item={item} />;
      })}
    </>
  );
};
const StyledContentSection = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
`;

export const LeftPaneSettingSection = () => {
  return (
    <StyledContentSection>
      <LeftPaneSectionHeader />
      <StyledContentSection>
        <LeftPaneSettingsCategories />
      </StyledContentSection>
    </StyledContentSection>
  );
};

import React from 'react';
import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../../basic/Flex';
import { SessionIconButton } from '../../icon';
import { SubtitleStrings, SubtitleStringsType } from './ConversationHeaderTitle';

function loadDataTestId(currentSubtitle: SubtitleStringsType) {
  if (currentSubtitle === 'disappearingMessages') {
    return 'disappear-messages-type-and-time';
  }

  return 'conversation-header-subtitle';
}

export const StyledSubtitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  min-width: 230px;

  div:first-child {
    span:last-child {
      margin-bottom: 0;
    }
  }
`;

const StyledSubtitleDot = styled.span<{ active: boolean }>`
  border-radius: 50%;
  background-color: ${props =>
    props.active ? 'var(--text-primary-color)' : 'var(--text-secondary-color)'};

  height: 5px;
  width: 5px;
  margin: 0 2px;
`;

const SubtitleDotMenu = ({
  options,
  selectedOptionIndex,
  style,
}: {
  options: Array<string | null>;
  selectedOptionIndex: number;
  style: CSSProperties;
}) => (
  <Flex container={true} alignItems={'center'} style={style}>
    {options.map((option, index) => {
      if (!option) {
        return null;
      }

      return (
        <StyledSubtitleDot
          key={`subtitleDotMenu-${option}-${index}`}
          active={selectedOptionIndex === index}
        />
      );
    })}
  </Flex>
);

type ConversationHeaderSubtitleProps = {
  subtitlesArray: Array<SubtitleStringsType>;
  subtitleStrings: SubtitleStrings;
  currentSubtitle: SubtitleStringsType;
  setCurrentSubtitle: (index: SubtitleStringsType) => void;
  onClickFunction: () => void;
  showDisappearingMessageIcon: boolean;
};

export const ConversationHeaderSubtitle = (props: ConversationHeaderSubtitleProps) => {
  const {
    subtitlesArray,
    subtitleStrings,
    currentSubtitle,
    setCurrentSubtitle,
    onClickFunction,
    showDisappearingMessageIcon,
  } = props;

  const handleTitleCycle = (direction: 1 | -1) => {
    let newIndex = subtitlesArray.indexOf(currentSubtitle) + direction;
    if (newIndex > subtitlesArray.length - 1) {
      newIndex = 0;
    }

    if (newIndex < 0) {
      newIndex = subtitlesArray.length - 1;
    }

    if (subtitlesArray[newIndex]) {
      setCurrentSubtitle(subtitlesArray[newIndex]);
    }
  };

  return (
    <StyledSubtitleContainer>
      <Flex
        container={true}
        flexDirection={'row'}
        justifyContent={subtitlesArray.length < 2 ? 'center' : 'space-between'}
        alignItems={'center'}
        width={'100%'}
      >
        <SessionIconButton
          iconColor={'var(--button-icon-stroke-selected-color)'}
          iconSize={'small'}
          iconType="chevron"
          iconRotation={90}
          margin={'0 3px 0 0'}
          onClick={() => {
            handleTitleCycle(-1);
          }}
          isHidden={subtitlesArray.length < 2}
          tabIndex={0}
        />
        {showDisappearingMessageIcon && (
          <SessionIconButton
            iconColor={'var(--button-icon-stroke-selected-color)'}
            iconSize={'tiny'}
            iconType="timer50"
            margin={'0 var(--margins-xs) 0 0'}
          />
        )}
        <span
          role="button"
          className="module-conversation-header__title-text"
          onClick={onClickFunction}
          onKeyPress={(e: any) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onClickFunction();
            }
          }}
          tabIndex={0}
          data-testid={loadDataTestId(currentSubtitle)}
        >
          {subtitleStrings[currentSubtitle]}
        </span>
        <SessionIconButton
          iconColor={'var(--button-icon-stroke-selected-color)'}
          iconSize={'small'}
          iconType="chevron"
          iconRotation={270}
          margin={'0 0 0 3px'}
          onClick={() => {
            handleTitleCycle(1);
          }}
          isHidden={subtitlesArray.length < 2}
          tabIndex={0}
        />
      </Flex>
      <SubtitleDotMenu
        options={subtitlesArray}
        selectedOptionIndex={subtitlesArray.indexOf(currentSubtitle)}
        style={{ display: subtitlesArray.length < 2 ? 'none' : undefined, margin: '8px 0' }}
      />
    </StyledSubtitleContainer>
  );
};

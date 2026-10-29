import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TOPICS } from './data/topics';
import { IntroductionPage } from './components/IntroductionPage';
import { TopicOnePage } from './components/TopicOnePage';
import { TrigramAnalysisPage } from './components/TrigramAnalysisPage';
import { InvertedReturnDecoderPage } from './components/InvertedReturnDecoderPage';
import { ScrollingWindowPage } from './components/ScrollingWindowPage';
import { VisualPlotterPage } from './components/VisualPlotterPage';
import { RoadmapPage } from './components/RoadmapPage';
import { INVERTED_RETURN_PATTERN } from './utils/decoderUtils';
import {
  DEFAULT_EYE_INVERSION,
  type SixEyePattern,
  type EyeInversionSettings,
} from './utils/orientationExtractor';

export const App: React.FC = () => {
  const [activeTopicId, setActiveTopicId] = useState<string>('intro');
  const [pattern, setPattern] = useState<SixEyePattern>(INVERTED_RETURN_PATTERN);
  const [eyeInversion, setEyeInversion] = useState<EyeInversionSettings>(DEFAULT_EYE_INVERSION);
  const [stepMode, setStepMode] = useState<'non_overlapping' | 'overlapping'>('non_overlapping');

  const currentTopic = TOPICS.find((t) => t.id === activeTopicId) || TOPICS[0];

  return (
    <div className="app-container">
      <Sidebar activeTopicId={activeTopicId} onSelectTopic={setActiveTopicId} />
      <div className="main-viewport">
        {activeTopicId === 'intro' && (
          <IntroductionPage onSelectTopic={setActiveTopicId} />
        )}
        {activeTopicId === 'topic-1' && (
          <TopicOnePage onSelectTopic={setActiveTopicId} />
        )}
        {activeTopicId === 'topic-2' && (
          <TrigramAnalysisPage
            onSelectTopic={setActiveTopicId}
            pattern={pattern}
            onChangePattern={setPattern}
            eyeInversion={eyeInversion}
            onChangeEyeInversion={setEyeInversion}
            stepMode={stepMode}
            onChangeStepMode={setStepMode}
          />
        )}
        {activeTopicId === 'topic-3' && (
          <InvertedReturnDecoderPage
            onBackToTopicTwo={() => setActiveTopicId('topic-2')}
            pattern={pattern}
            onChangePattern={setPattern}
            eyeInversion={eyeInversion}
            onChangeEyeInversion={setEyeInversion}
            stepMode={stepMode}
            onChangeStepMode={setStepMode}
          />
        )}
        {activeTopicId === 'topic-4' && (
          <div className="topic-page">
            <header className="topic-header">
              <h1 className="topic-main-title">Scrolling Window & Modulo Playground</h1>
              <p className="topic-main-desc">
                Cumulative running sums, sliding rolling windows, modulo sweeps, and letter distribution shaping across the eye sequence.
              </p>
            </header>
            <ScrollingWindowPage
              pattern={pattern}
              onChangePattern={setPattern}
              eyeInversion={eyeInversion}
              onChangeEyeInversion={setEyeInversion}
              stepMode={stepMode}
              onChangeStepMode={setStepMode}
            />
          </div>
        )}
        {activeTopicId === 'topic-5' && (
          <div className="topic-page">
            <header className="topic-header">
              <h1 className="topic-main-title">Visual Plotter & Coordinate Grapher</h1>
              <p className="topic-main-desc">
                2D vector stroke turtle walks and experimental 3D turn-and-walk space tracers.
              </p>
            </header>
            <VisualPlotterPage
              pattern={pattern}
              onChangePattern={setPattern}
              eyeInversion={eyeInversion}
              onChangeEyeInversion={setEyeInversion}
              stepMode={stepMode}
              onChangeStepMode={setStepMode}
            />
          </div>
        )}
        {activeTopicId !== 'intro' && activeTopicId !== 'topic-1' && activeTopicId !== 'topic-2' && activeTopicId !== 'topic-3' && activeTopicId !== 'topic-4' && activeTopicId !== 'topic-5' && (
          <RoadmapPage
            topic={currentTopic}
            onGoToTopicOne={() => setActiveTopicId('topic-1')}
          />
        )}
      </div>
    </div>
  );
};

export default App;

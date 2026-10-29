import React, { useState } from 'react';
import { EyeViewer } from './EyeViewer';
import { CrossReferenceTable } from './CrossReferenceTable';
import { DataStructureView } from './DataStructureView';

interface TopicOnePageProps {
  onSelectTopic?: (topicId: string) => void;
}

export const TopicOnePage: React.FC<TopicOnePageProps> = ({ onSelectTopic }) => {
  const [activeSubTab, setActiveSubTab] = useState<'viewer' | 'crossref' | 'structure'>('viewer');

  return (
    <div className="topic-page">
      <header className="topic-header">
        <h1 className="topic-main-title">Image Extraction & Overlay</h1>
        <p className="topic-main-desc">
          Extracted values from <code>1x-eyes-east.png</code> and <code>1x-eyes-west.png</code>
        </p>

        <div className="subtab-nav">
          <button
            type="button"
            className={`subtab-btn ${activeSubTab === 'viewer' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('viewer')}
          >
            Image Viewer
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeSubTab === 'crossref' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('crossref')}
          >
            Cross-Reference
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeSubTab === 'structure' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('structure')}
          >
            Raw Data
          </button>
        </div>
      </header>

      <main className="topic-content">
        {activeSubTab === 'viewer' && <EyeViewer />}
        {activeSubTab === 'crossref' && <CrossReferenceTable />}
        {activeSubTab === 'structure' && (
          <DataStructureView
            onGoToTrigramAnalysis={onSelectTopic ? () => onSelectTopic('topic-2') : undefined}
          />
        )}
      </main>
    </div>
  );
};

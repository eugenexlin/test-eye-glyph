import React from 'react';
import type { TopicItem } from '../data/topics';
import styles from './RoadmapPage.module.css';
import controls from '../styles/controls.module.css';

interface RoadmapPageProps {
  topic: TopicItem;
  onGoToTopicOne: () => void;
}

export const RoadmapPage: React.FC<RoadmapPageProps> = ({ topic, onGoToTopicOne }) => {
  return (
    <div className="topic-page">
      <header className="topic-header">
        <h1 className="topic-main-title">{topic.title}</h1>
        <p className="topic-main-desc">{topic.subtitle}</p>
      </header>

      <main className="topic-content">
        <div className={styles.roadmapCard}>
          <h2>Overview</h2>
          <p>
            Tools and analyses planned for this section.
          </p>

          <div className={styles.roadmapSectionsGrid}>
            {topic.id === 'topic-2' && (
              <>
                <div className={styles.roadmapBlock}>
                  <h3>Frequency Analysis</h3>
                  <p>
                    Analyzing unigram, bigram, and trigram frequencies of the 5 pupil directions across all 9 messages.
                  </p>
                </div>
                <div className={styles.roadmapBlock}>
                  <h3>Base Encodings</h3>
                  <p>
                    Testing 2-digit quinary (base 25), 3-digit quinary (base 125), and 5-bit conversions against character tables.
                  </p>
                </div>
              </>
            )}

            {topic.id === 'topic-3' && (
              <>
                <div className={styles.roadmapBlock}>
                  <h3>Shared Sequences</h3>
                  <p>
                    Investigating why Messages 1, 2, and 3 share the exact 27-glyph sequence <code>1013223304041130232114313033</code>.
                  </p>
                </div>
                <div className={styles.roadmapBlock}>
                  <h3>Spatial Alignment</h3>
                  <p>
                    Overlaying East and West hexagonal matrices to test for spatial XOR and subtraction masks.
                  </p>
                </div>
              </>
            )}

            {topic.id === 'topic-4' && (
              <>
                <div className={styles.roadmapBlock}>
                  <h3>Cipher Testing</h3>
                  <p>
                    Testing substitution ciphers, polyalphabetic Vigenere shifts, autokey ciphers, and transposition matrices.
                  </p>
                </div>
                <div className={styles.roadmapBlock}>
                  <h3>Candidate Plaintexts</h3>
                  <p>
                    Scoring candidate decryptions against language quadgrams and community hypotheses.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className={styles.roadmapActionBox}>
            <button type="button" className={controls.btnPrimary} onClick={onGoToTopicOne}>
              View Image Viewer
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

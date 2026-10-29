import React from 'react';
import { TOPICS } from '../data/topics';
import styles from './Sidebar.module.css';

interface SidebarProps {
  activeTopicId: string;
  onSelectTopic: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTopicId, onSelectTopic }) => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h1 className={styles.siteTitle}>Noita Eye Glyphs</h1>
        <p className={styles.siteDesc}>the mysterious eye puzzle</p>
      </div>

      <nav className={styles.topicNav}>
        {TOPICS.map((topic) => {
          const isActive = topic.id === activeTopicId;
          return (
            <button
              key={topic.id}
              type="button"
              className={`${styles.topicCard} ${isActive ? styles.active : ''}`}
              onClick={() => onSelectTopic(topic.id)}
            >
              <div className={styles.topicTitle}>{topic.title}</div>
              <div className={styles.topicSubtitle}>{topic.subtitle}</div>
            </button>
          );
        })}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.metricBox}>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Messages</span>
            <span className={styles.metricVal}>9</span>
          </div>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Glyphs</span>
            <span className={styles.metricVal}>3,108</span>
          </div>
          <div className={styles.metricRow}>
            <span className={styles.metricLabel}>Alphabet</span>
            <span className={styles.metricVal}>Base 5 (0-4)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

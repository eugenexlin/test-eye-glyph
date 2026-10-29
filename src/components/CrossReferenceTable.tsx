import React, { useState } from 'react';
import { getMessageSummaries } from '../data/eyeDataset';
import type { EyeMessageSummary } from '../types/eye';
import styles from './CrossReferenceTable.module.css';
import controls from '../styles/controls.module.css';

export const CrossReferenceTable: React.FC = () => {
  const summaries = getMessageSummaries();
  const [selectedMessage, setSelectedMessage] = useState<EyeMessageSummary>(summaries[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const counts = [0, 1, 2, 3, 4].map((v) => {
    const c = selectedMessage.eyes.filter((e) => e.val === v).length;
    const pct = ((c / selectedMessage.charCount) * 100).toFixed(1);
    return { val: v, count: c, pct };
  });

  const fillClasses = [styles.fill0, styles.fill1, styles.fill2, styles.fill3, styles.fill4];

  return (
    <div className={styles.crossRefContainer}>
      <div className={styles.sectionIntro}>
        <h2>Comparison with noitaeye.txt</h2>
        <p>
          The lines in <code>noitaeye.txt</code> alternate between the East and West image sections.
        </p>
      </div>

      <div className={styles.tableResponsive}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th>Line</th>
              <th>Image</th>
              <th>Section</th>
              <th>Glyphs</th>
              <th>Reference</th>
              <th>Status</th>
              <th>Rows</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const isSelected = selectedMessage.messageIndex === s.messageIndex;
              return (
                <tr
                  key={s.messageIndex}
                  className={`${styles.tableRow} ${isSelected ? styles.rowSelected : ''}`}
                  onClick={() => setSelectedMessage(s)}
                >
                  <td className="font-mono font-bold">Line {s.messageIndex}</td>
                  <td>
                    <span className={`${styles.sourceTag} ${s.source === 'east' ? styles.tagEast : styles.tagWest}`}>
                      {s.source === 'east' ? 'East' : 'West'}
                    </span>
                  </td>
                  <td className="font-mono text-capitalize">{s.sectionName}</td>
                  <td className="font-mono">{s.charCount}</td>
                  <td className="font-mono">{s.noitaEyeString.length}</td>
                  <td>
                    <span className={styles.badgeMatch}>Match</span>
                  </td>
                  <td className="font-mono">{s.rowCount}</td>
                  <td>
                    <button
                      type="button"
                      className={controls.btnSm}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMessage(s);
                      }}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.messageDetailCard}>
        <div className={styles.messageDetailHeader}>
          <div>
            <h3>
              Message {selectedMessage.messageIndex}: {selectedMessage.sectionName.toUpperCase()} ({selectedMessage.charCount} glyphs)
            </h3>
            <p className={styles.subtitle}>
              {selectedMessage.source === 'east' ? 'East image' : 'West image'} | {selectedMessage.rowCount} rows
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={controls.btnSecondary}
              onClick={() => handleCopy(selectedMessage.rawString)}
            >
              {copied ? 'Copied' : 'Copy String'}
            </button>
          </div>
        </div>

        <div className={styles.distributionPanel}>
          <div className={styles.distTitle}>Digit Frequencies:</div>
          <div className={styles.distBars}>
            {counts.map((item) => (
              <div key={item.val} className={styles.distItem}>
                <span className={styles.distDigit}>Digit {item.val}:</span>
                <span className={styles.distCount}>
                  {item.count} ({item.pct}%)
                </span>
                <div className={styles.distBarTrack}>
                  <div
                    className={`${styles.distBarFill} ${fillClasses[item.val]}`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.searchFilterRow}>
          <label className={styles.searchLabel}>
            Filter:
            <input
              type="text"
              placeholder="e.g. 20101"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${styles.inputText} font-mono`}
            />
          </label>
          {searchQuery && (
            <span className={styles.searchMatches}>
              Matches: {selectedMessage.rawString.split(searchQuery).length - 1}
            </span>
          )}
        </div>

        <div className={`${styles.quinaryStreamBox} font-mono`}>
          {searchQuery ? (
            selectedMessage.rawString.split(searchQuery).map((part, i, arr) => (
              <React.Fragment key={i}>
                <span>{part}</span>
                {i < arr.length - 1 && <mark className={styles.highlightMark}>{searchQuery}</mark>}
              </React.Fragment>
            ))
          ) : (
            <span>{selectedMessage.rawString}</span>
          )}
        </div>
      </div>
    </div>
  );
};

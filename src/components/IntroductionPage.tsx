import React from "react";
import { DEFAULT_INTRODUCTION_CONTENT } from "../data/introductionContent";
import styles from "./IntroductionPage.module.css";

interface IntroductionPageProps {
  onSelectTopic?: (topicId: string) => void;
}

export const IntroductionPage: React.FC<IntroductionPageProps> = () => {
  return (
    <div className={`topic-page ${styles.introPage}`}>
      <div className={styles.introContainer}>
        <h2 className={styles.introTitle}>About This Site</h2>
        <div className={styles.customIntroBody}>
          {DEFAULT_INTRODUCTION_CONTENT.paragraphs.map((paragraph, idx) => (
            <p key={idx} className={styles.customIntroParagraph}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
};

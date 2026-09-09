export type Video = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  category: string;
  language: string;
  minAge: number;
  maxAge: number;
  durationSeconds: number;
  orientation: 'vertical' | 'horizontal';
  isShort: boolean;
  isEducational: boolean;
  isReligious: boolean;
  creator: string;
  tags: string[];
};

export type ActivityType = 'quiz' | 'order' | 'match';

export type Activity = {
  id: string;
  category: string;
  minAge: number;
  maxAge: number;
  type: ActivityType;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  items?: string[];
  correctOrder?: string[];
  pairs?: Record<string, string>;
  successFeedback: string;
  retryFeedback: string;
};

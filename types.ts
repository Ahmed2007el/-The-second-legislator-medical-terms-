
export type Language = 'en' | 'ar';
export type ImageMode = 'ai' | 'textbook';

export interface SearchResult {
  term: string;
  explanation: string;
  sources?: { title: string; uri: string }[];
  images: {
    textbook?: string;
    ai?: string;
  };
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface HistoryItem {
  id: string;
  term: string;
  timestamp: number;
}

export interface AppState {
  apiKey: string;
  language: Language;
  currentTerm: string;
  isLoading: boolean;
  result: SearchResult | null;
  chatMessages: ChatMessage[];
  history: HistoryItem[];
  isApiKeyModalOpen: boolean;
  imageMode: ImageMode;
}
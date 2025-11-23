export type Language = 'en' | 'ar';

export interface SearchResult {
  term: string;
  explanation: string;
  sources?: { title: string; uri: string }[];
  imageUrl?: string;
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
}
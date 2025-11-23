
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  History, 
  MessageCircle, 
  Send, 
  Globe, 
  Settings, 
  Trash2,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  ExternalLink,
  Bot,
  RefreshCw,
  Sparkles,
  Zap,
  Activity
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AppState, SearchResult, ChatMessage, HistoryItem, Language, ImageMode } from './types';
import { searchMedicalTerm, sendChatMessage, generateMedicalIllustration } from './services/geminiService';
import { ApiKeyModal } from './components/ApiKeyModal';

const App: React.FC = () => {
  // State initialization
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('mediLexApiKey') || '');
  const [language, setLanguage] = useState<Language>('en');
  const [query, setQuery] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(!apiKey);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [imageMode, setImageMode] = useState<ImageMode>('textbook');
  const [imageLoading, setImageLoading] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');

  // Core Data
  const [result, setResult] = useState<SearchResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('mediLexHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Effects
  useEffect(() => {
    localStorage.setItem('mediLexHistory', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handlers
  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('mediLexApiKey', key);
    setIsApiKeyModalOpen(false);
  };

  const clearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('mediLexApiKey');
    setIsApiKeyModalOpen(true);
  };

  const executeSearch = async (searchTerm: string) => {
    if (!searchTerm.trim() || !apiKey) return;

    setLoading(true);
    setResult(null);
    setMessages([]); 
    setRefinementPrompt('');
    
    // Reset image mode to textbook on new search generally, or keep user preference?
    // Keeping user preference is better UX usually, but let's stick to current state.

    try {
      const data = await searchMedicalTerm(apiKey, searchTerm, language, imageMode);
      const newResult = data as SearchResult;
      setResult(newResult);
      
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        term: newResult.term,
        timestamp: Date.now()
      };
      
      setHistory(prev => {
        const filtered = prev.filter(h => h.term.toLowerCase() !== newResult.term.toLowerCase());
        return [newHistoryItem, ...filtered].slice(0, 50); 
      });

    } catch (error) {
      alert(language === 'ar' ? 'حدث خطأ أثناء البحث' : 'Error searching for term');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleImageModeChange = (mode: ImageMode) => {
    if (mode === imageMode) return;
    setImageMode(mode);
  };

  const handleRegenerateImage = async () => {
    if (!result || !apiKey) return;
    setImageLoading(true);
    try {
        const url = await generateMedicalIllustration(apiKey, result.term, imageMode, refinementPrompt);
        setResult(prev => {
            if (!prev) return null;
            return {
                ...prev,
                images: {
                    ...prev.images,
                    [imageMode]: url
                }
            };
        });
    } catch (e) {
        console.error("Failed to regenerate image", e);
        alert(language === 'ar' ? 'فشل إنشاء الصورة' : 'Failed to generate image');
    } finally {
        setImageLoading(false);
    }
  };

  const handleRefineImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || !apiKey || !refinementPrompt.trim()) return;

    setImageLoading(true);
    try {
        const url = await generateMedicalIllustration(apiKey, result.term, imageMode, refinementPrompt.trim());
        setResult(prev => {
            if (!prev) return null;
            return {
                ...prev,
                images: {
                    ...prev.images,
                    [imageMode]: url
                }
            };
        });
        setRefinementPrompt(''); 
    } catch (e) {
        console.error("Failed to refine image", e);
        alert(language === 'ar' ? 'فشل تحديث الصورة' : 'Failed to update image');
    } finally {
        setImageLoading(false);
    }
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !result || !apiKey) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: chatInput,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Prepare history for API
      const apiHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      const responseText = await sendChatMessage(apiKey, apiHistory, userMsg.text, language, result.term);

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, modelMsg]);

    } catch (error) {
      console.error(error);
    } finally {
      setChatLoading(false);
    }
  };

  const restoreFromHistory = (item: HistoryItem) => {
    setQuery(item.term);
    setShowHistory(false);
    executeSearch(item.term);
  };

  const clearHistory = () => {
    if(window.confirm(language === 'ar' ? 'مسح السجل؟' : 'Clear history?')) {
        setHistory([]);
    }
  }

  // UI Strings
  const isRtl = language === 'ar';
  const strings = {
    title: isRtl ? 'ميديلكس للذكاء الاصطناعي' : 'MediLex AI',
    subtitle: isRtl ? 'رفيقك الطبي الذكي' : 'Your Intelligent Medical Companion',
    searchPlaceholder: isRtl ? 'أدخل مصطلحًا طبيًا (مثال: ارتفاع ضغط الدم، السكري...)' : 'Enter medical term (e.g., Hypertension, Diabetes...)',
    searching: isRtl ? 'جاري البحث في المصادر العلمية...' : 'Searching scientific sources...',
    searchBtn: isRtl ? 'بحث' : 'Search',
    historyTitle: isRtl ? 'سجل البحث' : 'Search History',
    noHistory: isRtl ? 'لا يوجد سجل بحث بعد' : 'No search history yet',
    sources: isRtl ? 'المصادر العلمية' : 'Scientific Sources',
    chatTitle: isRtl ? 'مساعد الذكاء الاصطناعي' : 'AI Assistant',
    chatPlaceholder: isRtl ? 'اسأل شيئاً عن هذا المصطلح...' : 'Ask anything about this term...',
    settings: isRtl ? 'الإعدادات' : 'Settings',
    modeTextbook: isRtl ? 'كتب التشريح (دقيق)' : 'Anatomy Books (Accurate)',
    modeAI: isRtl ? 'فن ذكي (إبداعي)' : 'AI Art (Creative)',
    refinePlaceholder: isRtl ? 'اطلب تعديلاً على الصورة (مثلاً: أضف تسميات، أظهر من الجانب...)' : 'Request changes (e.g., Add labels, Side view...)',
    updateImage: isRtl ? 'تحديث' : 'Update',
    regenerate: isRtl ? 'إعادة إنشاء' : 'Regenerate',
    generateBtn: isRtl ? 'إنشاء صورة لهذا الوضع' : 'Generate Image for this Mode',
    noImageYet: isRtl ? 'لا توجد صورة لهذا الوضع بعد' : 'No image generated for this mode yet'
  };

  // Determine current image to display
  const currentImageUrl = result?.images?.[imageMode];

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 font-sans ${isRtl ? 'font-arabic' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onSave={handleSaveApiKey} language={language} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm/50 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* New Fun Logo */}
            <div className="relative group cursor-pointer" onClick={() => {setResult(null); setQuery('');}}>
                <div className="absolute -inset-1 bg-gradient-to-r from-medical-400 to-indigo-500 rounded-xl blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-medical-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg transform transition-transform group-hover:scale-105 group-hover:rotate-3">
                     <Activity size={22} className="text-white/90" />
                     <Sparkles size={10} className="absolute top-1.5 right-1.5 text-yellow-300 animate-pulse" />
                </div>
            </div>
            
            <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">
                    <span className="text-slate-800">Medi</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-medical-500 to-indigo-600">Lex</span>
                </h1>
                <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase ml-0.5">Medical AI</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setLanguage(l => l === 'en' ? 'ar' : 'en')}
              className="p-2 text-slate-500 hover:text-medical-600 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-1"
            >
              <Globe size={18} />
              <span className="text-xs font-semibold">{language.toUpperCase()}</span>
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-slate-500 hover:text-medical-600 hover:bg-slate-100 rounded-full transition-colors lg:hidden"
            >
              <History size={20} />
            </button>
            <button 
              onClick={clearApiKey}
              className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              title="Reset API Key"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto relative">
        {/* Sidebar History */}
        <aside 
          key={language}
          className={`
            fixed lg:sticky top-0 lg:top-16 h-full lg:h-[calc(100vh-4rem)] 
            w-72 bg-white border-slate-200 z-40 transform transition-transform duration-300 ease-in-out
            ${isRtl ? 'right-0 border-l' : 'left-0 border-r'}
            ${showHistory ? 'translate-x-0' : (isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')}
          `}
        >
          <div className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <History size={18} /> {strings.historyTitle}
              </h3>
              {history.length > 0 && (
                 <button onClick={clearHistory} className="text-slate-400 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                 </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-8">{strings.noHistory}</div>
              ) : (
                history.map(item => (
                  <button
                    key={item.id}
                    onClick={() => restoreFromHistory(item)}
                    className="w-full text-left p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group flex justify-between items-center"
                  >
                    <span className="font-medium text-slate-700 truncate">{item.term}</span>
                    {isRtl ? <ArrowLeft size={14} className="opacity-0 group-hover:opacity-100 text-medical-500"/> : <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-medical-500"/>}
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        {showHistory && (
             <div 
               className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm"
               onClick={() => setShowHistory(false)}
             />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] p-4 lg:p-8 w-full max-w-full">
          
          {/* Search Hero */}
          <div className={`max-w-3xl mx-auto transition-all duration-500 ${result ? 'mt-0' : 'mt-20 lg:mt-32'}`}>
            {!result && (
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-6">
                        <div className="relative group">
                            <div className="absolute -inset-2 bg-gradient-to-r from-medical-400 to-indigo-500 rounded-3xl blur-lg opacity-30 group-hover:opacity-60 transition duration-700"></div>
                            <div className="relative w-24 h-24 bg-gradient-to-br from-medical-500 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-2xl transform transition-transform group-hover:scale-105 group-hover:-rotate-2">
                                <Activity size={48} className="text-white/95" />
                                <Sparkles size={24} className="absolute top-3 right-3 text-yellow-300 animate-pulse" />
                            </div>
                        </div>
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                        <span className="text-slate-800">Medi</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-medical-500 to-indigo-600">Lex</span>
                    </h2>
                    <p className="text-slate-500 text-lg lg:text-xl max-w-lg mx-auto leading-relaxed">{strings.subtitle}</p>
                </div>
            )}

            <form onSubmit={handleSearch} className="relative shadow-xl shadow-medical-500/10 rounded-2xl group">
              <div className="absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none p-4 group-focus-within:text-medical-500 transition-colors">
                <Search size={22} />
              </div>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={strings.searchPlaceholder}
                className={`w-full bg-white text-lg p-5 rounded-2xl border-2 border-transparent focus:border-medical-500 outline-none transition-all placeholder:text-slate-400 ${isRtl ? 'pr-12 pl-36' : 'pl-12 pr-36'}`}
              />
              <button 
                type="submit" 
                disabled={loading || !apiKey}
                className={`absolute top-2.5 bottom-2.5 bg-gradient-to-r from-medical-600 to-medical-500 hover:from-medical-700 hover:to-medical-600 text-white px-8 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${isRtl ? 'left-2.5' : 'right-2.5'}`}
              >
                {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    strings.searchBtn
                )}
              </button>
            </form>
          </div>

          {/* Results Area */}
          {result && (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
              
              {/* Left Column: Explanation */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:p-8">
                  <h2 className="text-3xl font-bold text-slate-800 mb-4 border-b pb-4">{result.term}</h2>
                  <div className="prose prose-slate max-w-none prose-lg leading-relaxed text-slate-700">
                    <ReactMarkdown>{result.explanation}</ReactMarkdown>
                  </div>

                  {result.sources && result.sources.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Globe size={14} /> {strings.sources}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.sources.map((src, idx) => (
                          <a 
                            key={idx}
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs bg-slate-50 hover:bg-medical-50 text-slate-600 hover:text-medical-700 border border-slate-200 px-3 py-1.5 rounded-full transition-colors"
                          >
                            {src.title}
                            <ExternalLink size={10} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Chat Interface */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[500px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <MessageCircle className="text-medical-500" size={20} />
                            {strings.chatTitle}
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                <MessageCircle size={48} className="mb-2" />
                                <p>{strings.chatPlaceholder}</p>
                            </div>
                        )}
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-medical-600 text-white rounded-br-none' 
                                    : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none'
                                }`}>
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75" />
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleChatSend} className="p-4 bg-white border-t border-slate-100 rounded-b-2xl">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder={strings.chatPlaceholder}
                                className="w-full bg-slate-100 border-none rounded-full py-3 px-5 focus:ring-2 focus:ring-medical-500 outline-none pr-12"
                            />
                            <button 
                                type="submit"
                                disabled={chatLoading || !chatInput.trim()}
                                className={`absolute p-2 bg-medical-600 text-white rounded-full hover:bg-medical-700 transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100 ${isRtl ? 'left-2' : 'right-2'}`}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </form>
                </div>
              </div>

              {/* Right Column: Illustration */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-24 flex flex-col">
                  {/* Image Controls Header */}
                  <div className="p-3 border-b border-slate-100 bg-slate-50 flex gap-2">
                     <div className="flex bg-white rounded-lg p-1 border border-slate-200 flex-1 shadow-sm">
                        <button 
                            onClick={() => handleImageModeChange('textbook')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                imageMode === 'textbook' 
                                ? 'bg-medical-100 text-medical-700 shadow-sm ring-1 ring-medical-200' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <BookOpen size={14} />
                            {strings.modeTextbook}
                        </button>
                        <button 
                            onClick={() => handleImageModeChange('ai')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                imageMode === 'ai' 
                                ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-200' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            <Bot size={14} />
                            {strings.modeAI}
                        </button>
                     </div>

                     <button 
                        onClick={handleRegenerateImage}
                        disabled={imageLoading}
                        className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg w-10 flex items-center justify-center shadow-sm transition-all active:scale-95 hover:border-medical-300 hover:text-medical-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={strings.regenerate}
                     >
                        <RefreshCw size={18} className={imageLoading ? "animate-spin" : ""} />
                     </button>
                  </div>

                  <div className="aspect-[4/3] bg-slate-100 relative group border-b border-slate-100">
                    {currentImageUrl && !imageLoading ? (
                        <img 
                            src={currentImageUrl} 
                            alt={`Illustration of ${result.term}`}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                             {loading || imageLoading ? (
                                <div className="text-center px-4">
                                    <div className="w-8 h-8 border-2 border-medical-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    <span className="text-sm font-medium text-slate-500 animate-pulse">
                                        {imageMode === 'textbook' ? (isRtl ? 'جاري البحث والرسم العلمي...' : 'Researching & Drawing...') : (isRtl ? 'جاري التخيل...' : 'Dreaming up image...')}
                                    </span>
                                </div>
                             ) : (
                                <div className="flex flex-col items-center gap-3 p-6 text-center">
                                    <div className="bg-slate-100 p-3 rounded-full">
                                        <ImageIcon size={32} className="text-slate-400" />
                                    </div>
                                    <p className="text-sm text-slate-500 max-w-[200px]">
                                        {strings.noImageYet}
                                    </p>
                                    <button 
                                        onClick={handleRegenerateImage}
                                        className="text-sm bg-medical-50 hover:bg-medical-100 text-medical-600 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Zap size={14} />
                                        {strings.generateBtn}
                                    </button>
                                </div>
                             )}
                        </div>
                    )}
                    {currentImageUrl && !imageLoading && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                            <p className="text-white text-xs font-medium flex items-center gap-2">
                                <Sparkles size={12} className="text-yellow-400" />
                                {imageMode === 'textbook' ? 'Scientific Illustration' : 'AI Artistic Render'}
                            </p>
                        </div>
                    )}
                  </div>

                  {/* Refinement Box */}
                  <div className="p-3 bg-slate-50/50">
                     <form onSubmit={handleRefineImage} className="relative">
                        <input
                            type="text"
                            value={refinementPrompt}
                            onChange={(e) => setRefinementPrompt(e.target.value)}
                            placeholder={strings.refinePlaceholder}
                            className="w-full text-sm p-3 pr-10 border border-slate-200 rounded-lg focus:ring-1 focus:ring-medical-500 focus:border-medical-500 outline-none bg-white placeholder-slate-400"
                        />
                        <button 
                            type="submit"
                            disabled={imageLoading || !refinementPrompt.trim()}
                            className={`absolute top-1/2 -translate-y-1/2 p-1.5 text-medical-600 hover:bg-medical-50 rounded-md transition-colors disabled:opacity-40 ${isRtl ? 'left-2' : 'right-2'}`}
                            title={strings.updateImage}
                        >
                            {imageLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                     </form>
                  </div>
                  
                  <div className="px-4 py-2 bg-white">
                     <p className="text-[10px] text-slate-400 text-center italic">
                        * Illustrations are AI-generated for educational purposes.
                     </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;

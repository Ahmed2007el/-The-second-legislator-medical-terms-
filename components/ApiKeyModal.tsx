import React, { useState } from 'react';
import { Key, Lock, AlertCircle } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (key: string) => void;
  language: 'en' | 'ar';
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, language }) => {
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setError(language === 'en' ? 'API Key is required' : 'مطلوب مفتاح API');
      return;
    }
    onSave(inputKey.trim());
  };

  const isRtl = language === 'ar';
  
  const text = {
    title: isRtl ? 'إعداد مفتاح Gemini API' : 'Setup Gemini API Key',
    desc: isRtl 
      ? 'يتطلب هذا التطبيق مفتاح API خاص بك ليعمل، حيث يتم استضافة التطبيق بشكل خارجي ولا يدعم المتغيرات البيئية.'
      : 'This application requires your own API key to function as it is hosted externally without environment variable support.',
    label: isRtl ? 'أدخل مفتاح Google GenAI الخاص بك' : 'Enter your Google GenAI API Key',
    placeholder: isRtl ? 'لصق المفتاح هنا...' : 'Paste key here...',
    button: isRtl ? 'حفظ وبدء الاستخدام' : 'Save & Start',
    linkText: isRtl ? 'احصل على مفتاح من Google AI Studio' : 'Get a key from Google AI Studio',
    privacy: isRtl ? 'يتم حفظ المفتاح في متصفحك فقط.' : 'Key is stored locally in your browser only.'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden relative"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3 mb-4 text-medical-600">
            <div className="p-3 bg-medical-50 rounded-full">
                <Key className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">{text.title}</h2>
        </div>

        <p className="text-slate-600 mb-6 text-sm leading-relaxed">
          {text.desc}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {text.label}
            </label>
            <div className="relative">
                <input
                    type="password"
                    value={inputKey}
                    onChange={(e) => {
                        setInputKey(e.target.value);
                        setError('');
                    }}
                    placeholder={text.placeholder}
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-medical-500 transition-all outline-none"
                />
                <Lock className={`absolute w-4 h-4 text-slate-400 top-3.5 ${isRtl ? 'right-3' : 'left-3'}`} />
            </div>
            {error && (
                <div className="flex items-center gap-2 mt-2 text-red-500 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-medical-600 hover:bg-medical-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2"
          >
            {text.button}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2 text-center">
            <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-medical-600 hover:text-medical-800 underline font-medium"
            >
                {text.linkText}
            </a>
            <span className="text-[10px] text-slate-400">{text.privacy}</span>
        </div>
      </div>
    </div>
  );
};
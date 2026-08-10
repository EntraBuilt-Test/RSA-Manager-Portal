import React, { useEffect, useRef, useState } from 'react';
import { assistantApi } from '../../api';
import { useLanguage } from '../../context/LanguageContext.jsx';

/**
 * Floating assistant widget, bottom-right corner.
 *
 * Backend: backend/controllers/assistantController.js - answers via Groq (a real
 * LLM) when GROQ_API_KEY is configured on the server, falling back to a free
 * local keyword-matcher if it isn't (or if the Groq call fails).
 *
 * Voice: speech-in and speech-out both use the browser's built-in Web Speech API
 * (SpeechRecognition / speechSynthesis). This also needs no API key and no cost -
 * it runs entirely in the browser. Best supported in Chrome/Edge; the mic button
 * hides itself automatically on browsers that don't support SpeechRecognition.
 */
const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    "Hi! I'm the RSA Construction assistant. Ask me how to create a delivery note, check stock, run a report, or find anything else in this app.",
};

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
const speechSupported = !!SpeechRecognitionImpl;
const ttsSupported = typeof window !== 'undefined' && !!window.speechSynthesis;

export default function ChatWidget() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const baseInputRef = useRef(''); // text already in the box before this listening session started
  const listeningRef = useRef(false); // mirrors `listening` state, readable inside async/callback code

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Set up SpeechRecognition once.
  useEffect(() => {
    if (!speechSupported) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      // Ignore results that arrive after we've already stopped listening
      // (e.g. the box was cleared by Send just before a late/final result
      // came in) - otherwise stale text can reappear in the input.
      if (!listeningRef.current) return;
      // Rebuild the transcript from ALL results of this session every time
      // (some browsers, especially on mobile/Android, fire onresult repeatedly
      // during a single utterance with a growing "final" guess of the whole
      // sentence so far). Always replacing - never appending onto a previous
      // onresult's output - avoids the "How How to How to go..." duplication.
      let sessionTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        sessionTranscript += event.results[i][0].transcript;
      }
      const base = baseInputRef.current;
      setInput(base ? `${base} ${sessionTranscript}` : sessionTranscript);
    };
    recognition.onerror = () => {
      listeningRef.current = false;
      setListening(false);
    };
    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, []);

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (listening) {
      listeningRef.current = false;
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setError('');
      try {
        // Snapshot whatever's already typed so this session's transcript
        // gets appended once to it, not repeatedly re-appended per event.
        baseInputRef.current = input.trim();
        recognitionRef.current.start();
        listeningRef.current = true;
        setListening(true);
      } catch {
        // start() throws if already started - ignore.
      }
    }
  };

  const speak = (text) => {
    if (!ttsSupported || !text) return;
    window.speechSynthesis.cancel(); // stop anything currently playing
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    // If the mic is still listening when Send is pressed, stop it and clear
    // the "base" text - otherwise a late speech-recognition result can land
    // right after we clear the input and repopulate it with stale text.
    if (listeningRef.current) {
      listeningRef.current = false;
      recognitionRef.current?.stop();
      setListening(false);
    }
    baseInputRef.current = '';
    setError('');
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    try {
      const apiMessages = nextMessages.filter((m) => m !== WELCOME_MESSAGE);
      const res = await assistantApi.chat(apiMessages);
      const reply = res.data.reply;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (speakReplies) speak(reply);
    } catch (err) {
      const message = err.response?.data?.message || 'The assistant is not available right now. Please try again.';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-widget no-print">
      {open && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <span>RSA Assistant</span>
            <div className="chat-header-actions">
              {ttsSupported && (
                <button
                  type="button"
                  className={`chat-icon-btn${speakReplies ? ' chat-icon-btn-active' : ''}`}
                  onClick={() => {
                    if (speakReplies) window.speechSynthesis.cancel();
                    setSpeakReplies((v) => !v);
                  }}
                  title={speakReplies ? 'Voice replies: on (click to mute)' : 'Voice replies: off (click to unmute)'}
                  aria-label="Toggle spoken replies"
                >
                  {speakReplies ? '🔊' : '🔈'}
                </button>
              )}
              <button className="chat-close-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
                ×
              </button>
            </div>
          </div>
          <div className="chat-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
                {m.content}
                {m.role === 'assistant' && ttsSupported && (
                  <button
                    type="button"
                    className="chat-bubble-speak-btn"
                    onClick={() => speak(m.content)}
                    aria-label="Read this reply aloud"
                    title="Read aloud"
                  >
                    🔊
                  </button>
                )}
              </div>
            ))}
            {sending && <div className="chat-bubble chat-bubble-assistant chat-bubble-typing">...</div>}
          </div>
          {error && <div className="alert alert-error chat-error">{error}</div>}
          <form className="chat-input-row" onSubmit={send}>
            {speechSupported && (
              <button
                type="button"
                className={`chat-mic-btn${listening ? ' chat-mic-btn-listening' : ''}`}
                onClick={toggleListening}
                aria-label={listening ? 'Stop listening' : 'Speak your question'}
                title={listening ? 'Listening... click to stop' : 'Click and speak'}
              >
                {listening ? '⏹️' : '🎤'}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? 'Listening...' : 'Ask a question...'}
              disabled={sending}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
      <button
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        title="RSA Assistant"
      >
        {open ? (
          <span className="chat-fab-close">&times;</span>
        ) : (
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V5Z"
              fill="currentColor"
            />
            <circle cx="9" cy="9.5" r="1.2" fill="var(--brand-red)" />
            <circle cx="12.5" cy="9.5" r="1.2" fill="var(--brand-red)" />
            <circle cx="16" cy="9.5" r="1.2" fill="var(--brand-red)" />
          </svg>
        )}
      </button>
    </div>
  );
}

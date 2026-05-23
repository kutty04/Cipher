/**
 * Voice Assistant Utilities wrapping the browser-native SpeechRecognition
 * and SpeechSynthesis APIs. 100% Client-Side, Free-tier friendly.
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const isSpeechSupported = () => {
  return typeof SpeechRecognition !== 'undefined';
};

/**
 * Creates a Speech Recognition instance.
 * @param {Object} options callbacks
 */
export function createSpeechRecognizer({ onResult, onStart, onEnd, onError }) {
  if (!isSpeechSupported()) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    if (onStart) onStart();
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (onResult) {
      onResult(finalTranscript || interimTranscript);
    }
  };

  recognition.onerror = (event) => {
    if (onError) onError(event.error);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return recognition;
}

/**
 * Speaks text using the SpeechSynthesis API.
 * @param {string} text Plain text to read out
 * @param {Object} options callbacks
 */
let currentUtterance = null;

export function speakText(text, { onStart, onEnd, onError } = {}) {
  // Cancel any active speech before starting new
  stopSpeaking();

  if (typeof window.speechSynthesis === 'undefined') {
    if (onError) onError('Speech synthesis not supported');
    return;
  }

  // Clean Markdown notations from the text to make pronunciation natural
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '[code block omitted]')
    .replace(/<compare>[\s\S]*?<\/compare>/g, '[diff review omitted]')
    .replace(/[*#`_\-🚨🧠✅💡]/g, '')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  currentUtterance = utterance;

  // Pick a premium sounding English voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (voice) => voice.lang.startsWith('en') && (voice.name.includes('Google') || voice.name.includes('Natural'))
  ) || voices.find((voice) => voice.lang.startsWith('en'));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (onEnd) onEnd();
    currentUtterance = null;
  };

  utterance.onerror = (event) => {
    if (onError) onError(event.error);
    currentUtterance = null;
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window.speechSynthesis !== 'undefined') {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

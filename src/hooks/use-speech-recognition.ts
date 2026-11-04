"use client";

import { useState, useRef, useCallback, useSyncExternalStore } from "react";
import { assembleSpeechResults } from "@/lib/speech";

function checkSpeechSupport(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

const emptySubscribe = () => () => {};

// Define browser SpeechRecognition types
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

interface UseSpeechRecognitionOptions {
  onTranscript?: (finalChunk: string) => void;
  onInterim?: (interim: string) => void;
  lang?: string;
}

export function useSpeechRecognition({
  onTranscript,
  onInterim,
  lang,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const isSupported = useSyncExternalStore(
    emptySubscribe,
    checkSpeechSupport,
    () => false
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const sessionCommittedRef = useRef("");
  const currentSessionFinalRef = useRef("");

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore already stopped error
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setErrorMessage("Speech recognition is not supported in this browser.");
      return;
    }

    setErrorMessage(null);
    isManuallyStoppedRef.current = false;
    sessionCommittedRef.current = "";
    currentSessionFinalRef.current = "";

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang || (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const items: Array<{ isFinal: boolean; transcript: string }> = [];
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item && item[0]) {
            items.push({
              isFinal: item.isFinal,
              transcript: item[0].transcript,
            });
          }
        }

        const { finalTranscript, interimTranscript, combined } = assembleSpeechResults(items);
        currentSessionFinalRef.current = finalTranscript;
        setInterimTranscript(interimTranscript);
        onInterim?.(interimTranscript);

        const separator = sessionCommittedRef.current && combined ? " " : "";
        const fullSpoken = sessionCommittedRef.current + separator + combined;
        if (fullSpoken) {
          onTranscript?.(fullSpoken);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "no-speech") {
          // Normal silence, keep listening unless manually stopped
          return;
        }

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setErrorMessage("Microphone permission was denied. Please allow microphone access.");
          setIsListening(false);
          return;
        }

        if (event.error === "network") {
          setErrorMessage("Network error during speech recognition.");
        }

        setIsListening(false);
      };

      recognition.onend = () => {
        if (!isManuallyStoppedRef.current && isListening) {
          if (currentSessionFinalRef.current) {
            const separator = sessionCommittedRef.current ? " " : "";
            sessionCommittedRef.current += separator + currentSessionFinalRef.current;
            currentSessionFinalRef.current = "";
          }
          try {
            recognition.start();
            return;
          } catch {
            // Fall through to stop
          }
        }
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[useSpeechRecognition] start error:", err);
      setErrorMessage("Could not start microphone.");
      setIsListening(false);
    }
  }, [lang, onTranscript, onInterim, isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
  };
}

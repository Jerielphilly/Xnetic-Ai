"use client";
import React, { useEffect, useState, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/AuthProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VscLoading } from "react-icons/vsc";
import ReactMarkdown from 'react-markdown';
import { Copy, Eye, Languages, FileText as FileTextIcon, Mic, MicOff, VolumeX, CalendarClock, SpellCheck, Lock as LockIcon } from "lucide-react";
import InteractivePdfViewer from "@/components/InteractivePdfViewer";

// --- TYPE DEFINITIONS ---
type ChatData = {
  summaryAnalysis: string;
  documentName: string[];
  documentTitle: string;
  fileUrl: string[];
  score: number;
  grade: string;
  justification: string;
  role: string;
  completedTimelineEvents?: string[];
  qaHistory?: QAPair[];
};
type QAPair = {
  question: string;
  answer: string;
};
type Clause = {
  clause_title: string;
  exact_text: string;
  summary: string;
  risk_level: 'Low' | 'Medium' | 'High';
  pageNumber?: number;
};
type TimelineEvent = {
  date: string;
  description: string;
  status: 'Upcoming' | 'Overdue' | 'Completed';
};
type TimelineData = {
  events: TimelineEvent[];
};
type GrammarSuggestion = {
  original: string;
  corrected: string;
  explanation: string;
};
type GrammarReport = {
  suggestions: GrammarSuggestion[];
};
function objectToMarkdown(obj: any, level = 1): string {
  let md = '';
  const headingPrefix = '#'.repeat(level);

  // convert Roman OR Arabic numerals → number for sorting
  const articleToNumber = (str: string): number => {
    const romanMap: any = {
      I: 1, II: 2, III: 3, IV: 4, V: 5,
      VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
      XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
    };

    // check Arabic: "Article 12"
    let match = str.match(/Article\s+(\d+)/);
    if (match) return parseInt(match[1], 10);

    // check Roman: "Article IV"
    match = str.match(/Article\s+([IVXLCDM]+)/);
    if (match) return romanMap[match[1]] || 999;

    return 999; // fallback if no number found
  };

  if (typeof obj === 'string' || typeof obj === 'number') {
    return `- ${obj}\n`;
  } else if (Array.isArray(obj)) {
    obj.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        md += objectToMarkdown(item, level + 1);
      } else {
        md += `- ${item}\n`;
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    // separate articles vs others
    const articleKeys = Object.keys(obj).filter(k => k.startsWith("Article"));
    const otherKeys = Object.keys(obj).filter(k => !k.startsWith("Article"));
    articleKeys.sort((a, b) => articleToNumber(a) - articleToNumber(b));

    const orderedKeys = [...otherKeys, ...articleKeys];

    for (const key of orderedKeys) {
      const value = obj[key];
      md += `\n${headingPrefix} ${key}\n\n`;
      if (typeof value === 'object') {
        md += objectToMarkdown(value, level + 1);
      } else {
        md += `- ${value}\n`;
      }
    }
  }

  return md;
}


export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = React.use(params);
  
  const { user } = useAuth();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<QAPair[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [visualizerUrl, setVisualizerUrl] = useState<string | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [speakingAnswerIndex, setSpeakingAnswerIndex] = useState<number | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [completedEvents, setCompletedEvents] = useState<Set<string>>(new Set());
  const [grammarReport, setGrammarReport] = useState<GrammarReport | null>(null);
  const [isGrammarLoading, setIsGrammarLoading] = useState(false);
  const [isGrammarModalOpen, setIsGrammarModalOpen] = useState(false);

  useEffect(() => {
    const fetchChatData = async () => {
      if (user && chatId) {
        setIsLoading(true);
        const docRef = doc(db, "chats", chatId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (typeof data.fileUrl === 'string') data.fileUrl = [data.fileUrl];
          if (typeof data.documentName === 'string') data.documentName = [data.documentName];
          setChatData(data as ChatData);
          if (data.qaHistory) {
            setQaHistory(data.qaHistory);
          }
          if (data.completedTimelineEvents) {
            setCompletedEvents(new Set(data.completedTimelineEvents));
          }
        } else {
          console.error("No such document found in Firestore!");
        }
        setIsLoading(false);
      }
    };
    fetchChatData();
  }, [user, chatId]);
  const saveChatHistory = async (history: QAPair[]) => {
    if (!user || !chatId) return;
    const token = await user.getIdToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    try {
      await fetch(`${apiUrl}/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ qaHistory: history })
      });
    } catch (error) {
      console.error("Failed to save chat history:", error);
    }
  };
  const handleStopSpeaking = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setSpeakingAnswerIndex(null);
    }
  };

  const handleVoiceInput = () => {
    handleStopSpeaking();
    if (!('webkitSpeechRecognition' in window)) {
      alert("Sorry, your browser doesn't support voice recognition.");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleAskQuestion(transcript, true);
    };
    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        alert("Sorry, I didn't hear anything. Please try again.");
      } else {
        console.error("Speech recognition error:", event.error);
        alert(`An error occurred during speech recognition: ${event.error}`);
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleAskQuestion = async (questionText: string, isVoiceInput: boolean = false) => {
    if (!questionText.trim() || !user) return;
    handleStopSpeaking();
    setIsAsking(true);
    const currentQuestion = questionText;
    setQuestion("");

    const historyWithPending = [...qaHistory, { question: currentQuestion, answer: "..." }];
    setQaHistory(historyWithPending);

    const token = await user.getIdToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      const errorMessage = "Configuration Error: Could not connect to the backend.";
      setQaHistory(prev => prev.map(qa => qa.question === currentQuestion ? { ...qa, answer: errorMessage } : qa));
      setIsAsking(false);
      return;
    }

    try {
      const askResponse = await fetch(`${apiUrl}/ask`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ document_id: chatId, question: currentQuestion })
      });
      if (!askResponse.ok) throw new Error(`Server responded with ${askResponse.status}`);
      const data = await askResponse.json();
      
      const finalHistory = historyWithPending.map(qa => 
        qa.question === currentQuestion ? { ...qa, answer: data.answer } : qa
      );
      setQaHistory(finalHistory);

      // Save the final, complete history to the backend
      await saveChatHistory(finalHistory);

      if (isVoiceInput) {
        const ttsResponse = await fetch(`${apiUrl}/text-to-speech`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: data.answer })
        });
        if (!ttsResponse.ok) {
            const errorData = await ttsResponse.json();
            throw new Error(errorData.detail || "Failed to get audio.");
        }
        const ttsData = await ttsResponse.json();
        const audioSrc = `data:audio/mp3;base64,${ttsData.audio_content}`;
        const audio = new Audio(audioSrc);
        const questionIndex = finalHistory.length - 1;
        audio.onplay = () => setSpeakingAnswerIndex(questionIndex);
        audio.onended = () => {
            setCurrentAudio(null);
            setSpeakingAnswerIndex(null);
        };
        setCurrentAudio(audio);
        audio.play();
      }
    } catch (error: any) {
      console.error("Fetch error:", error);
      const errorMessage = `Sorry, an error occurred: ${error.message}`;
      setQaHistory(prev => prev.map(qa => qa.question === currentQuestion ? { ...qa, answer: errorMessage } : qa));
    } finally {
      setIsAsking(false);
    }
  };


  const handleNegotiate = async () => {
    if (!selectedText || !user) return;
    setIsNegotiating(true);
    setSuggestion("");
    const token = await user.getIdToken();
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/negotiate`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ clause: selectedText, chat_id: chatId })
        });
        if (!response.ok) throw new Error("Failed to get suggestion.");
        const data = await response.json();
        setSuggestion(data.suggestion);
    } catch (error) {
        console.error(error);
        setSuggestion("Sorry, an error occurred. Please try again.");
    } finally {
        setIsNegotiating(false);
    }
  };
  
  const handleOpenVisualizer = async (pdfUrl: string, fileIndex: number) => {
    if (!user) return;
    setVisualizerUrl(pdfUrl);
    setIsVisualizerOpen(true); 
    const token = await user.getIdToken();
    try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/extract-clauses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ chat_id: chatId, file_index: fileIndex })
        });
        if (!response.ok) throw new Error("Failed to extract clauses.");
        const data = await response.json();
        setClauses(data.clauses);
    } catch (error) {
        console.error(error);
        alert("Could not load the clause visualizer.");
        setIsVisualizerOpen(false);
    }
  };
  
  const handleTextSelection = () => {
    const text = window.getSelection()?.toString();
    if (text && text.trim().length > 10) {
      setSelectedText(text.trim());
    } else {
      setSelectedText("");
    }
  };

  const handleTranslate = async (language: string, fileIndex: number) => {
    if (!user || !chatId) return;
    setIsTranslating(true);
    setTargetLanguage(language);
    setTranslatedText(null);
    setIsTranslationModalOpen(true);
    const token = await user.getIdToken();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/translate`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chat_id: chatId, target_language: language, file_index: fileIndex })
      });
      if (!response.ok) throw new Error("Translation failed.");
      const data = await response.json();
      setTranslatedText(data.translated_text);
    } catch (error) {
      console.error(error);
      setTranslatedText("Sorry, an error occurred during translation.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleViewTimeline = async () => {
    if (!user || !chatId) return;
    if (timelineData) {
      setIsTimelineModalOpen(true);
      return;
    }
    setIsTimelineLoading(true);
    setIsTimelineModalOpen(true);
    const token = await user.getIdToken();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/generate-timeline`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chat_id: chatId })
      });
      if (!response.ok) throw new Error("Failed to generate timeline.");
      const data = await response.json();
      setCompletedEvents(prev => {
          if (prev.size > 0) return prev;
          const initiallyCompleted = new Set<string>();
          data.events.forEach((event: TimelineEvent) => {
              if (event.status === 'Completed') {
                  initiallyCompleted.add(event.description);
              }
          });
          return initiallyCompleted;
      });
      setTimelineData(data);
    } catch (error) {
      console.error(error);
      setIsTimelineModalOpen(false);
      alert("Sorry, an error occurred while generating the timeline.");
    } finally {
      setIsTimelineLoading(false);
    }
  };
  
  const toggleEventCompletion = async (description: string) => {
    const newSet = new Set(completedEvents);
    if (newSet.has(description)) {
      newSet.delete(description);
    } else {
      newSet.add(description);
    }
    setCompletedEvents(newSet);
    if (!user) return;
    const token = await user.getIdToken();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    try {
        await fetch(`${apiUrl}/chats/${chatId}/timeline`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ completed_events: Array.from(newSet) })
        });
    } catch (error) {
        console.error("Failed to save timeline progress:", error);
    }
  };

  const handleGrammarCheck = async (fileIndex: number) => {
    if (!user || !chatId) return;
    setIsGrammarLoading(true);
    setGrammarReport(null);
    setIsGrammarModalOpen(true);
    const token = await user.getIdToken();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/check-grammar`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chat_id: chatId, file_index: fileIndex })
      });
      if (!response.ok) throw new Error("Failed to check grammar.");
      const data = await response.json();
      setGrammarReport(data);
    } catch (error) {
      console.error(error);
      setIsGrammarModalOpen(false);
      alert("Sorry, an error occurred while checking grammar.");
    } finally {
      setIsGrammarLoading(false);
    }
  };

  const timelineProgress = useMemo(() => {
    if (!timelineData || timelineData.events.length === 0) return 0;
    return (completedEvents.size / timelineData.events.length) * 100;
  }, [timelineData, completedEvents]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><VscLoading className="animate-spin text-4xl" /></div>;
  }

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[625px]">
          <DialogHeader><DialogTitle>Negotiation Helper</DialogTitle><DialogDescription>Here is an AI-suggested alternative to your selected clause.</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-100 rounded-md max-h-32 overflow-y-auto">
              <p className="font-semibold text-sm">Your Selected Clause:</p><p className="text-sm text-gray-600 italic mt-1">"{selectedText}"</p>
            </div>
            {isNegotiating ? (<div className="flex justify-center items-center h-24"><VscLoading className="animate-spin text-2xl" /></div>) : (
              suggestion && (
                <div className="p-4 border rounded-md relative group max-h-60 overflow-y-auto">
                  <p className="font-semibold text-sm">Suggested Alternative:</p>
                  <div className="prose prose-sm max-w-none mt-2"><ReactMarkdown>{suggestion}</ReactMarkdown></div>
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => navigator.clipboard.writeText(suggestion)}><Copy className="h-4 w-4" /></Button>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isTranslationModalOpen} onOpenChange={setIsTranslationModalOpen}>
        <DialogContent className="sm:max-w-[80vw] h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Document Translation</DialogTitle><DialogDescription>AI-powered translation to {targetLanguage}.</DialogDescription></DialogHeader>
          <div className="flex-grow overflow-y-auto p-4 border rounded-md relative group">
            {isTranslating ? (<div className="flex justify-center items-center h-full"><VscLoading className="animate-spin text-3xl" /></div>) : (
              <div className="prose prose-sm max-w-none"><ReactMarkdown>{translatedText || ""}</ReactMarkdown></div>
            )}
          </div>
          <DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={isTimelineModalOpen} onOpenChange={setIsTimelineModalOpen}>
        <DialogContent className="sm:max-w-[60vw] h-[70vh] flex flex-col">
          <DialogHeader><DialogTitle>Actionable Timeline & Checklist</DialogTitle><DialogDescription>Key dates and deadlines extracted from your document.</DialogDescription></DialogHeader>
          {isTimelineLoading ? (<div className="flex justify-center items-center h-full"><VscLoading className="animate-spin text-3xl" /></div>) : (
            timelineData && (
              <div className="flex-grow overflow-y-auto space-y-4">
                <div>
                    <Progress value={timelineProgress} className="w-full" /><p className="text-sm text-center mt-2 text-gray-600">{completedEvents.size} of {timelineData.events.length} tasks completed</p>
                </div>
                <div className="space-y-3">
                  {timelineData.events.map((event, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 border rounded-md">
                       <Checkbox id={`event-${index}`} checked={completedEvents.has(event.description)} onCheckedChange={() => toggleEventCompletion(event.description)} className="mt-1" />
                       <div className="flex-grow">
                         <label htmlFor={`event-${index}`} className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{event.description}</label>
                         <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">{event.date}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ event.status === 'Overdue' ? 'bg-red-100 text-red-800' : event.status === 'Upcoming' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800' }`}>{event.status}</span>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
          <DialogClose asChild><Button type="button" variant="secondary" className="mt-4">Close</Button></DialogClose>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isGrammarModalOpen} onOpenChange={setIsGrammarModalOpen}>
        <DialogContent className="sm:max-w-[70vw] h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Grammar & Style Report</DialogTitle><DialogDescription>AI-powered suggestions to improve your document's clarity and professionalism.</DialogDescription></DialogHeader>
          {isGrammarLoading ? (<div className="flex justify-center items-center h-full"><VscLoading className="animate-spin text-3xl" /></div>) : (
            <div className="flex-grow overflow-y-auto space-y-4 pr-6">
              {grammarReport?.suggestions && grammarReport.suggestions.length > 0 ? (
                grammarReport.suggestions.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2">
                    <div><p className="text-xs text-gray-500 mb-1">Original Text</p><p className="text-sm bg-red-50 p-2 rounded-md line-through text-red-700">{item.original}</p></div>
                    <div><p className="text-xs text-gray-500 mb-1">Suggested Correction</p><p className="text-sm bg-green-50 p-2 rounded-md text-green-800">{item.corrected}</p></div>
                    <div><p className="text-xs text-gray-500 mb-1">Explanation</p><p className="text-sm text-gray-700">{item.explanation}</p></div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <SpellCheck className="h-12 w-12 text-green-500 mb-4" /><p className="font-semibold">No Grammar Issues Found</p><p className="text-sm text-gray-600">The AI proofreader didn't find any significant grammar or style issues in this document.</p>
                </div>
              )}
            </div>
          )}
          <DialogClose asChild><Button type="button" variant="secondary" className="mt-4">Close</Button></DialogClose>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col h-full bg-white">
        {isVisualizerOpen && visualizerUrl ? (
          <InteractivePdfViewer pdfUrl={visualizerUrl} clauses={clauses} onClose={() => setIsVisualizerOpen(false)} />
        ) : (
          <>
            {selectedText && (<div className="absolute bottom-24 right-10 z-10"><Button onClick={() => { setIsModalOpen(true); handleNegotiate(); }}>Suggest a Fairer Alternative</Button></div>)}
            <div className="flex-grow overflow-y-auto p-6 space-y-6" onMouseUp={handleTextSelection}>
              {chatData ? (
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>AI Analysis of: {chatData.documentTitle || (Array.isArray(chatData.documentName) ? chatData.documentName.join(', ') : chatData.documentName)}</CardTitle>
                      {chatData.score && <p className="text-sm text-gray-500 pt-1">{chatData.grade} ({chatData.score}/100) - {chatData.justification}</p>}
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm max-w-none"><ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h2 className="text-xl font-bold my-2" {...props} />,
                      h2: ({node, ...props}) => <h3 className="text-lg font-semibold my-1" {...props} />,
                      li: ({node, ...props}) => <li className="ml-4 list-disc" {...props} />,
                    }}
                  >
                    {objectToMarkdown(chatData.summaryAnalysis)}
                  </ReactMarkdown>
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-4">
                    <div className="flex justify-between items-center w-full">
                      <h3 className="text-md font-semibold">Associated Documents</h3>
                      <Button variant="outline" onClick={handleViewTimeline}><CalendarClock className="mr-2 h-4 w-4"/>View Timeline</Button>
                    </div>
                    <div className="w-full space-y-2">
                      {chatData.documentName?.map((name, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                          <div className="flex items-center gap-2">
                            <FileTextIcon className="h-4 w-4 text-gray-500"/><span className="text-sm font-medium">{name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleGrammarCheck(index)}><SpellCheck className="mr-2 h-4 w-4" />Check Grammar</Button>
                            <Select onValueChange={(lang) => handleTranslate(lang, index)}>
                              <SelectTrigger className="w-[150px] h-8 text-xs">
                                <Languages className="mr-2 h-3 w-3" /><SelectValue placeholder="Translate..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Spanish">Spanish</SelectItem>
                                <SelectItem value="French">French</SelectItem>
                                <SelectItem value="Hindi">Hindi</SelectItem>
                                <SelectItem value="Mandarin Chinese">Mandarin Chinese</SelectItem>
                              </SelectContent>
                            </Select>
                            {chatData.fileUrl[index]?.toLowerCase().endsWith('.pdf') && (
                              <Button size="sm" variant="outline" onClick={() => handleOpenVisualizer(chatData.fileUrl[index], index)}>
                                <Eye className="mr-2 h-4 w-4" />Visualize
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardFooter>
                </Card>
              ) : (<p>No chat data found.</p>)}
              
              {qaHistory.map((qa, index) => (
                <div key={index} className="space-y-2">
                  <p className="font-semibold text-gray-800 bg-gray-50 p-3 rounded-lg">Q: {qa.question}</p>
                  <div className="relative group text-gray-700 bg-blue-50 p-3 rounded-lg prose prose-sm max-w-none">
                    {qa.answer === "..." ? <VscLoading className="animate-spin" /> : <ReactMarkdown>{qa.answer}</ReactMarkdown>}
                    {speakingAnswerIndex === index && (
                      <Button variant="ghost" size="icon" onClick={handleStopSpeaking} className="absolute top-2 right-2 h-7 w-7 text-gray-500 hover:bg-blue-100" title="Stop speaking"><VolumeX className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t">
              {isListening && (<div className="text-center text-sm text-gray-500 mb-2 animate-pulse">Listening...</div>)}
              <div className="flex gap-2">
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !isAsking && handleAskQuestion(question)} placeholder="Ask a follow-up question or use the microphone..." disabled={!chatData} />
                <Button onClick={() => handleAskQuestion(question)} disabled={isAsking || !chatData}>{isAsking ? <VscLoading className="animate-spin" /> : "Ask"}</Button>
                <Button onClick={handleVoiceInput} disabled={isListening} variant="outline" size="icon">{isListening ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}</Button>
              </div>
              <div className="text-center mt-2">
                <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <LockIcon className="h-3 w-3" /> Your data is private and secure.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
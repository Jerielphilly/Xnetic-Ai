// frontend/app/page.tsx

"use client"; // This is a client component, so we can use state and event handlers

import { useState ,useEffect} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VscLoading } from "react-icons/vsc"; // A nice loading icon
import { motion ,useScroll,useSpring,AnimatePresence} from "framer-motion";
import Link from "next/link";
import { FileText, ShieldCheck, MessageSquare } from 'lucide-react';
// Define a type for our Q&A history
import React from "react";
import { useAuth } from "@/app/AuthProvider";
import {  Languages, CalendarClock, SpellCheck } from 'lucide-react';
import { User, Building, Briefcase } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";


type QAPair = {
  question: string;
  answer: string;
};

const FeatureCard = ({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.5 }}
    transition={{ duration: 0.5, delay: 0.1 }}
    className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
  >
    <div className={`flex items-center justify-center h-12 w-12 rounded-xl mb-4 ${color}`}>
      {icon}
    </div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
  </motion.div>
);

const HowItWorksStep = ({ number, title, description, delay }: { number: string, title: string, description: string, delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, delay }}
        className="flex flex-col items-center text-center"
    >
        <div className="flex items-center justify-center h-16 w-16 bg-primary/10 text-primary rounded-full mb-4 font-bold text-2xl border-2 border-primary/20">
            {number}
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-xs">{description}</p>
    </motion.div>
);

const TestimonialCard = ({ quote, name, role, icon, delay }: { quote: string, name: string, role: string, icon: React.ReactNode, delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, delay }}
        className="bg-white dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700"
    >
        <p className="text-gray-700 dark:text-gray-300 italic mb-4">"{quote}"</p>
        <div className="flex items-center">
            <div className="flex items-center justify-center h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full mr-3">
                {icon}
            </div>
            <div>
                <p className="font-semibold">{name}</p>
                <p className="text-sm text-gray-500">{role}</p>
            </div>
        </div>
    </motion.div>
);

const heroImages = [
    "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=2835&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?q=80&w=2940&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2940&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=2940&auto=format&fit=crop"
];

export default function LandingPage() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [demoText, setDemoText] = useState("The tenant agrees to pay a security deposit of $1500, which will be returned within 30 days of lease termination, minus any deductions for damages beyond normal wear and tear.");
  const [demoResult, setDemoResult] = useState<{ explanation: string; risk: string } | null>(null);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    const imageInterval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => {
        window.removeEventListener("scroll", handleScroll);
        clearInterval(imageInterval);
    };
  }, []);
  
  const handleDemoAnalyze = async () => {
      if (!demoText) return;
      setIsDemoLoading(true);
      setDemoResult(null);
      try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL;
          const response = await fetch(`${apiUrl}/demo-analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: demoText })
          });
          if (!response.ok) throw new Error("Analysis failed.");
          const data = await response.json();
          setDemoResult(data);
      } catch (error) {
          console.error("Demo analysis failed:", error);
          setDemoResult({ explanation: "Sorry, an error occurred. Please try again.", risk: "Error" });
      } finally {
          setIsDemoLoading(false);
      }
  };

  const features = [
    { icon: <FileText className="h-6 w-6 text-blue-500" />, title: "Instant AI Analysis", description: "Get a comprehensive breakdown of your legal document, including a fairness score, risk ratings, and a plain English summary.", color: "bg-blue-100 dark:bg-blue-900/50" },
    { icon: <MessageSquare className="h-6 w-6 text-green-500" />, title: "Interactive Q&A", description: "Ask questions about any part of your document and get clear, context-aware answers from our AI assistant.", color: "bg-green-100 dark:bg-green-900/50" },
    { icon: <Languages className="h-6 w-6 text-purple-500" />, title: "Full Document Translation", description: "Instantly translate entire documents into multiple languages to ensure you understand every detail.", color: "bg-purple-100 dark:bg-purple-900/50" },
    { icon: <ShieldCheck className="h-6 w-6 text-red-500" />, title: "Negotiation Helper", description: "Select any unfair clause and get an AI-generated suggestion for a fairer, more balanced alternative.", color: "bg-red-100 dark:bg-red-900/50" },
    { icon: <CalendarClock className="h-6 w-6 text-yellow-500" />, title: "Actionable Timeline", description: "Automatically extract key dates and deadlines from your contract and view them on an interactive timeline.", color: "bg-yellow-100 dark:bg-yellow-900/50" },
    { icon: <SpellCheck className="h-6 w-6 text-indigo-500" />, title: "Grammar & Style Check", description: "Improve your document's professionalism with an AI-powered proofreader that suggests corrections.", color: "bg-indigo-100 dark:bg-indigo-900/50" },
  ];
  
  const testimonials = [
      { icon: <Briefcase className="h-6 w-6" />, name: "Sarah K.", role: "Freelance Designer", quote: "Xnetic gave me the confidence to negotiate my client contracts. The 'Suggest a Fairer Alternative' feature is a game-changer!", delay: 0.1 },
      { icon: <Building className="h-6 w-6" />, name: "John D.", role: "Small Business Owner", quote: "Analyzing vendor agreements used to take hours. Now, I get a clear summary and risk assessment in minutes. It's an essential tool for my business.", delay: 0.3 },
      { icon: <User className="h-6 w-6" />, name: "Maria P.", role: "Apartment Renter", quote: "I finally understood my rental lease! The timeline feature reminded me of key dates, and I could ask questions about things I didn't understand.", delay: 0.5 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-800 dark:text-gray-200">
      <motion.div className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50" style={{ scaleX }} />
      
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b dark:border-gray-800' : 'bg-transparent'}`}>
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Xnetic</h1>
          <nav>
            {user ? (
              <Link href="/chat"><Button>Go to Dashboard</Button></Link>
            ) : (
              <Link href="/login"><Button>Login / Sign Up</Button></Link>
            )}
          </nav>
        </div>
      </header>

      <main className="pt-16">
        <section className="relative text-center py-24 md:py-40 overflow-hidden min-h-[80vh] flex items-center justify-center">
            <div className="absolute inset-0 w-full h-full">
                <AnimatePresence>
                    <motion.img
                        key={currentImageIndex} src={heroImages[currentImageIndex]} alt="Legal Document Review"
                        initial={{ opacity: 0, x: "100%" }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: "-100%" }}
                        transition={{ duration: 1, ease: "easeInOut" }}
                        className="absolute top-0 left-0 w-full h-full object-cover animate-ken-burns"
                    />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-transparent to-transparent opacity-50"></div>
            </div>
            <div className="container mx-auto px-6 relative z-10">
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeInOut" }} className="max-w-4xl mx-auto">
                    <h2 className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight text-white shadow-black [text-shadow:_0_2px_4px_var(--tw-shadow-color)]">
                        Understand Any Legal Document in Seconds.
                    </h2>
                    <p className="text-lg md:text-xl text-gray-200 max-w-3xl mx-auto mb-8">
                        Translate jargon, identify risks, and ask questions with AI. Xnetic empowers you to sign with confidence.
                    </p>
                    <Link href={user ? "/chat" : "/login"}>
                        <Button size="lg" className="text-lg px-8 py-6 shadow-2xl transform hover:scale-105 transition-transform">
                            Get Started for Free
                        </Button>
                    </Link>
                </motion.div>
            </div>
        </section>

        <section className="py-20 bg-white dark:bg-gray-900/50">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h3 className="text-3xl font-bold mb-2">How It Works</h3>
                    <p className="text-gray-600 dark:text-gray-400">A simple three-step process to clarity and confidence.</p>
                </div>
                <div className="flex flex-col md:flex-row justify-center items-start gap-8 md:gap-16">
                   <HowItWorksStep number="1" title="Upload Your Document" description="Securely upload any legal document, from rental agreements to complex contracts." delay={0.1} />
                   <HowItWorksStep number="2" title="Receive AI Analysis" description="Our AI instantly analyzes the text, providing summaries, risk scores, and clause breakdowns." delay={0.3} />
                   <HowItWorksStep number="3" title="Ask & Understand" description="Use our interactive tools to ask questions, translate text, and get actionable insights." delay={0.5} />
                </div>
            </div>
        </section>

        {/* NEW: Interactive Demo Section */}
        <section className="py-20">
            <div className="container mx-auto px-6">
                 <div className="text-center mb-12">
                    <h3 className="text-3xl font-bold mb-2">Try It Live</h3>
                    <p className="text-gray-600 dark:text-gray-400">Paste any legal clause below to see our AI in action.</p>
                </div>
                <div className="max-w-3xl mx-auto">
                    <Card className="shadow-lg">
                        <CardContent className="p-6">
                            <Textarea
                                value={demoText}
                                onChange={(e) => setDemoText(e.target.value)}
                                placeholder="Paste a clause from any contract here..."
                                className="mb-4 h-32"
                            />
                            <Button onClick={handleDemoAnalyze} disabled={isDemoLoading} className="w-full">
                                {isDemoLoading ? <VscLoading className="animate-spin" /> : "Analyze Clause"}
                            </Button>
                            <AnimatePresence>
                                {demoResult && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-4 text-left p-4 border rounded-lg bg-gray-50 dark:bg-gray-800/50"
                                    >
                                        <p className="font-semibold text-sm">Explanation:</p>
                                        <p className="text-sm mb-2">{demoResult.explanation}</p>
                                        <p className="font-semibold text-sm">Risk Level:</p>
                                        <span className={`text-sm font-medium px-2 py-1 rounded-md ${
                                            demoResult.risk === 'High' ? 'bg-red-100 text-red-800' :
                                            demoResult.risk === 'Medium' ? 'bg-orange-100 text-orange-800' :
                                            'bg-green-100 text-green-800'
                                        }`}>{demoResult.risk}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>

        <section className="py-20 bg-white dark:bg-gray-900/50">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-2">Trusted by Professionals & Individuals</h3>
              <p className="text-gray-600 dark:text-gray-400">Don't just take our word for it. See what our users are saying.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {testimonials.map((testimonial, index) => (
                    <TestimonialCard key={index} {...testimonial} />
                ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold mb-2">A Powerful Suite of Features</h3>
              <p className="text-gray-600 dark:text-gray-400">Everything you need to navigate legal documents with ease.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <FeatureCard key={index} {...feature} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-100 dark:bg-gray-900 border-t dark:border-gray-800 py-6">
        <div className="container mx-auto px-6 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Xnetic. All rights reserved. A Hackathon Project.</p>
        </div>
      </footer>
    </div>
  );
}
export function Home() {
  // --- STATE MANAGEMENT ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [qaHistory, setQaHistory] = useState<QAPair[]>([]);

  // --- HANDLER FUNCTIONS ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    setIsLoading(true);
    setAnalysisResult(null); // Clear previous results
    setQaHistory([]); // Clear Q&A history

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze document.");
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
      setDocumentId(data.document_id);
    } catch (error) {
      console.error(error);
      alert("An error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question || !documentId) {
        alert("Please enter a question.");
        return;
    }

    setIsAsking(true);
    try {
        const response = await fetch("http://127.0.0.1:8000/ask", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_id: documentId, question: question })
        });
        
        if (!response.ok) {
            throw new Error("Failed to get answer.");
        }

        const data = await response.json();
        setQaHistory([...qaHistory, { question, answer: data.answer }]);
        setQuestion(""); // Clear input field
    } catch (error) {
        console.error(error);
        alert("An error occurred while asking the question.");
    } finally {
        setIsAsking(false);
    }
  };


  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-50">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold">Xnetic: Your AI Legal Assistant ⚖️</h1>
          <p className="text-gray-600 mt-2">
            Simplify legal documents, get risk assessments, and ask questions.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader><CardTitle>1. Upload Your Document</CardTitle></CardHeader>
          <CardContent>
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="document">Select a PDF or DOCX file</Label>
              <div className="flex gap-2">
                <Input id="document" type="file" onChange={handleFileChange} className="flex-grow" accept=".pdf,.docx" />
                <Button onClick={handleAnalyze} disabled={isLoading || !selectedFile}>
                  {isLoading ? <VscLoading className="animate-spin" /> : "Analyze Document"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {(isLoading || analysisResult) && (
            <Card>
                <CardHeader><CardTitle>2. Analysis Results</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center p-8">
                           <VscLoading className="animate-spin text-4xl" /> 
                        </div>
                    ) : (
                        analysisResult && (
                           <div className="space-y-6">
                             {/* Using whitespace-pre-wrap to respect formatting from the AI */}
                             <div className="p-4 bg-gray-100 rounded-md whitespace-pre-wrap font-mono text-sm">
                                {analysisResult}
                             </div>
                             
                             <h3 className="font-semibold pt-4 border-t">Ask a Follow-up Question</h3>
                             
                             {/* Display Q&A History */}
                             <div className="space-y-4">
                               {qaHistory.map((qa, index) => (
                                <div key={index}>
                                    <p className="font-semibold text-gray-700">Q: {qa.question}</p>
                                    <p className="p-2 bg-blue-50 rounded-md mt-1">A: {qa.answer}</p>
                                </div>
                               ))}
                             </div>

                             <div className="flex gap-2">
                                <Input 
                                  value={question} 
                                  onChange={(e) => setQuestion(e.target.value)}
                                  placeholder="e.g., What is the penalty for late payment?" 
                                />
                                <Button onClick={handleAskQuestion} disabled={isAsking}>
                                  {isAsking ? <VscLoading className="animate-spin" /> : "Ask"}
                                </Button>
                             </div>
                           </div>
                        )
                    )}
                </CardContent>
            </Card>
        )}
      </div>
    </main>
  );
}
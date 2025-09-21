"use client";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/chat");
    } catch (error) {
      console.error("Login failed:", error);
    }
  };
  
  const handleLawyerSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // In a real app, you would send this email to your backend.
      // For the hackathon, we just show a success message.
      console.log("Lawyer interest registered:", email);
      setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-black">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(255,0,182,.15),rgba(255,255,255,0))]"></div>
          <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(255,0,182,.15),rgba(255,255,255,0))]"></div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative z-10 p-12 max-w-md text-gray-900 dark:text-white"
        >
          <h1 className="text-4xl font-bold mb-4 text-primary">xnetic.ai</h1>
          <p className="text-2xl font-semibold mb-4 leading-snug">
            "Clarity is the cornerstone of confidence. Understand your contracts, empower your decisions."
          </p>
          <p className="text-gray-600 dark:text-gray-300">- The xnetic.ai Team</p>
        </motion.div>
      </div>

      {/* Right Login Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900/50">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Welcome to xnetic.ai
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Sign in to continue to your dashboard.
            </p>
          </div>
          
          <div className="space-y-4">
            <Button onClick={handleGoogleLogin} className="w-full text-lg py-6" variant="outline">
              <FcGoogle className="mr-2 h-6 w-6" />
              Sign in with Google
            </Button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-center text-gray-500">
              By signing in, you agree to our Terms of Service.
            </p>
            <div className="mt-6 p-4 border dark:border-gray-700 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Are you a legal professional?</h3>
                <p className="text-xs text-gray-500 mt-1 mb-3">Interested in collaborating? Enter your email to learn more.</p>
                {!submitted ? (
                    <form onSubmit={handleLawyerSubmit} className="flex gap-2">
                        <Input type="email" placeholder="your.email@lawfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        <Button type="submit">Submit</Button>
                    </form>
                ) : (
                    <p className="text-sm font-medium text-green-600">Thank you! We'll be in touch.</p>
                )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


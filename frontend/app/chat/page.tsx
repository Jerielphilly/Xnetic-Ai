"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger, 
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { VscLoading } from "react-icons/vsc";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

export default function NewChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  // UPDATED: State now holds an array of files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [role, setRole] = useState("Tenant"); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UPDATED: Handle multiple files and append to the list
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(prevFiles => [...prevFiles, ...Array.from(event.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };
  
  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 || !user) return;

    setIsLoading(true);
    setError(null);
    const token = await user.getIdToken();

    const formData = new FormData();
    // UPDATED: Append all selected files from the array
    selectedFiles.forEach(file => {
        formData.append("files", file);
    });
    formData.append("role", role);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Analysis failed. Please try again.");
      }

      const data = await response.json();
      // UPDATED: Redirect to the chat layout, which will refresh with the new chat.
      router.push(`/chat/${data.document_id}`);

    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-2xl text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Start a New Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center space-y-6">
            <UploadCloud className="h-12 w-12 text-gray-400" />
            <p className="text-gray-500">Upload one or more legal documents to begin.</p>
            
            <div className="w-full max-w-sm">
              <Label htmlFor="role-select" className="mb-2 block">What is your role in this document?</Label>
              <Select onValueChange={setRole} defaultValue={role}>
                <SelectTrigger id="role-select">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tenant">Tenant</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Freelancer">Freelancer</SelectItem>
                  <SelectItem value="Client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full max-w-sm">
              <Label htmlFor="document-upload" className="sr-only">Upload Document</Label>
              <Input
                id="document-upload"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.docx"
                multiple // UPDATED: Allow multiple file selection
              />
            </div>

            {/* NEW: Display list of selected files */}
            {selectedFiles.length > 0 && (
                <div className="w-full max-w-sm space-y-2">
                    <p className="text-left text-sm font-medium">Selected files:</p>
                    {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            <div className="flex items-center truncate">
                                <FileIcon className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" />
                                <span className="truncate text-sm">{file.name}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={isLoading || selectedFiles.length === 0}
            >
              {isLoading ? <VscLoading className="animate-spin" /> : `Analyze ${selectedFiles.length} Document(s)`}
            </Button>
            {error && <p className="mt-4 text-red-500">{error}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


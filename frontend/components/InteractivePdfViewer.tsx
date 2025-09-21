"use client";
import React, { useState, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// These CSS imports are still needed for correct rendering
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { VscLoading } from "react-icons/vsc";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Using the local worker from the /public directory for stability.
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

type Clause = {
  clause_title: string;
  exact_text: string;
  summary: string;
  risk_level: "Low" | "Medium" | "High";
  pageNumber?: number;
};

export default function InteractivePdfViewer({
  pdfUrl,
  clauses,
  onClose,
}: {
  pdfUrl: string;
  clauses: Clause[];
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  // Create a ref to hold an array of references to each page's div
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const file = useMemo(() => ({ url: pdfUrl }), [pdfUrl]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    // Initialize the refs array with the correct size
    pageRefs.current = pageRefs.current.slice(0, numPages);
  }

  const handleClauseClick = (pageNumber: number) => {
    // Page numbers are 1-based, array indices are 0-based
    const pageIndex = pageNumber - 1;
    if (pageRefs.current[pageIndex]) {
      pageRefs.current[pageIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const getRiskColorClass = (risk: string) => {
    if (risk === "High") return "border-red-500 bg-red-50";
    if (risk === "Medium") return "border-orange-500 bg-orange-50";
    return "border-green-500 bg-green-50";
  };

  return (
    <div className="flex h-full w-full bg-gray-100">
      {/* Left Panel: PDF Viewer */}
      <div className="flex-1 flex flex-col h-full">
        <div className="p-2 bg-white border-b sticky top-0 z-10">
          <Button onClick={onClose} variant="secondary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Summary
          </Button>
        </div>
        <div className="flex-grow overflow-auto">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex justify-center items-center h-full">
                <VscLoading className="animate-spin text-4xl" />
              </div>
            }
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <div key={`page_wrapper_${index + 1}`} ref={(el) => { pageRefs.current[index] = el; }}>
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="my-2"
                />
              </div>
            ))}
          </Document>
        </div>
      </div>

      {/* Right Panel: Clause List */}
      <div className="w-1/3 h-full overflow-y-auto bg-white border-l p-4 space-y-3">
        <h2 className="text-xl font-bold">Key Clauses</h2>
        {clauses.map((clause, index) => (
          <Card
            key={index}
            // Updated to call the new click handler
            onClick={() => handleClauseClick(clause.pageNumber || 1)}
            className={`cursor-pointer hover:shadow-lg transition-shadow ${getRiskColorClass(
              clause.risk_level
            )}`}
          >
            <CardHeader>
              <CardTitle className="text-base">{clause.clause_title}</CardTitle>
              <CardDescription>Importance: {clause.risk_level}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{clause.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


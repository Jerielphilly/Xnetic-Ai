# --- CORE IMPORTS ---
import os
import io
import re
import json
import uuid
import datetime
import traceback
from typing import Optional, List
from dotenv import load_dotenv

# --- FASTAPI IMPORTS ---
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware

# --- FIREBASE IMPORTS ---
import firebase_admin
from firebase_admin import credentials, auth, firestore, storage

# --- DOCUMENT PROCESSING IMPORTS ---
from pypdf import PdfReader
from docx import Document

# --- LANGCHAIN & GOOGLE AI IMPORTS ---
import google.generativeai as genai
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain_core.pydantic_v1 import BaseModel, Field

# FIXED: Added missing imports for Text-to-Speech
from google.cloud import texttospeech
from google.oauth2 import service_account
import base64

# --- 1. SETUP & CONFIGURATION ---
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

SERVICE_ACCOUNT_FILE = "serviceAccountKey.json"
try:
    # Read the project ID from the service account file
    with open(SERVICE_ACCOUNT_FILE, 'r') as f:
        service_account_info = json.load(f)
        PROJECT_ID = service_account_info.get("project_id")
        if not PROJECT_ID:
            raise ValueError("'project_id' not found in service account file.")

    # Create credentials for both Firebase and Google Cloud services
    cred = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE)
    firebase_cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
except FileNotFoundError:
    print("\n\n--- FATAL ERROR ---")
    print(f"The '{SERVICE_ACCOUNT_FILE}' file was not found in the 'backend' directory.")
    print("Please make sure the file is present and the server is run from the 'backend' directory.")
    print("-------------------\n\n")
    exit()

if not firebase_admin._apps:
    # FIXED: Explicitly provide the projectId to the initialization function
    firebase_admin.initialize_app(firebase_cred, {
        'storageBucket': 'xnetic.firebasestorage.app',
        'projectId': PROJECT_ID,
    })

db = firestore.client()
app = FastAPI()


# --- 2. CORS MIDDLEWARE ---
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 3. DATA MODELS FOR AI OUTPUT ---
class SummaryAnalysis(BaseModel):
    score: int = Field(description="An integer (0-100) representing fairness.")
    grade: str = Field(description="A letter grade (e.g., 'B+').")
    justification: str = Field(description="A short sentence explaining the score.")
    analysis: str = Field(description="A full markdown analysis of all documents combined.")
    documentTitle: str = Field(description="A short, descriptive title for the combined analysis (e.g., 'Service Agreement & NDA').")

class Clause(BaseModel):
    clause_title: str = Field(description="Title of the clause.")
    exact_text: str = Field(description="Verbatim text of the clause.")
    summary: str = Field(description="One-sentence summary.")
    risk_level: str = Field(description="Risk level: 'Low', 'Medium', or 'High'.")
    pageNumber: int = Field(description="The page number where the clause was found within its original document.")

class ClauseList(BaseModel):
    clauses: List[Clause] = Field(description="A list of extracted clauses.", min_items=5, max_items=7)
class TimelineEvent(BaseModel):
    date: str = Field(description="The date of the event in YYYY-MM-DD format.")
    description: str = Field(description="A clear, concise description of the action required.")
    status: str = Field(description="The status of the event based on the current date: 'Upcoming', 'Overdue', or 'Completed'.")

class Timeline(BaseModel):
    events: List[TimelineEvent] = Field(description="A list of key events and deadlines from the document.")
# NEW: Data models for the Grammar Check feature
class GrammarSuggestion(BaseModel):
    original: str = Field(description="The original text snippet with an error.")
    corrected: str = Field(description="The suggested corrected text.")
    explanation: str = Field(description="A brief explanation of the grammatical rule or reason for the change.")

class GrammarReport(BaseModel):
    suggestions: List[GrammarSuggestion] = Field(description="A list of grammar and style suggestions.")

# --- 4. AUTHENTICATION & HELPERS ---
async def get_current_user(authorization: Optional[str] = Header(None)):
    if authorization is None:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    try:
        token = authorization.split("Bearer ")[1]
        return auth.verify_id_token(token)
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_document_text(file_bytes: bytes, filename: str, with_page_numbers: bool = False):
    text = ""
    file_extension = os.path.splitext(filename)[1]
    try:
        if file_extension == ".pdf":
            pdf_reader = PdfReader(io.BytesIO(file_bytes))
            for i, page in enumerate(pdf_reader.pages):
                page_text = page.extract_text() or ""
                if with_page_numbers:
                    text += f"\n\n--- PAGE {i + 1} ---\n{page_text}"
                else:
                    text += page_text + "\n"
        elif file_extension == ".docx":
            doc = Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            return None
    except Exception as e:
        print(f"Error reading file: {e}")
        return None
    return text

# --- 5. API ENDPOINTS ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Xnetic AI Backend!"}

@app.post("/upload")
async def upload_document(
    files: List[UploadFile] = File(...),
    role: str = Form(...), 
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["uid"]
    
    combined_raw_text_for_summary = ""
    combined_raw_text_with_pages = ""
    document_names = []
    file_urls = []
    file_paths = []

    for file in files:
        file_bytes = await file.read()
        bucket = storage.bucket()
        unique_filename = f"{user_id}/{uuid.uuid4()}_{file.filename}"
        blob = bucket.blob(unique_filename)
        blob.upload_from_string(file_bytes, content_type=file.content_type)
        blob.make_public()

        document_names.append(file.filename)
        file_urls.append(blob.public_url)
        file_paths.append(unique_filename)

        summary_text = get_document_text(file_bytes, file.filename, with_page_numbers=False)
        if not summary_text: continue
        
        pages_text = get_document_text(file_bytes, file.filename, with_page_numbers=True)
        combined_raw_text_for_summary += f"\n\n--- DOCUMENT: {file.filename} ---\n\n{summary_text}"
        combined_raw_text_with_pages += f"\n\n--- DOCUMENT: {file.filename} ---\n\n{pages_text}"

    if not combined_raw_text_for_summary:
        raise HTTPException(status_code=400, detail="None of the provided files could be processed.")

    try:
        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.3)
        parser = JsonOutputParser(pydantic_object=SummaryAnalysis)
        summary_prompt_template =  """
You are an expert assistant creating structured document summaries tailored to the role: {role}.
Your goal is to analyze the provided text and produce a detailed but concise JSON output.

Instructions:
1. Read and understand the full DOCUMENT TEXT carefully.
2. Focus on key information that is most relevant for the specified role ({role}).
3. Your response must be structured, factual, and avoid speculation or irrelevant filler.

The JSON must include:
- "documentTitle": A clear, short title or identifier for the document.
- "analysis": A structured, detailed summary including:
   - Purpose of the document.
   - Key sections and their meaning.
   - Obligations, responsibilities, or requirements mentioned.
   - Risks, issues, or red flags (if any).
   - Opportunities, strengths, or advantages (if relevant).
- "score": A numeric rating (0–100) that reflects the document’s clarity, completeness, and overall quality for the role.
- "grade": A letter grade (A, B, C, D, F) aligned with the score.
- "justification": A short, role-specific explanation of why the document received this score and grade.

DOCUMENT TEXT:
{text}

{format_instructions}
"""
        prompt = PromptTemplate(template=summary_prompt_template, input_variables=["text", "role"], partial_variables={"format_instructions": parser.get_format_instructions()})
        summary_chain = prompt | model | parser
        ai_response_json = summary_chain.invoke({"text": combined_raw_text_for_summary, "role": role})

        chat_data = {
            "userId": user_id,
            "documentName": document_names,
            "documentTitle": ai_response_json.get("documentTitle"),
            "createdAt": datetime.datetime.now(datetime.timezone.utc),
            # FIXED: Re-added rawText to the document for other features to use
            "rawText": combined_raw_text_with_pages,
            "role": role,
            "fileUrl": file_urls,
            "filePath": file_paths,
            "summaryAnalysis": ai_response_json.get("analysis"),
            "score": ai_response_json.get("score"),
            "grade": ai_response_json.get("grade"),
            "justification": ai_response_json.get("justification"),
        }
        
        doc_ref = db.collection("chats").document()
        doc_ref.set(chat_data)
        
        return { "document_id": doc_ref.id, **ai_response_json }

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred during analysis.")
@app.post("/ask")
async def ask_question(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    document_id = request.get("document_id")
    question = request.get("question")
    if not all([document_id, question]):
        raise HTTPException(status_code=400, detail="Missing document_id or question")
    try:
        doc_ref = db.collection("chats").document(document_id)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat document not found.")
        
        chat_data = chat_doc.to_dict()
        if chat_data.get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        
        # For Q&A, we need to reconstruct the full text from storage
        raw_text_for_qa = ""
        file_paths = chat_data.get("filePath", [])
        if isinstance(file_paths, str): # Handle older single-file chats
             file_paths = [file_paths]

        for path in file_paths:
             blob = storage.bucket().blob(path)
             file_bytes = blob.download_as_bytes()
             file_name = os.path.basename(path)
             raw_text_for_qa += get_document_text(file_bytes, file_name) + "\n\n"

        if not raw_text_for_qa:
            raise HTTPException(status_code=404, detail="No text found to analyze.")

        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.3)
        prompt_template = """
        You are a helpful and versatile legal assistant. Your primary goal is to answer questions based *only* on the provided 'Context' from a legal document.

        **Instructions:**
        1. First, analyze the 'Question' to see if it relates to the 'Context'.
        2. If the question is about the legal document, answer it using *only* the information found in the 'Context'. If the answer isn't in the context, you MUST respond with the exact phrase: "That information is not available in the document."
        3. If the question is a simple greeting (like "hello", "hi"), a follow-up conversational phrase (like "thank you"), or a general question clearly not about the legal document, then you should switch to a friendly, conversational tone and answer appropriately. Do not mention the document in this case.

        Format your document-related answers using GitHub Flavored Markdown.

        ---
        Context: {context}
        ---
        Question: {question}
        Answer:
        """
        prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
        chain = prompt | model | StrOutputParser()
        answer = chain.invoke({"context": raw_text_for_qa, "question": question})
        return {"answer": answer}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")

@app.delete("/chats/{chatId}")
async def delete_chat(chatId: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    try:
        doc_ref = db.collection("chats").document(chatId)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat document not found.")
        chat_data = chat_doc.to_dict()
        if chat_data.get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        
        if "filePath" in chat_data:
            paths_to_delete = chat_data["filePath"]
            if isinstance(paths_to_delete, str):
                paths_to_delete = [paths_to_delete]
            
            for path in paths_to_delete:
                try:
                    blob = storage.bucket().blob(path)
                    blob.delete()
                except Exception as storage_e:
                    print(f"Could not delete file '{path}' from storage, but proceeding: {storage_e}")

        doc_ref.delete()
        db.collection("chatFolders").document(chatId).delete()

        return {"status": "success", "message": "Chat deleted successfully."}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")

@app.post("/negotiate")
async def negotiate_clause(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    original_clause = request.get("clause")
    chat_id = request.get("chat_id")
    if not all([original_clause, chat_id]):
        raise HTTPException(status_code=400, detail="Missing clause or chat_id")
    try:
        doc_ref = db.collection("chats").document(chat_id)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat document not found.")
        
        chat_data = chat_doc.to_dict()
        if chat_data.get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        role = chat_data.get("role", "user")

        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.5)
        negotiation_prompt_template = """
        You are a professional legal negotiator. Redraft the 'Unfair Clause' to be more balanced from the perspective of a **{role}**.
        Provide the actual re-drafted text and briefly explain why it's fairer in Markdown.
        ---
        Unfair Clause: "{original_clause}"
        ---
        Your Suggested Fairer Alternative:
        """
        prompt = PromptTemplate(template=negotiation_prompt_template, input_variables=["role", "original_clause"])
        chain = prompt | model | StrOutputParser()
        suggestion = chain.invoke({"role": role, "original_clause": original_clause})
        return {"suggestion": suggestion}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")

@app.post("/extract-clauses")
async def extract_clauses(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    chat_id = request.get("chat_id")
    file_index = request.get("file_index")

    if not chat_id or not isinstance(file_index, int):
        raise HTTPException(status_code=400, detail="Missing or invalid parameters")
        
    try:
        doc_ref = db.collection("chats").document(chat_id)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat document not found.")

        chat_data = chat_doc.to_dict()
        if chat_data.get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        
        role = chat_data.get("role", "user")
        
        file_paths = chat_data.get("filePath", [])
        if file_index >= len(file_paths):
            raise HTTPException(status_code=404, detail="File index out of bounds.")
        
        blob = storage.bucket().blob(file_paths[file_index])
        file_bytes = blob.download_as_bytes()
        file_name = os.path.basename(file_paths[file_index])
        text_to_analyze = get_document_text(file_bytes, file_name, with_page_numbers=True)

        if not text_to_analyze:
            raise HTTPException(status_code=404, detail="No text found to analyze in the specified file.")

        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.1)
        parser = JsonOutputParser(pydantic_object=ClauseList)

        extraction_prompt_template = """
        You are a legal analysis bot. Extract 5-7 critical clauses from the document for a **{role}**.
        The document text will include markers like `--- PAGE 1 ---`. Use these markers to identify the page number for each clause.
        Adhere strictly to the JSON format provided.
        DOCUMENT TEXT:
        {text}
        {format_instructions}
        """
        prompt = PromptTemplate(
            template=extraction_prompt_template,
            input_variables=["role", "text"],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        chain = prompt | model | parser
        clauses_json = chain.invoke({"role": role, "text": text_to_analyze})
        
        return clauses_json
        
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")

@app.post("/translate")
async def translate_document(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    chat_id = request.get("chat_id")
    file_index = request.get("file_index")
    target_language = request.get("target_language")

    if not all([chat_id, target_language]) or not isinstance(file_index, int):
        raise HTTPException(status_code=400, detail="Missing parameters.")
    
    try:
        doc_ref = db.collection("chats").document(chat_id)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat document not found.")

        chat_data = chat_doc.to_dict()
        if chat_data.get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        
        file_paths = chat_data.get("filePath", [])
        if file_index >= len(file_paths):
            raise HTTPException(status_code=404, detail="File index out of bounds.")
        
        blob = storage.bucket().blob(file_paths[file_index])
        file_bytes = blob.download_as_bytes()
        file_name = os.path.basename(file_paths[file_index])

        text_to_translate = get_document_text(file_bytes, file_name, with_page_numbers=False)
        if not text_to_translate:
            raise HTTPException(status_code=404, detail="No text found to translate.")

        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.2)
        translation_prompt_template = """
        You are a professional document translator. Your task is to translate the following 'DOCUMENT TEXT' into **{target_language}**.
        **Crucial Formatting Rules:**
        1.  Preserve all original paragraph breaks. If the original text has a blank line between paragraphs, you MUST include a blank line in the translated text.
        2.  Preserve all markdown formatting such as **bold text**, *italic text*, and bullet points (`* item`).
        3.  Translate the text accurately and naturally, maintaining the professional tone of a legal document.
        ---
        DOCUMENT TEXT:
        {text}
        ---
        TRANSLATION:
        """
        prompt = PromptTemplate(template=translation_prompt_template, input_variables=["text", "target_language"])
        chain = prompt | model | StrOutputParser()
        
        translated_text = chain.invoke({"text": text_to_translate, "target_language": target_language})
        
        return {"translated_text": translated_text}
        
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error during translation.")

@app.post("/folders")
async def create_folder(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    folder_name = request.get("folder_name")
    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name is required.")
    
    try:
        folder_data = {
            "userId": user_id,
            "folderName": folder_name,
            "createdAt": datetime.datetime.now(datetime.timezone.utc)
        }
        folder_ref = db.collection("folders").document()
        folder_ref.set(folder_data)
        return {"folder_id": folder_ref.id, **folder_data}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not create folder.")

@app.get("/folders")
async def get_folders(current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    try:
        all_chats_query = db.collection("chats").where("userId", "==", user_id).stream()
        all_chats = {doc.id: {"id": doc.id, **doc.to_dict()} for doc in all_chats_query}
        
        chat_folder_mappings = {}
        chat_folders_query = db.collection("chatFolders").where("userId", "==", user_id).stream()
        for doc in chat_folders_query:
            data = doc.to_dict()
            if data.get("chatId") in all_chats:
                 chat_folder_mappings[data["chatId"]] = data["folderId"]

        folders_query = db.collection("folders").where("userId", "==", user_id).stream()
        folders = []
        for doc in folders_query:
            folder_id = doc.id
            folder_data = {"id": folder_id, "chats": [], **doc.to_dict()}
            for chat_id, mapped_folder_id in chat_folder_mappings.items():
                if mapped_folder_id == folder_id:
                    folder_data["chats"].append(all_chats[chat_id])
                    del all_chats[chat_id] 
            folders.append(folder_data)
        
        uncategorized_chats = list(all_chats.values())

        return {"folders": folders, "uncategorized": uncategorized_chats}

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not retrieve folders.")

@app.post("/move-chat")
async def move_chat_to_folder(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    chat_id = request.get("chat_id")
    folder_id = request.get("folder_id")

    if not chat_id:
        raise HTTPException(status_code=400, detail="Chat ID is required.")

    try:
        chat_ref = db.collection("chats").document(chat_id)
        chat_doc = chat_ref.get()
        if not chat_doc.exists or chat_doc.to_dict().get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")

        mapping_ref = db.collection("chatFolders").document(chat_id)

        if folder_id:
            folder_ref = db.collection("folders").document(folder_id)
            folder_doc = folder_ref.get()
            if not folder_doc.exists or folder_doc.to_dict().get("userId") != user_id:
                 raise HTTPException(status_code=403, detail="Permission denied.")
            mapping_ref.set({"chatId": chat_id, "folderId": folder_id, "userId": user_id})
        else:
            mapping_ref.delete()
            
        return {"status": "success", "message": f"Chat {chat_id} moved."}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not move chat.")

@app.delete("/folders/{folderId}")
async def delete_folder(folderId: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    try:
        folder_ref = db.collection("folders").document(folderId)
        folder_doc = folder_ref.get()
        if not folder_doc.exists:
            raise HTTPException(status_code=404, detail="Folder not found.")
        if folder_doc.to_dict().get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")

        mappings_query = db.collection("chatFolders").where("folderId", "==", folderId).stream()
        for doc in mappings_query:
            doc.reference.delete()

        folder_ref.delete()
        return {"status": "success", "message": "Folder deleted successfully."}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred.")

@app.patch("/chats/{chatId}")
async def rename_chat(chatId: str, request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    new_title = request.get("document_title")
    if not new_title:
        raise HTTPException(status_code=400, detail="New title is required.")
    
    try:
        doc_ref = db.collection("chats").document(chatId)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat not found.")
        if chat_doc.to_dict().get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        
        doc_ref.update({"documentTitle": new_title})
        return {"status": "success", "message": "Chat renamed."}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not rename chat.")

@app.patch("/folders/{folderId}")
async def rename_folder(folderId: str, request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    new_name = request.get("folder_name")
    if not new_name:
        raise HTTPException(status_code=400, detail="New folder name is required.")

    try:
        doc_ref = db.collection("folders").document(folderId)
        folder_doc = doc_ref.get()
        if not folder_doc.exists:
            raise HTTPException(status_code=404, detail="Folder not found.")
        if folder_doc.to_dict().get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")

        doc_ref.update({"folderName": new_name})
        return {"status": "success", "message": "Folder renamed."}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not rename folder.")
@app.post("/text-to-speech")
async def text_to_speech_endpoint(request: dict):
    text_to_speak = request.get("text")
    if not text_to_speak:
        raise HTTPException(status_code=400, detail="No text provided.")

    try:
        # FIXED: Explicitly pass the loaded Google Cloud credentials to the client.
        client = texttospeech.TextToSpeechClient(credentials=cred)
        
        synthesis_input = texttospeech.SynthesisInput(text=text_to_speak)
        voice = texttospeech.VoiceSelectionParams(
            language_code="en-US", ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )

        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
        
        return {"audio_content": audio_base64}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Text-to-Speech API failed: {e}")

@app.post("/generate-timeline")
async def generate_timeline(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    chat_id = request.get("chat_id")

    if not chat_id:
        raise HTTPException(status_code=400, detail="Missing chat_id")

    try:
        doc_ref = db.collection("chats").document(chat_id)
        chat_doc = doc_ref.get()

        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat document not found.")

        chat_data = chat_doc.to_dict()
        if chat_data.get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")

        # Use the raw text stored in Firestore
        full_text = chat_data.get("rawText")
        if not full_text:
            raise HTTPException(status_code=404, detail="No text found in the document to generate a timeline.")

        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.1)
        parser = JsonOutputParser(pydantic_object=Timeline)

        current_date = datetime.datetime.now().strftime("%Y-%m-%d")

        timeline_prompt_template =  """
You are an expert legal assistant and project manager. Your task is to extract only important and relevant explicit calendar dates (e.g., "September 12, 2025" or "2025-09-12") and their associated obligations from the provided legal document, and format them as a timeline.

The current date is: {current_date}.

Guidelines:
- Only include dates that are directly tied to obligations, deadlines, renewals, terminations, payments, or other legally relevant events.
- Ignore relative timelines (e.g., "30 days after signing," "within 90 days") unless the document itself explicitly provides the resolved date.
- Do not include irrelevant or decorative dates that have no binding effect on obligations.
- Do not invent or calculate new dates beyond those explicitly stated.
- Each event must be concise but meaningful (e.g., “First renewal date of Agreement” with the explicit date).

For each included date, determine the 'status' by comparing it to the current date:
- 'Overdue' if the date is in the past,
- 'Upcoming' if the date is in the future,
- 'Completed' if the document explicitly states the action is already done.

Adhere strictly to the JSON format provided.

DOCUMENT TEXT:
{text}

{format_instructions}
"""

        prompt = PromptTemplate(
            template=timeline_prompt_template,
            input_variables=["text", "current_date"],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )

        chain = prompt | model | parser

        # Invoke LLM
        timeline_json = chain.invoke({"text": full_text, "current_date": current_date})

        # If Timeline model has events, sort them
        if hasattr(timeline_json, "events") and timeline_json.events:
            timeline_json.events.sort(key=lambda x: x.date)

        return timeline_json

    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred while generating the timeline.")

@app.patch("/chats/{chatId}/timeline")
async def save_timeline_progress(chatId: str, request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    completed_events = request.get("completed_events")

    if not isinstance(completed_events, list):
        raise HTTPException(status_code=400, detail="Invalid data format for completed events.")

    try:
        doc_ref = db.collection("chats").document(chatId)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat not found.")
        if chat_doc.to_dict().get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        
        doc_ref.update({"completedTimelineEvents": completed_events})
        return {"status": "success", "message": "Timeline progress saved."}
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Could not save timeline progress.")

@app.post("/check-grammar")
async def check_grammar(request: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["uid"]
    chat_id = request.get("chat_id")
    file_index = request.get("file_index")

    if not chat_id or not isinstance(file_index, int):
        raise HTTPException(status_code=400, detail="Missing or invalid parameters")
        
    try:
        doc_ref = db.collection("chats").document(chat_id)
        chat_doc = doc_ref.get()
        if not chat_doc.exists:
            raise HTTPException(status_code=404, detail="Chat document not found.")

        chat_data = chat_doc.to_dict()
        if chat_data.get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Permission denied.")
        
        file_paths = chat_data.get("filePath", [])
        if file_index >= len(file_paths):
            raise HTTPException(status_code=404, detail="File index out of bounds.")
        
        blob = storage.bucket().blob(file_paths[file_index])
        file_bytes = blob.download_as_bytes()
        file_name = os.path.basename(file_paths[file_index])
        text_to_analyze = get_document_text(file_bytes, file_name, with_page_numbers=False)

        if not text_to_analyze:
            raise HTTPException(status_code=404, detail="No text found to analyze in the specified file.")

        model = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0.1)
        parser = JsonOutputParser(pydantic_object=GrammarReport)

        # FIXED: Updated prompt to be more specific and ignore formatting issues.
        grammar_prompt_template = """
        You are an expert proofreader. Your task is to analyze the provided 'DOCUMENT TEXT' for substantive issues.

        **IMPORTANT:** You MUST ignore all formatting and whitespace issues. Do NOT report errors related to extra line breaks, inconsistent spacing, or indentation.

        Focus ONLY on:
        1.  **Grammatical Errors:** Incorrect tense, punctuation, subject-verb agreement.
        2.  **Spelling Mistakes:** Clear typos.
        3.  **Awkward Phrasing:** Sentences that are confusing or unclear.
        
        Here is an example of the kind of text you will receive:
        "The Parties agrees to first attempt to resolve any disputes amicably . If the dispute cannot be resolved withn thirty (30) days, either Party may pursue legal remedies"

        Here is an example of the kind of JSON output you must produce:
        {{
            "suggestions": [
                {{
                    "original": "The Parties agrees to first attempt",
                    "corrected": "The Parties agree to first attempt",
                    "explanation": "The subject 'Parties' is plural, so the verb should be 'agree', not 'agrees'."
                }},
                {{
                    "original": "resolve any disputes amicably . If",
                    "corrected": "resolve any disputes amicably. If",
                    "explanation": "Removed unnecessary space before the period for correct punctuation."
                }},
                {{
                    "original": "resolved withn thirty (30) days",
                    "corrected": "resolved within thirty (30) days",
                    "explanation": "Corrected spelling of 'within'."
                }}
            ]
        }}

        If the document is grammatically sound, return an empty list: `{{"suggestions": []}}`.
        Adhere strictly to the JSON format provided.
        
        DOCUMENT TEXT:
        {text}
        {format_instructions}
        """
        prompt = PromptTemplate(
            template=grammar_prompt_template,
            input_variables=["text"],
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        chain = prompt | model | parser
        grammar_report = chain.invoke({"text": text_to_analyze})
        
        return grammar_report
        
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="An internal error occurred while checking grammar.")


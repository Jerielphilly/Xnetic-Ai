import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("❌ Error: GOOGLE_API_KEY not found in .env file.")
else:
    genai.configure(api_key=api_key)
    print("✅ API Key found. Listing available models...\n")
    
    try:
        found_any = False
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"👉 {m.name}")
                found_any = True
        
        if not found_any:
            print("\n⚠️ No models found. Your API key might be invalid or has no access.")
            
    except Exception as e:
        print(f"\n❌ Error contacting Google: {e}")
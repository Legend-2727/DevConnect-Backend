# import requests
# import io
# from langchain_core.tools import tool
# from PyPDF2 import PdfReader

# @tool
# def extract_full_cv_from_pdf(file_url: str) -> dict:
#     """
#     Downloads a PDF from a URL, extracts its raw text, 
#     and returns the full original text.
#     """
#     try:
#         # 1. Fetch the PDF content from the URL
#         response = requests.get(file_url)
#         response.raise_for_status()  # Raise an error for bad responses (e.g., 404 Not Found)

#         # 2. Read the PDF from the in-memory bytes
#         pdf_file = io.BytesIO(response.content)
#         reader = PdfReader(pdf_file)
        
#         # 3. Extract text from all pages
#         text = "\n".join([page.extract_text() or "" for page in reader.pages])
        
#         if not text.strip():
#             return {"error": "Could not extract text from the PDF. The file might be empty or image-based."}
        
#         print(f"DEBUG: Extracted {len(text)} characters from the CV PDF. First 100 chars: {text[:100]}...")
#         return {
#             "original_cv_text": text  
#         }
#     except requests.exceptions.RequestException as e:
#         return {"error": f"Failed to download the file from URL: {e}"}
#     except Exception as e:
#         return {"error": f"An error occurred while processing the PDF: {e}"}

# def extract_full_cv_from_pdf(file_url: str) -> dict:
#     """
#     Downloads a PDF from a URL, extracts its raw text, 
#     and returns the full original text.
#     """
#     try:
#         # 1. Fetch the PDF content from the URL
#         response = requests.get(file_url)
#         response.raise_for_status()  # Raise an error for bad responses (e.g., 404 Not Found)

#         # 2. Read the PDF from the in-memory bytes
#         pdf_file = io.BytesIO(response.content)
#         reader = PdfReader(pdf_file)
        
#         # 3. Extract text from all pages
#         text = "\n".join([page.extract_text() or "" for page in reader.pages])
        
#         if not text.strip():
#             return {"error": "Could not extract text from the PDF. The file might be empty or image-based."}
        
#         print(f"DEBUG: Extracted {len(text)} characters from the CV PDF. First 100 chars: {text[:100]}...")
#         return {
#             "original_cv_text": text  
#         }
#     except requests.exceptions.RequestException as e:
#         return {"error": f"Failed to download the file from URL: {e}"}
#     except Exception as e:
#         return {"error": f"An error occurred while processing the PDF: {e}"}


import os
from urllib.parse import urlparse
from PyPDF2 import PdfReader

def extract_full_cv_from_pdf(file_url: str) -> dict:
    """
    Parses a local URL to find a file path, reads the PDF directly 
    from the shared directory, extracts its raw text, and returns it.
    """
    try:
        # 1. Parse the URL to get the path component
        parsed_url = urlparse(file_url)
        url_path = parsed_url.path  # This will be '/uploads/cvs/...'

        # 2. Construct the absolute local file path inside the container
        # The URL path '/uploads/...' maps to the local path '/app/uploads/...'
        # We achieve this by removing the leading '/' from the URL path and joining it with '/app'
        relative_path = url_path.lstrip('/')
        full_path = os.path.join('/app', relative_path)

        if not os.path.exists(full_path):
            return {"error": f"File not found at derived path: {full_path}"}

        # 3. Open the local PDF file and extract text
        with open(full_path, 'rb') as pdf_file:
            reader = PdfReader(pdf_file)
            text = "\n".join([page.extract_text() or "" for page in reader.pages])
        
        if not text.strip():
            return {"error": "Could not extract text from the PDF. File may be empty or image-based."}
        
        print(f"DEBUG: Successfully read and extracted text from {full_path}")
        return {
            "original_cv_text": text  
        }
    except Exception as e:
        return {"error": f"An error occurred while processing the PDF from URL {file_url}: {e}"}
